import { createFileRoute } from '@tanstack/react-router'

const PAGE_SIZE = 100

/** 作業内容の内訳を1行のJSONにまとめて取り出す副問い合わせ */
const WORK_ITEMS_JSON = `(
  SELECT json_group_array(json_object('workType', work_type, 'workers', workers))
  FROM (SELECT work_type, workers FROM report_work_items WHERE report_id = r.id ORDER BY sort_order)
) AS work_items_json`

type WorkItem = { workType: string; workers: number }

/** work_items_json をパースして workItems に置き換える。旧データは work_type から1件だけ作る */
function withWorkItems(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const { work_items_json: raw, ...rest } = row
    let items: WorkItem[] = []
    try {
      items = JSON.parse(String(raw ?? '[]')) as WorkItem[]
    } catch {
      items = []
    }
    if (items.length === 0) {
      items = [{ workType: String(rest.work_type ?? ''), workers: Number(rest.workers ?? 0) }]
    }
    return { ...rest, workItems: items }
  })
}

function buildWhere(params: URLSearchParams): { where: string; binds: (string | number)[] } {
  const conds: string[] = []
  const binds: (string | number)[] = []
  const from = params.get('from')
  const to = params.get('to')
  const siteId = params.get('siteId')
  const subId = params.get('subId')
  const workType = params.get('workType')
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    conds.push('r.work_date >= ?')
    binds.push(from)
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    conds.push('r.work_date <= ?')
    binds.push(to)
  }
  if (siteId) {
    conds.push('r.site_id = ?')
    binds.push(siteId)
  }
  if (subId) {
    conds.push('r.sub_id = ?')
    binds.push(subId)
  }
  if (workType) {
    // 1日報に複数の作業が入るので、内訳のどれかに一致すれば対象
    conds.push('EXISTS (SELECT 1 FROM report_work_items i WHERE i.report_id = r.id AND i.work_type = ?)')
    binds.push(workType)
  }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', binds }
}

