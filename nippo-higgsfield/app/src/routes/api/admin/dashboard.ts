import { createFileRoute } from '@tanstack/react-router'

// GET /api/admin/dashboard?date=YYYY-MM-DD
// 稼働中の現場 × 割り当て業者ごとに、その日の提出状況を返す
export const Route = createFileRoute('/api/admin/dashboard')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const date = new URL(request.url).searchParams.get('date') ?? ''
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return core.json({ message: '日付が不正です' }, 400)

        const db = core.requireDB()
        const [sites, assignments, reports] = await Promise.all([
          db
            .prepare("SELECT id, name FROM sites WHERE status = 'active' ORDER BY created_at DESC")
            .all<{ id: string; name: string }>(),
          db
            .prepare(
              `SELECT ss.id, ss.site_id, ss.sub_id, b.name AS sub_name
               FROM site_subs ss
               JOIN sites s ON s.id = ss.site_id
               JOIN subs b  ON b.id = ss.sub_id
               WHERE s.status = 'active' AND b.is_active = 1
               ORDER BY b.display_order, b.name`,
            )
            .all(),
          db
            .prepare(
              `SELECT r.id, r.site_id, r.sub_id, r.workers, r.area_m2, r.work_type, r.created_at
               FROM reports r WHERE r.work_date = ?`,
            )
            .bind(date)
            .all(),
        ])

        return core.json({
          sites: sites.results ?? [],
          assignments: assignments.results ?? [],
          reports: reports.results ?? [],
        })
      },
    },
  },
})
