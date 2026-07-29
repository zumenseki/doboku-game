import { createFileRoute } from '@tanstack/react-router'

// POST /api/admin/drawing (multipart: siteId, image(PNG必須), pdf(任意・元ファイル))
//   図面画像(色塗り・閲覧用PNG)と、あればPDF原本を保存する。
//   PNGは管理ブラウザ側で PDF→レンダリング / 画像→縮小 して作られる。
// GET  /api/admin/drawing?siteId=&kind=image|pdf — 図面を配信
export const Route = createFileRoute('/api/admin/drawing')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const url = new URL(request.url)
        const siteId = url.searchParams.get('siteId') ?? ''
        const kind = url.searchParams.get('kind') === 'pdf' ? 'pdf' : 'image'

        const site = await core
          .requireDB()
          .prepare('SELECT drawing_key, drawing_image_key FROM sites WHERE id = ?')
          .bind(siteId)
          .first<{ drawing_key: string | null; drawing_image_key: string | null }>()
        const key = kind === 'pdf' ? site?.drawing_key : site?.drawing_image_key
        if (!key) return core.json({ message: '図面が登録されていません' }, 404)

        const object = await core.requireR2().get(key)
        if (!object) return core.json({ message: '図面ファイルが見つかりません' }, 404)

        return new Response(object.body as unknown as BodyInit, {
          headers: {
            'Content-Type': kind === 'pdf' ? 'application/pdf' : 'image/png',
            'Cache-Control': 'private, max-age=300',
            'Content-Disposition': 'inline',
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
        const image = form.get('image')
        const pdf = form.get('pdf')

        if (!(image instanceof File) || image.type !== 'image/png') {
          return core.json({ message: '図面画像 (PNG) がありません' }, 400)
        }
        if (image.size <= 0 || image.size > MAX_DRAWING_BYTES) {
          return core.json({ message: '図面画像は10MBまでです' }, 400)
        }
        if (pdf instanceof File && (pdf.type !== 'application/pdf' || pdf.size > MAX_DRAWING_BYTES)) {
          return core.json({ message: 'PDFは10MBまでです' }, 400)
        }

        const db = core.requireDB()
        const site = await db.prepare('SELECT id FROM sites WHERE id = ?').bind(siteId).first()
        if (!site) return core.json({ message: '現場が見つかりません' }, 404)

        const r2 = core.requireR2()
        const imageKey = `sites/${siteId}/drawing.png`
        await r2.put(imageKey, await image.arrayBuffer(), {
          httpMetadata: { contentType: 'image/png' },
        })

        let pdfKey: string | null = null
        if (pdf instanceof File) {
          pdfKey = `sites/${siteId}/drawing.pdf`
          await r2.put(pdfKey, await pdf.arrayBuffer(), {
            httpMetadata: { contentType: 'application/pdf' },
          })
        }

        if (pdfKey) {
          await db
            .prepare('UPDATE sites SET drawing_image_key = ?, drawing_key = ? WHERE id = ?')
            .bind(imageKey, pdfKey, siteId)
            .run()
        } else {
          await db
            .prepare('UPDATE sites SET drawing_image_key = ? WHERE id = ?')
            .bind(imageKey, siteId)
            .run()
        }

        return core.json({ ok: true, imageKey, pdfKey })
      },
    },
  },
})
