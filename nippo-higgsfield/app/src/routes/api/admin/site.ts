import { createFileRoute } from '@tanstack/react-router'

// GET   /api/admin/site?id= → { site, reportCount, paints }
// PATCH /api/admin/site {id, action: 'update'|'close'|'reopen'|'reissue'|'scale', ...}
export const Route = createFileRoute('/api/admin/site')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const id = new URL(request.url).searchParams.get('id') ?? ''
        const db = core.requireDB()
        const site = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first()
        if (!site) return core.json({ message: '現場が見つかりません' }, 404)

        const [count, paints, assignments] = await Promise.all([
          db.prepare('SELECT COUNT(*) AS n FROM reports WHERE site_id = ?').bind(id).first<{ n: number }>(),
          db
            .prepare(
              `SELECT pr.id, pr.polygon, pr.area_m2, r.work_date, COALESCE(b.name,'(不明)') AS sub_name
               FROM paint_regions pr
               JOIN reports r ON r.id = pr.report_id
               LEFT JOIN subs b ON b.id = r.sub_id
               WHERE r.site_id = ?
               ORDER BY r.work_date, r.created_at LIMIT 500`,
            )
            .bind(id)
            .all<{ id: string; polygon: string; area_m2: number; work_date: string; sub_name: string }>(),
          // この現場に割り当てられた業者（＝発行済みの日報URL）
          db
            .prepare(
              `SELECT ss.id, ss.token, b.id AS sub_id, b.name AS sub_name, b.is_active AS sub_active,
                      (SELECT COUNT(*) FROM reports r WHERE r.site_id = ss.site_id AND r.sub_id = ss.sub_id) AS report_count,
                      (SELECT MAX(r.work_date) FROM reports r WHERE r.site_id = ss.site_id AND r.sub_id = ss.sub_id) AS last_date
               FROM site_subs ss JOIN subs b ON b.id = ss.sub_id
               WHERE ss.site_id = ?
               ORDER BY b.display_order, b.name`,
            )
            .bind(id)
            .all(),
        ])

        const paintRows = (paints.results ?? []).flatMap((p) => {
          try {
            const meta = JSON.parse(p.polygon) as { objectKey?: string }
            if (!meta.objectKey) return []
            return [
              {
                id: p.id,
                objectKey: meta.objectKey,
                areaM2: p.area_m2,
                workDate: p.work_date,
                subName: p.sub_name,
              },
            ]
          } catch {
            return []
          }
        })

        return core.json({ site, reportCount: count?.n ?? 0, paints: paintRows, assignments: assignments.results ?? [] })
      },
      PATCH: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const { siteSchema } = await import('../../../nippo/validation')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const body = (await core.readJson(request)) as Record<string, unknown> | null
        if (!body) return core.json({ message: 'リクエストが不正です' }, 400)
        const id = String(body.id ?? '')
        const action = String(body.action ?? '')
        const db = core.requireDB()

        if (action === 'update') {
          const areaRaw = body.totalAreaM2
          const parsed = siteSchema.safeParse({
            name: String(body.name ?? ''),
            address: String(body.address ?? '') || undefined,
            totalAreaM2:
              areaRaw === null || areaRaw === undefined || areaRaw === '' ? null : Number(areaRaw),
          })
          if (!parsed.success) {
            return core.json({ message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }, 400)
          }
          await db
            .prepare('UPDATE sites SET name = ?, address = ?, total_area_m2 = ? WHERE id = ?')
            .bind(parsed.data.name, parsed.data.address ?? null, parsed.data.totalAreaM2 ?? null, id)
            .run()
          return core.json({ ok: true })
        }

        if (action === 'scale') {
          const scale = Number(body.scaleMPerUnit)
          if (!Number.isFinite(scale) || scale <= 0 || scale > 100000) {
            return core.json({ message: '縮尺の値が不正です' }, 400)
          }
          await db.prepare('UPDATE sites SET scale_m_per_unit = ? WHERE id = ?').bind(scale, id).run()
          return core.json({ ok: true })
        }

        if (action === 'close') {
          await db
            .prepare("UPDATE sites SET status = 'closed', closed_at = ? WHERE id = ?")
            .bind(core.nowIso(), id)
            .run()
          return core.json({ ok: true })
        }

        if (action === 'reopen') {
          await db
            .prepare("UPDATE sites SET status = 'active', closed_at = NULL WHERE id = ?")
            .bind(id)
            .run()
          return core.json({ ok: true })
        }

        if (action === 'reissue') {
          const token = core.randomToken(21)
          await db.prepare('UPDATE sites SET token = ? WHERE id = ?').bind(token, id).run()
          return core.json({ ok: true, token })
        }

        return core.json({ message: '操作が不正です' }, 400)
      },
    },
  },
})
