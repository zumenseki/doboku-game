import { createFileRoute } from '@tanstack/react-router'

// POST /api/rmask (multipart: token, reportId, file)
// 色塗りマスクPNGをR2へ保存し objectKey を返す。日報送信 (rreport) より前に呼ぶ。
export const Route = createFileRoute('/api/rmask')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const core = await import('../../nippo/server/core.server')
        const { MAX_MASK_BYTES } = await import('../../nippo/validation')

        let form: FormData
        try {
          form = await request.formData()
        } catch {
          return core.json({ message: 'リクエストが不正です' }, 400)
        }

        const token = String(form.get('token') ?? '')
        const reportId = String(form.get('reportId') ?? '').toLowerCase()
        const file = form.get('file')

        if (!core.rateLimit(`rmask:${token}`, 30)) {
          return core.json({ message: 'アップロードが多すぎます。少し待って再度お試しください' }, 429)
        }
        if (!/^[0-9a-f-]{36}$/.test(reportId)) {
          return core.json({ message: 'パラメータが不正です' }, 400)
        }
        if (!(file instanceof File) || file.type !== 'image/png') {
          return core.json({ message: '色塗りデータの形式が不正です' }, 400)
        }
        if (file.size <= 0 || file.size > MAX_MASK_BYTES) {
          return core.json({ message: '色塗りデータが大きすぎます' }, 400)
        }

        try {
          const result = await core.resolveSiteByToken(token)
          if (!result.ok) return core.json({ message: result.message }, result.status)

          const objectKey = core.maskKeyFor(result.site.id, reportId)
          await core.requireR2().put(objectKey, await file.arrayBuffer(), {
            httpMetadata: { contentType: 'image/png' },
          })
          return core.json({ objectKey })
        } catch (e) {
          console.error('rmask failed', e)
          return core.json({ message: '色塗りデータの保存に失敗しました' }, 500)
        }
      },
    },
  },
})
