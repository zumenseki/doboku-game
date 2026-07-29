import { createFileRoute } from '@tanstack/react-router'

// GET /api/admin/summary?month=YYYY-MM → 現場別/業者別/工種別の集計
export const Route = createFileRoute('/api/admin/summary')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const month = new URL(request.url).searchParams.get('month') ?? ''
        if (!/^\d{4}-\d{2}$/.test(month)) return core.json({ message: '月の指定が不正です' }, 400)
        const from = `${month}-01`
        const to = `${month}-31`

        const db = core.requireDB()
        const agg = (groupExpr: string, joinSql: string) =>
          db
            .prepare(
              `SELECT ${groupExpr} AS name, COUNT(*) AS reports, SUM(r.workers) AS workers, SUM(COALESCE(r.area_m2, 0)) AS area
               FROM reports r ${joinSql}
               WHERE r.work_date >= ? AND r.work_date <= ?
               GROUP BY ${groupExpr}
               ORDER BY workers DESC, name`,
            )
            .bind(from, to)
            .all<{ name: string | null; reports: number; workers: number; area: number }>()

        const [bySite, bySub, byWorkType, totals] = await Promise.all([
          agg("COALESCE(s.name, '(不明)')", 'LEFT JOIN sites s ON s.id = r.site_id'),
          agg("COALESCE(b.name, '(不明)')", 'LEFT JOIN subs b ON b.id = r.sub_id'),
          agg('r.work_type', ''),
          db
            .prepare(
              'SELECT COUNT(*) AS reports, COALESCE(SUM(workers),0) AS workers, COALESCE(SUM(COALESCE(area_m2,0)),0) AS area FROM reports WHERE work_date >= ? AND work_date <= ?',
            )
            .bind(from, to)
            .first<{ reports: number; workers: number; area: number }>(),
        ])

        return core.json({
          bySite: bySite.results ?? [],
          bySub: bySub.results ?? [],
          byWorkType: byWorkType.results ?? [],
          totals: totals ?? { reports: 0, workers: 0, area: 0 },
        })
      },
    },
  },
})
