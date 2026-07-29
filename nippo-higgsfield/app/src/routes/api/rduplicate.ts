import { createFileRoute } from '@tanstack/react-router'

// GET /api/rduplicate?token=&subId=&workDate=
// 同一「現場×業者×日付」の提出が既にあるかを返す (送信前の警告用。重複送信自体は許可)
export const Route = createFileRoute('/api/rduplicate')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../nippo/server/core.server')
        const url = new URL(request.url)
        const token = url.searchParams.get('token') ?? ''
        const subId = url.searchParams.get('subId') ?? ''
        const workDate = url.searchParams.get('workDate') ?? ''

        if (!core.rateLimit(`rdup:${token}`, 60)) return core.json({ exists: false })
        if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !subId || subId.length > 64) {
          return core.json({ message: 'パラメータが不正です' }, 400)
        }

        try {
          const result = await core.resolveSiteByToken(token)
          if (!result.ok) return core.json({ message: result.message }, result.status)

          const row = await core
            .requireDB()
            .prepare('SELECT COUNT(*) AS n FROM reports WHERE site_id = ? AND sub_id = ? AND work_date = ?')
            .bind(result.site.id, subId, workDate)
            .first<{ n: number }>()

          const count = row?.n ?? 0
          return core.json({ exists: count > 0, count })
        } catch {
          // 警告表示は補助機能。失敗しても送信を妨げない
          return core.json({ exists: false })
        }
      },
    },
  },
})
