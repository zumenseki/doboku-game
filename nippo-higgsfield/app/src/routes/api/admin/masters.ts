import { createFileRoute } from '@tanstack/react-router'

const TABLES = { subs: 'subs', work_types: 'work_types' } as const
type TableKey = keyof typeof TABLES

// GET  /api/admin/masters?table=subs|work_types → { rows }
// POST /api/admin/masters {table, action: 'create'|'update'|'delete', ...}
export const Route = createFileRoute('/api/admin/masters')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const table = new URL(request.url).searchParams.get('table') as TableKey | null
        if (!table || !(table in TABLES)) return core.json({ message: 'テーブル指定が不正です' }, 400)

        const rows = await core
          .requireDB()
          .prepare(`SELECT * FROM ${TABLES[table]} ORDER BY display_order, name`)
          .all()
        return core.json({ rows: rows.results ?? [] })
      },
      POST: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const { masterSchema } = await import('../../../nippo/validation')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const body = (await core.readJson(request)) as Record<string, unknown> | null
        if (!body) return core.json({ message: 'リクエストが不正です' }, 400)
        const table = body.table as TableKey
        if (!(table in TABLES)) return core.json({ message: 'テーブル指定が不正です' }, 400)
        const action = String(body.action ?? '')
        const db = core.requireDB()
        const label = table === 'subs' ? '業者' : '工種'

        try {
          if (action === 'create' || action === 'update') {
            const parsed = masterSchema.safeParse({
              name: String(body.name ?? ''),
              displayOrder: Number(body.displayOrder ?? 0),
              isActive: body.isActive !== false,
            })
            if (!parsed.success) {
              return core.json({ message: parsed.error.issues[0]?.message }, 400)
            }
            if (action === 'create') {
              await db
                .prepare(
                  `INSERT INTO ${TABLES[table]} (id, name, display_order, is_active) VALUES (?,?,?,1)`,
                )
                .bind(core.uuid(), parsed.data.name, parsed.data.displayOrder)
                .run()
            } else {
              const id = String(body.id ?? '')
              await db
                .prepare(
                  `UPDATE ${TABLES[table]} SET name = ?, display_order = ?, is_active = ? WHERE id = ?`,
                )
                .bind(parsed.data.name, parsed.data.displayOrder, parsed.data.isActive ? 1 : 0, id)
                .run()
            }
            return core.json({ ok: true })
          }

          if (action === 'delete') {
            const id = String(body.id ?? '')
            if (table === 'subs') {
              const used = await db
                .prepare('SELECT COUNT(*) AS n FROM reports WHERE sub_id = ?')
                .bind(id)
                .first<{ n: number }>()
              if ((used?.n ?? 0) > 0) {
                return core.json(
                  { message: '日報で使用されているため削除できません。「無効」にしてください' },
                  400,
                )
              }
            }
            await db.prepare(`DELETE FROM ${TABLES[table]} WHERE id = ?`).bind(id).run()
            return core.json({ ok: true })
          }

          return core.json({ message: '操作が不正です' }, 400)
        } catch (e) {
          const message = e instanceof Error && e.message.includes('UNIQUE')
            ? `同じ名前の${label}が既にあります`
            : '処理に失敗しました'
          return core.json({ message }, 400)
        }
      },
    },
  },
})
