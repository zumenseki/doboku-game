import { createFileRoute } from '@tanstack/react-router'

// GET /api/admin/file?key= — R2オブジェクト(写真/図面)を管理者にのみ配信
export const Route = createFileRoute('/api/admin/file')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const key = new URL(request.url).searchParams.get('key') ?? ''
        if (!core.isReadableKey(key)) return core.json({ message: 'キーが不正です' }, 400)

        const object = await core.requireR2().get(key)
        if (!object) return core.json({ message: 'ファイルが見つかりません' }, 404)

        return new Response(object.body as unknown as BodyInit, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
            'Cache-Control': 'private, max-age=300',
            'Content-Disposition': 'inline',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
