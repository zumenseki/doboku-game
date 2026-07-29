import { createFileRoute } from '@tanstack/react-router'

/** 終了から何日経過した現場の写真を一括削除の対象にするか */
const RETENTION_DAYS = 180

async function collect(core: typeof import('../../../nippo/server/core.server')) {
  const db = core.requireDB()
  const threshold = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const sites = await db
    .prepare("SELECT id FROM sites WHERE status = 'closed' AND closed_at IS NOT NULL AND closed_at < ?")
    .bind(threshold)
    .all<{ id: string }>()
  const siteIds = (sites.results ?? []).map((s) => s.id)
  if (siteIds.length === 0) return { db, siteCount: 0, photos: [] as { id: string; object_key: string }[] }

  const placeholders = siteIds.map(() => '?').join(',')
  const photos = await db
    .prepare(
      `SELECT p.id, p.object_key FROM report_photos p
       JOIN reports r ON r.id = p.report_id
       WHERE r.site_id IN (${placeholders})`,
    )
    .bind(...siteIds)
    .all<{ id: string; object_key: string }>()

  return { db, siteCount: siteIds.length, photos: photos.results ?? [] }
}

// GET  /api/admin/purge → 対象件数 (実行前の確認用)
// POST /api/admin/purge → 実行 (R2 + report_photos行を削除。日報本体は残す)
export const Route = createFileRoute('/api/admin/purge')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied
        const { siteCount, photos } = await collect(core)
        return core.json({ siteCount, photoCount: photos.length, retentionDays: RETENTION_DAYS })
      },
      POST: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const { db, photos } = await collect(core)
        if (photos.length === 0) return core.json({ deleted: 0 })

        const r2 = core.requireR2()
        for (let i = 0; i < photos.length; i += 500) {
          const chunk = photos.slice(i, i + 500)
          await r2.delete(chunk.map((p) => p.object_key))
          const placeholders = chunk.map(() => '?').join(',')
          await db
            .prepare(`DELETE FROM report_photos WHERE id IN (${placeholders})`)
            .bind(...chunk.map((p) => p.id))
            .run()
        }
        return core.json({ deleted: photos.length })
      },
    },
  },
})
