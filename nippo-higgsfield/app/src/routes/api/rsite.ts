import { createFileRoute } from '@tanstack/react-router'

// GET /api/rsite?token= → { site: { name }, sub: { name }, workTypes, paint }
// token は「現場×業者」を指すので、業者は選択不要（URLで確定する）。
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
          const result = await core.resolveAssignmentByToken(token)
          if (!result.ok) return core.json({ message: result.message }, result.status)
          const { site, subName } = result.assignment

          const db = core.requireDB()
          const [workTypes, masks] = await Promise.all([
            db
              .prepare('SELECT name FROM work_types WHERE is_active = 1 ORDER BY display_order, name')
              .all<{ name: string }>(),
            db
              .prepare(
                `SELECT pr.polygon FROM paint_regions pr
                 JOIN reports r ON r.id = pr.report_id
                 WHERE r.site_id = ? LIMIT 200`,
              )
              .bind(site.id)
              .all<{ polygon: string }>(),
          ])

          const maskKeys: string[] = []
          for (const row of masks.results ?? []) {
            try {
              const meta = JSON.parse(row.polygon) as { objectKey?: string }
              if (meta.objectKey) maskKeys.push(meta.objectKey)
            } catch {
              /* 旧形式は無視 */
            }
          }

          return core.json({
            site: { name: site.name },
            sub: { name: subName },
            workTypes: (workTypes.results ?? []).map((w) => w.name),
            paint:
              site.drawing_image_key && site.scale_m_per_unit
                ? {
                    drawingKey: site.drawing_image_key,
                    scaleMPerUnit: site.scale_m_per_unit,
                    maskKeys,
                  }
                : null,
          })
        } catch (e) {
          console.error('rsite failed', e)
          return core.json({ message: '接続できませんでした。時間をおいて再度お試しください' }, 503)
        }
      },
    },
  },
})
