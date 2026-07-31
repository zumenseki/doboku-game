import { createFileRoute } from '@tanstack/react-router'

// GET    /api/admin/assignments?siteId=&status=  現場×業者の割り当て一覧（提出状況つき）
// POST   /api/admin/assignments {siteId, subIds[]}  割り当てを追加（URLを発行）
// PATCH  /api/admin/assignments {id, action:'reissue'}  URLの再発行
// DELETE /api/admin/assignments?id=  割り当てを解除（日報は残る）
export const Route = createFileRoute('/api/admin/assignments')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const params = new URL(request.url).searchParams
        const siteId = params.get('siteId') ?? ''
        const status = params.get('status') === 'closed' ? 'closed' : params.get('status') === 'all' ? '' : 'active'

        const conds: string[] = []
        const binds: string[] = []
        if (siteId) {
          conds.push('ss.site_id = ?')
          binds.push(siteId)
        }
        if (status) {
          conds.push('s.status = ?')
          binds.push(status)
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

        const rows = await core
          .requireDB()
          .prepare(
            `SELECT ss.id, ss.token, ss.created_at,
                    s.id AS site_id, s.name AS site_name, s.status AS site_status,
                    b.id AS sub_id, b.name AS sub_name, b.is_active AS sub_active,
                    (SELECT COUNT(*) FROM reports r WHERE r.site_id = ss.site_id AND r.sub_id = ss.sub_id) AS report_count,
                    (SELECT MAX(r.work_date) FROM reports r WHERE r.site_id = ss.site_id AND r.sub_id = ss.sub_id) AS last_date
             FROM site_subs ss
             JOIN sites s ON s.id = ss.site_id
             JOIN subs b  ON b.id = ss.sub_id
             ${where}
             ORDER BY s.created_at DESC, b.display_order, b.name
             LIMIT 2000`,
          )
          .bind(...binds)
          .all()

        return core.json({ rows: rows.results ?? [] })
      },

      POST: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const body = (await core.readJson(request)) as
          | { siteId?: string; subIds?: string[]; subId?: string; siteIds?: string[] }
          | null

        // 2方向をサポート:
        //   現場に業者をまとめて割り当てる  { siteId, subIds[] }
        //   業者を複数の現場に割り当てる    { subId, siteIds[] }
        const siteId = String(body?.siteId ?? '')
        const subId = String(body?.subId ?? '')
        const subIds = Array.isArray(body?.subIds) ? body!.subIds!.map(String).slice(0, 500) : []
        const siteIds = Array.isArray(body?.siteIds) ? body!.siteIds!.map(String).slice(0, 500) : []

        const db = core.requireDB()
        let pairs: { siteId: string; subId: string }[] = []
        let requested = 0

        if (siteId && subIds.length > 0) {
          const site = await db.prepare('SELECT id FROM sites WHERE id = ?').bind(siteId).first()
          if (!site) return core.json({ message: '現場が見つかりません' }, 404)
          const existing = await db
            .prepare('SELECT sub_id FROM site_subs WHERE site_id = ?')
            .bind(siteId)
            .all<{ sub_id: string }>()
          const already = new Set((existing.results ?? []).map((r) => r.sub_id))
          requested = subIds.length
          pairs = subIds.filter((id) => !already.has(id)).map((id) => ({ siteId, subId: id }))
        } else if (subId && siteIds.length > 0) {
          const sub = await db.prepare('SELECT id FROM subs WHERE id = ?').bind(subId).first()
          if (!sub) return core.json({ message: '業者が見つかりません' }, 404)
          const existing = await db
            .prepare('SELECT site_id FROM site_subs WHERE sub_id = ?')
            .bind(subId)
            .all<{ site_id: string }>()
          const already = new Set((existing.results ?? []).map((r) => r.site_id))
          requested = siteIds.length
          pairs = siteIds.filter((id) => !already.has(id)).map((id) => ({ siteId: id, subId }))
        } else {
          return core.json({ message: '現場と業者を指定してください' }, 400)
        }

        if (pairs.length === 0) return core.json({ created: 0, skipped: requested })

        const now = core.nowIso()
        const statements = pairs.map((pair) =>
          db
            .prepare('INSERT INTO site_subs (id, site_id, sub_id, token, created_at) VALUES (?,?,?,?,?)')
            .bind(core.uuid(), pair.siteId, pair.subId, core.randomToken(21), now),
        )
        for (let i = 0; i < statements.length; i += 50) {
          await db.batch(statements.slice(i, i + 50))
        }
        return core.json({ created: pairs.length, skipped: requested - pairs.length })
      },

      PATCH: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const body = (await core.readJson(request)) as { id?: string; action?: string } | null
        const id = String(body?.id ?? '')
        if (String(body?.action ?? '') !== 'reissue') {
          return core.json({ message: '操作が不正です' }, 400)
        }
        const token = core.randomToken(21)
        await core.requireDB().prepare('UPDATE site_subs SET token = ? WHERE id = ?').bind(token, id).run()
        return core.json({ ok: true, token })
      },

      DELETE: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const id = new URL(request.url).searchParams.get('id') ?? ''
        await core.requireDB().prepare('DELETE FROM site_subs WHERE id = ?').bind(id).run()
        return core.json({ ok: true })
      },
    },
  },
})
