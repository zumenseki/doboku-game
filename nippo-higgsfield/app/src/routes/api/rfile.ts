import { createFileRoute } from '@tanstack/react-router'

// GET /api/rfile?token=&key= — 下請け向けのファイル配信 (図面画像 + 同現場の色塗りマスクのみ)
export const Route = createFileRoute('/api/rfile')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../nippo/server/core.server')
        const url = new URL(request.url)
        const token = url.searchParams.get('token') ?? ''
        const key = url.searchParams.get('key') ?? ''

        if (!core.rateLimit(`rfile:${token}`, 120)) {
          return core.json({ message: 'アクセスが多すぎます' }, 429)
        }

        const result = await core.resolveAssignmentByToken(token)
        if (!result.ok) return core.json({ message: result.message }, result.status)

        if (!core.isTokenReadableKey(key, result.assignment.site)) {
          return core.json({ message: 'キーが不正です' }, 400)
        }

        const object = await core.requireR2().get(key)
        if (!object) return core.json({ message: 'ファイルが見つかりません' }, 404)

        return new Response(object.body as unknown as BodyInit, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType ?? 'image/png',
            'Cache-Control': 'private, max-age=300',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
