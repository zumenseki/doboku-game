import { createFileRoute } from '@tanstack/react-router'

// GET /api/rsite?token= → { site: { name }, subs: [...], workTypes: [...] }
// token不明: 404 / 受付終了: 410
export const Route = createFileRoute('/api/rsite')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../nippo/server/core.server')
        const token = new URL(request.url).searchParams.get('token') ?? ''

        if (!core.rateLimit(`rsite:${token}`, 60)) {
          return core.json({ message: 'アクセスが多すぎます。少し待って再度お試しください' }, 429)
        }

        try {
          const result = await core.resolveSiteByToken(token)
          if (!result.ok) return core.json({ message: result.message }, result.status)

          const db = core.requireDB()
          const [subs, workTypes] = await Promise.all([
            db
              .prepare('SELECT id, name FROM subs WHERE is_active = 1 ORDER BY display_order, name')
              .all<{ id: string; name: string }>(),
            db
              .prepare('SELECT name FROM work_types WHERE is_active = 1 ORDER BY display_order, name')
              .all<{ name: string }>(),
          ])

          return core.json({
            site: { name: result.site.name },
            subs: subs.results ?? [],
            workTypes: (workTypes.results ?? []).map((w) => w.name),
          })
        } catch (e) {
          console.error('rsite failed', e)
          return core.json({ message: '接続できませんでした。時間をおいて再度お試しください' }, 503)
        }
      },
    },
  },
})
