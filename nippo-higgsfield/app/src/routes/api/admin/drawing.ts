import { createFileRoute } from '@tanstack/react-router'

// POST /api/admin/drawing (multipart: siteId, file) — 図面PDFアップロード (10MBまで)
// GET  /api/admin/drawing?siteId= — 図面PDFを配信
export const Route = createFileRoute('/api/admin/drawing')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const siteId = new URL(request.url).searchParams.get('siteId') ?? ''
        const site = await core
          .requireDB()
          .prepare('SELECT drawing_key FROM sites WHERE id = ?')
          .bind(siteId)
          .first<{ drawing_key: string | null }>()
        if (!site?.drawing_key) return core.json({ message: '図面が登録されていません' }, 404)

        const object = await core.requireR2().get(site.drawing_key)
        if (!object) return core.json({ message: '図面ファイルが見つかりません' }, 404)

        return new Response(object.body as unknown as BodyInit, {
          headers: {
            'Content-Type': 'application/pdf',
            'Cache-Control': 'private, max-age=300',
            'Content-Disposition': 'inline; filename="drawing.pdf"',
          },
        })
      },
      POST: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const { MAX_DRAWING_BYTES } = await import('../../../nippo/validation')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        let form: FormData
        try {
          form = await request.formData()
        } catch {
          return core.json({ message: 'リクエストが不正です' }, 400)
        }

        const siteId = String(form.get('siteId') ?? '')
        const file = form.get('file')
        if (!(file instanceof File)) return core.json({ message: 'ファイルがありません' }, 400)
        if (file.type !== 'application/pdf') {
          return core.json({ message: 'PDFファイルを選択してください' }, 400)
        }
        if (file.size <= 0 || file.size > MAX_DRAWING_BYTES) {
          return core.json({ message: '図面PDFは10MBまでです' }, 400)
        }

        const db = core.requireDB()
        const site = await db.prepare('SELECT id FROM sites WHERE id = ?').bind(siteId).first()
        if (!site) return core.json({ message: '現場が見つかりません' }, 404)

        const objectKey = `sites/${siteId}/drawing.pdf`
        await core.requireR2().put(objectKey, await file.arrayBuffer(), {
          httpMetadata: { contentType: 'application/pdf' },
        })
        await db.prepare('UPDATE sites SET drawing_key = ? WHERE id = ?').bind(objectKey, siteId).run()

        return core.json({ ok: true, objectKey })
      },
    },
  },
})
