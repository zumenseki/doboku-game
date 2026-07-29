import { createFileRoute } from '@tanstack/react-router'

// POST /api/rphoto (multipart: token, reportId, file)
// 圧縮済み写真をR2へ保存し objectKey を返す。webp/jpeg・2.5MBまで。
export const Route = createFileRoute('/api/rphoto')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const core = await import('../../nippo/server/core.server')
        const { MAX_PHOTO_BYTES } = await import('../../nippo/validation')

        let form: FormData
        try {
          form = await request.formData()
        } catch {
          return core.json({ message: 'リクエストが不正です' }, 400)
        }

        const token = String(form.get('token') ?? '')
        const reportId = String(form.get('reportId') ?? '')
        const file = form.get('file')

        if (!core.rateLimit(`rphoto:${token}`, 60)) {
          return core.json({ message: 'アップロードが多すぎます。少し待って再度お試しください' }, 429)
        }
        if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
          return core.json({ message: 'パラメータが不正です' }, 400)
        }
        if (!(file instanceof File)) {
          return core.json({ message: '写真がありません' }, 400)
        }
        if (file.type !== 'image/webp' && file.type !== 'image/jpeg') {
          return core.json({ message: '写真の形式が不正です' }, 400)
        }
        if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
          return core.json({ message: '写真1枚あたり2.5MBまでです' }, 400)
        }

        try {
          const result = await core.resolveSiteByToken(token)
          if (!result.ok) return core.json({ message: result.message }, result.status)

          const ext = file.type === 'image/webp' ? 'webp' : 'jpg'
          const objectKey = `reports/${reportId.toLowerCase()}/${core.randomToken(16)}.${ext}`
          await core.requireR2().put(objectKey, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type },
          })
          return core.json({ objectKey })
        } catch (e) {
          console.error('rphoto failed', e)
          return core.json({ message: '写真の保存に失敗しました' }, 500)
        }
      },
    },
  },
})
