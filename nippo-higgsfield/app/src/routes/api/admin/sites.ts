import { createFileRoute } from '@tanstack/react-router'

// GET  /api/admin/sites?status=active|closed → { rows }
// POST /api/admin/sites {name, address?} → 現場作成 (token発行)
export const Route = createFileRoute('/api/admin/sites')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const status = new URL(request.url).searchParams.get('status') === 'closed' ? 'closed' : 'active'
        const rows = await core
          .requireDB()
          .prepare('SELECT * FROM sites WHERE status = ? ORDER BY created_at DESC')
          .bind(status)
          .all()
        return core.json({ rows: rows.results ?? [] })
      },
      POST: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const { siteSchema } = await import('../../../nippo/validation')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const body = (await core.readJson(request)) as Record<string, unknown> | null
        const areaRaw = body?.totalAreaM2
        const parsed = siteSchema.safeParse({
          name: String(body?.name ?? ''),
          address: String(body?.address ?? '') || undefined,
          totalAreaM2:
            areaRaw === null || areaRaw === undefined || areaRaw === '' ? null : Number(areaRaw),
        })
        if (!parsed.success) {
          return core.json({ message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }, 400)
        }

        const id = core.uuid()
        const token = core.randomToken(21)
        const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
        await core
          .requireDB()
          .prepare(
            "INSERT INTO sites (id, token, name, address, total_area_m2, status, opened_on, created_at) VALUES (?,?,?,?,?,'active',?,?)",
          )
          .bind(
            id,
            token,
            parsed.data.name,
            parsed.data.address ?? null,
            parsed.data.totalAreaM2 ?? null,
            today,
            core.nowIso(),
          )
          .run()

        return core.json({ id, token })
      },
    },
  },
})
