import { createFileRoute } from '@tanstack/react-router'

const MAX_ROWS = 500

type ImportRow = {
  name?: unknown
  displayOrder?: unknown
  address?: unknown
  totalAreaM2?: unknown
}

// POST /api/admin/import {kind: 'subs'|'sites', rows: [...]}
// Excelから読み取った行を一括登録する。重複名はスキップして報告する。
export const Route = createFileRoute('/api/admin/import')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const body = (await core.readJson(request)) as { kind?: string; rows?: ImportRow[] } | null
        if (!body || !Array.isArray(body.rows)) {
          return core.json({ message: 'リクエストが不正です' }, 400)
        }
        const kind = body.kind
        if (kind !== 'subs' && kind !== 'sites') {
          return core.json({ message: '種別が不正です' }, 400)
        }
        if (body.rows.length === 0) return core.json({ message: '登録する行がありません' }, 400)
        if (body.rows.length > MAX_ROWS) {
          return core.json({ message: `一度に登録できるのは${MAX_ROWS}行までです` }, 400)
        }

        const db = core.requireDB()
        const now = core.nowIso()
        const skipped: { row: number; name: string; reason: string }[] = []
        const statements = []
        const seenInFile = new Set<string>()

        if (kind === 'subs') {
          const existing = await db.prepare('SELECT name FROM subs').all<{ name: string }>()
          const names = new Set((existing.results ?? []).map((r) => r.name))

          let order = 0
          for (let i = 0; i < body.rows.length; i++) {
            const row = body.rows[i]
            const name = String(row.name ?? '').trim()
            const rowNo = i + 1
            if (!name) {
              skipped.push({ row: rowNo, name: '', reason: '業者名が空' })
              continue
            }
            if (name.length > 60) {
              skipped.push({ row: rowNo, name, reason: '業者名が60文字超' })
              continue
            }
            if (names.has(name) || seenInFile.has(name)) {
              skipped.push({ row: rowNo, name, reason: '同名の業者が既に存在' })
              continue
            }
            const orderRaw = Number(row.displayOrder)
            const displayOrder =
              Number.isFinite(orderRaw) && orderRaw >= 0 && orderRaw <= 9999
                ? Math.trunc(orderRaw)
                : (order += 10)
            seenInFile.add(name)
            statements.push(
              db
                .prepare('INSERT INTO subs (id, name, display_order, is_active, created_at) VALUES (?,?,?,1,?)')
                .bind(core.uuid(), name, displayOrder, now),
            )
          }
        } else {
          const existing = await db
            .prepare("SELECT name FROM sites WHERE status = 'active'")
            .all<{ name: string }>()
          const names = new Set((existing.results ?? []).map((r) => r.name))
          const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

          for (let i = 0; i < body.rows.length; i++) {
            const row = body.rows[i]
            const name = String(row.name ?? '').trim()
            const rowNo = i + 1
            if (!name) {
              skipped.push({ row: rowNo, name: '', reason: '現場名が空' })
              continue
            }
            if (name.length > 120) {
              skipped.push({ row: rowNo, name, reason: '現場名が120文字超' })
              continue
            }
            if (names.has(name) || seenInFile.has(name)) {
              skipped.push({ row: rowNo, name, reason: '同名の稼働中現場が既に存在' })
              continue
            }
            const address = String(row.address ?? '').trim().slice(0, 200) || null
            const areaRaw = row.totalAreaM2
            const areaNum =
              areaRaw === null || areaRaw === undefined || String(areaRaw).trim() === ''
                ? null
                : Number(areaRaw)
            if (areaNum !== null && (!Number.isFinite(areaNum) || areaNum < 0 || areaNum > 99_999_999)) {
              skipped.push({ row: rowNo, name, reason: '総施工面積が不正' })
              continue
            }
            seenInFile.add(name)
            statements.push(
              db
                .prepare(
                  "INSERT INTO sites (id, token, name, address, total_area_m2, status, opened_on, created_at) VALUES (?,?,?,?,?,'active',?,?)",
                )
                .bind(core.uuid(), core.randomToken(21), name, address, areaNum, today, now),
            )
          }
        }

        try {
          if (statements.length > 0) {
            // D1のbatchはトランザクションとして実行される
            for (let i = 0; i < statements.length; i += 50) {
              await db.batch(statements.slice(i, i + 50))
            }
          }
          return core.json({ created: statements.length, skipped: skipped.slice(0, 100) })
        } catch (e) {
          console.error('import failed', e)
          return core.json({ message: '登録に失敗しました。ファイルの内容を確認してください' }, 500)
        }
      },
    },
  },
})
