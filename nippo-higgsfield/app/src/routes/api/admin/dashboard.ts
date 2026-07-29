import { createFileRoute } from '@tanstack/react-router'

// GET /api/admin/dashboard?date=YYYY-MM-DD → 稼働中現場と当日の日報
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
        const [sites, reports] = await Promise.all([
          db
            .prepare("SELECT id, name FROM sites WHERE status = 'active' ORDER BY created_at DESC")
            .all<{ id: string; name: string }>(),
          db
            .prepare(
              `SELECT r.id, r.site_id, r.workers, r.area_m2, r.work_type, r.created_at,
                      COALESCE(b.name, '(不明)') AS sub_name
               FROM reports r LEFT JOIN subs b ON b.id = r.sub_id
               WHERE r.work_date = ?`,
            )
            .bind(date)
            .all(),
        ])

        return core.json({ sites: sites.results ?? [], reports: reports.results ?? [] })
      },
    },
  },
})
