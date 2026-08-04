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
            // このURLは現場IDだけで決まるので、差し替え後に古いファイルを掴まないようキャッシュしない
            'Cache-Control': 'no-store',
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
        const site = await db
          .prepare('SELECT id, drawing_key, drawing_image_key, scale_m_per_unit FROM sites WHERE id = ?')
          .bind(siteId)
          .first<{
            id: string
            drawing_key: string | null
            drawing_image_key: string | null
            scale_m_per_unit: number | null
          }>()
        if (!site) return core.json({ message: '現場が見つかりません' }, 404)

        const replaced = Boolean(site.drawing_image_key)

        // 差し替えのたびに新しいキーにする。同じキーを上書きすると、
        // ブラウザやCDNが古い画像をキャッシュしていて差し替えが反映されない。
        const r2 = core.requireR2()
        const stamp = core.randomToken(10)
        const imageKey = `sites/${siteId}/drawing-${stamp}.png`
        await r2.put(imageKey, await image.arrayBuffer(), {
          httpMetadata: { contentType: 'image/png' },
        })

        let pdfKey: string | null = null
        if (pdf instanceof File) {
          pdfKey = `sites/${siteId}/drawing-${stamp}.pdf`
          await r2.put(pdfKey, await pdf.arrayBuffer(), {
            httpMetadata: { contentType: 'application/pdf' },
          })
        }

        // 図面が変わると、前の図面で決めた縮尺は当てにならない（寸法が変われば面積がずれる）。
        // 設定し直してもらうため、差し替え時は縮尺を消す。
        if (pdfKey) {
          await db
            .prepare(
              'UPDATE sites SET drawing_image_key = ?, drawing_key = ?, scale_m_per_unit = NULL WHERE id = ?',
            )
            .bind(imageKey, pdfKey, siteId)
            .run()
        } else {
          // PDF原本を伴わない差し替えでは、古いPDFが残っていても中身が食い違うので外す
          await db
            .prepare(
              'UPDATE sites SET drawing_image_key = ?, drawing_key = NULL, scale_m_per_unit = NULL WHERE id = ?',
            )
            .bind(imageKey, siteId)
            .run()
        }

        // 古い図面ファイルはもう参照されないので消す（失敗しても差し替え自体は成立している）
        const stale = [site.drawing_image_key, site.drawing_key].filter(
          (k): k is string => Boolean(k) && k !== imageKey && k !== pdfKey,
        )
        if (stale.length > 0) {
          try {
            await r2.delete(stale)
          } catch {
            /* 残っても次の一括削除で回収できる */
          }
        }

        // 前の図面に対して塗られたマスクは位置がずれる可能性があるので件数を返す
        const paints = await db
          .prepare(
            `SELECT COUNT(*) AS n FROM paint_regions pr
             JOIN reports r ON r.id = pr.report_id WHERE r.site_id = ?`,
          )
          .bind(siteId)
          .first<{ n: number }>()

        return core.json({
          ok: true,
          imageKey,
          pdfKey,
          replaced,
          scaleCleared: replaced && site.scale_m_per_unit !== null,
          existingPaints: paints?.n ?? 0,
        })
      },
    },
  },
})
