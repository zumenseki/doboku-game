import { createFileRoute } from '@tanstack/react-router'

// GET   /api/admin/site?id= → { site, reportCount }
// PATCH /api/admin/site {id, action: 'update'|'close'|'reopen'|'reissue', ...}
export const Route = createFileRoute('/api/admin/site')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const id = new URL(request.url).searchParams.get('id') ?? ''
        const db = core.requireDB()
        const site = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first()
        if (!site) return core.json({ message: '現場が見つかりません' }, 404)

        const count = await db
          .prepare('SELECT COUNT(*) AS n FROM reports WHERE site_id = ?')
          .bind(id)
          .first<{ n: number }>()
        return core.json({ site, reportCount: count?.n ?? 0 })
      },
      PATCH: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const { siteSchema } = await import('../../../nippo/validation')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const body = (await core.readJson(request)) as Record<string, unknown> | null
        if (!body) return core.json({ message: 'リクエストが不正です' }, 400)
        const id = String(body.id ?? '')
        const action = String(body.action ?? '')
        const db = core.requireDB()

        if (action === 'update') {
          const parsed = siteSchema.safeParse({
            name: String(body.name ?? ''),
            address: String(body.address ?? '') || undefined,
          })
          if (!parsed.success) {
            return core.json({ message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }, 400)
          }
          await db
            .prepare('UPDATE sites SET name = ?, address = ? WHERE id = ?')
            .bind(parsed.data.name, parsed.data.address ?? null, id)
            .run()
          return core.json({ ok: true })
        }

        if (action === 'close') {
          await db
            .prepare("UPDATE sites SET status = 'closed', closed_at = ? WHERE id = ?")
            .bind(core.nowIso(), id)
            .run()
          return core.json({ ok: true })
        }

        if (action === 'reopen') {
          await db
            .prepare("UPDATE sites SET status = 'active', closed_at = NULL WHERE id = ?")
            .bind(id)
            .run()
          return core.json({ ok: true })
        }

        if (action === 'reissue') {
          const token = core.randomToken(21)
          await db.prepare('UPDATE sites SET token = ? WHERE id = ?').bind(token, id).run()
          return core.json({ ok: true, token })
        }

        return core.json({ message: '操作が不正です' }, 400)
      },
    },
  },
})
