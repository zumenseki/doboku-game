import { createFileRoute } from '@tanstack/react-router'

// GET /api/admin/photos?reportId= → { keys: [...] }
export const Route = createFileRoute('/api/admin/photos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const reportId = new URL(request.url).searchParams.get('reportId') ?? ''
        const rows = await core
          .requireDB()
          .prepare('SELECT object_key FROM report_photos WHERE report_id = ? ORDER BY created_at')
          .bind(reportId)
          .all<{ object_key: string }>()
        return core.json({ keys: (rows.results ?? []).map((r) => r.object_key) })
      },
    },
  },
})