// GET    /api/admin/reports?from&to&siteId&subId&workType&page | &all=1 (CSV用全件)
// PATCH  /api/admin/reports {id, workDate, subId, workItems[{workType,workers}], areaM2, note}
// DELETE /api/admin/reports?id= (写真もR2ごと削除)
export const Route = createFileRoute('/api/admin/reports')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const params = new URL(request.url).searchParams
        const db = core.requireDB()
        const { where, binds } = buildWhere(params)
        const all = params.get('all') === '1'
        const page = Math.max(1, Number(params.get('page') ?? 1) || 1)

        const baseSelect = `
          SELECT r.*, s.name AS site_name, b.name AS sub_name,
                 (SELECT COUNT(*) FROM report_photos p WHERE p.report_id = r.id) AS photo_count,
                 ${WORK_ITEMS_JSON}
          FROM reports r
          LEFT JOIN sites s ON s.id = r.site_id
          LEFT JOIN subs b ON b.id = r.sub_id
          ${where}`

        if (all) {
          const rows = await db
            .prepare(`${baseSelect} ORDER BY r.work_date, r.created_at LIMIT 20000`)
            .bind(...binds)
            .all<Record<string, unknown>>()
          return core.json({ rows: withWorkItems(rows.results ?? []) })
        }

        const [rows, totalRow, sites, subs, workTypes] = await Promise.all([
          db
            .prepare(
              `${baseSelect} ORDER BY r.work_date DESC, r.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
            )
            .bind(...binds)
            .all<Record<string, unknown>>(),
          db
            .prepare(`SELECT COUNT(*) AS n FROM reports r ${where}`)
            .bind(...binds)
            .first<{ n: number }>(),
          db.prepare('SELECT id, name FROM sites ORDER BY created_at DESC').all(),
          db.prepare('SELECT id, name FROM subs ORDER BY display_order, name').all(),
          db.prepare('SELECT name FROM work_types ORDER BY display_order, name').all(),
        ])

        return core.json({
          rows: withWorkItems(rows.results ?? []),
          total: totalRow?.n ?? 0,
          pageSize: PAGE_SIZE,
          sites: sites.results ?? [],
          subs: subs.results ?? [],
          workTypes: ((workTypes.results ?? []) as { name: string }[]).map((w) => w.name),
        })
      },
      PATCH: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const { reportEditSchema, summarizeWorkTypes, totalWorkers } = await import(
          '../../../nippo/validation'
        )
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const body = (await core.readJson(request)) as Record<string, unknown> | null
        if (!body) return core.json({ message: 'リクエストが不正です' }, 400)
        const id = String(body.id ?? '')
        const areaRaw = body.areaM2
        const noteRaw = typeof body.note === 'string' ? body.note.trim() : ''

        // 旧形式 {workers, workType} で来ても1件の内訳として受ける
        const rawItems = Array.isArray(body.workItems)
          ? (body.workItems as Record<string, unknown>[]).map((i) => ({
              workType: String(i?.workType ?? ''),
              workers: Number(i?.workers ?? 0),
            }))
          : [{ workType: String(body.workType ?? ''), workers: Number(body.workers ?? 0) }]

        const parsed = reportEditSchema.safeParse({
          workDate: String(body.workDate ?? ''),
          subId: String(body.subId ?? ''),
          workItems: rawItems,
          areaM2: areaRaw === null || areaRaw === undefined || areaRaw === '' ? null : Number(areaRaw),
          note: noteRaw === '' ? null : noteRaw,
        })
        if (!parsed.success) {
          return core.json({ message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }, 400)
        }

        const db = core.requireDB()
        const items = parsed.data.workItems
        await db.batch([
          db
            .prepare(
              'UPDATE reports SET work_date = ?, sub_id = ?, workers = ?, work_type = ?, area_m2 = ?, note = ? WHERE id = ?',
            )
            .bind(
              parsed.data.workDate,
              parsed.data.subId,
              totalWorkers(items),
              summarizeWorkTypes(items),
              parsed.data.areaM2,
              parsed.data.note,
              id,
            ),
          // 内訳は入れ替える
          db.prepare('DELETE FROM report_work_items WHERE report_id = ?').bind(id),
          ...items.map((item, i) =>
            db
              .prepare(
                'INSERT INTO report_work_items (id, report_id, work_type, workers, sort_order) VALUES (?,?,?,?,?)',
              )
              .bind(core.uuid(), id, item.workType, item.workers, i),
          ),
        ])
        return core.json({ ok: true })
      },
      DELETE: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const id = new URL(request.url).searchParams.get('id') ?? ''
        const db = core.requireDB()

        const [photos, paints] = await Promise.all([
          db
            .prepare('SELECT object_key FROM report_photos WHERE report_id = ?')
            .bind(id)
            .all<{ object_key: string }>(),
          db
            .prepare('SELECT polygon FROM paint_regions WHERE report_id = ?')
            .bind(id)
            .all<{ polygon: string }>(),
        ])

        await db.batch([
          db.prepare('DELETE FROM report_photos WHERE report_id = ?').bind(id),
          db.prepare('DELETE FROM paint_regions WHERE report_id = ?').bind(id),
          db.prepare('DELETE FROM report_work_items WHERE report_id = ?').bind(id),
          db.prepare('DELETE FROM reports WHERE id = ?').bind(id),
        ])

        const keys = (photos.results ?? []).map((p) => p.object_key)
        for (const row of paints.results ?? []) {
          try {
            const meta = JSON.parse(row.polygon) as { objectKey?: string }
            if (meta.objectKey) keys.push(meta.objectKey)
          } catch {
            /* 旧形式は無視 */
          }
        }
        if (keys.length > 0) {
          try {
            await core.requireR2().delete(keys)
          } catch {
            // R2の残骸は設定画面の一括削除で回収できる
          }
        }
        return core.json({ ok: true })
      },
    },
  },
})
