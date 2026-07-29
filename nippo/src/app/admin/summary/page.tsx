import { supabaseServer } from '@/lib/supabase/server'
import { currentMonth, monthRange } from '@/lib/utils'
import { SummaryView, type SummaryRow } from './summary-view'

export const dynamic = 'force-dynamic'

type Joined = {
  workers: number
  area_m2: number | null
  work_type: string
  sites: { name: string } | { name: string }[] | null
  subs: { name: string } | { name: string }[] | null
}

function nameOf(rel: { name: string } | { name: string }[] | null): string {
  if (!rel) return '(不明)'
  return (Array.isArray(rel) ? rel[0]?.name : rel.name) ?? '(不明)'
}

function aggregate(rows: Joined[], keyOf: (r: Joined) => string): SummaryRow[] {
  const map = new Map<string, SummaryRow>()
  for (const row of rows) {
    const key = keyOf(row)
    const current = map.get(key) ?? { name: key, reports: 0, workers: 0, area: 0 }
    current.reports += 1
    current.workers += row.workers
    current.area += row.area_m2 ?? 0
    map.set(key, current)
  }
  return [...map.values()].sort((a, b) => b.workers - a.workers || a.name.localeCompare(b.name, 'ja'))
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const sp = await searchParams
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month! : currentMonth()
  const { from, to } = monthRange(month)

  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('reports')
    .select('workers, area_m2, work_type, sites(name), subs(name)')
    .gte('work_date', from)
    .lte('work_date', to)
    .limit(20000)

  const rows = (data ?? []) as unknown as Joined[]

  return (
    <SummaryView
      month={month}
      bySite={aggregate(rows, (r) => nameOf(r.sites))}
      bySub={aggregate(rows, (r) => nameOf(r.subs))}
      byWorkType={aggregate(rows, (r) => r.work_type)}
      totals={{
        reports: rows.length,
        workers: rows.reduce((a, r) => a + r.workers, 0),
        area: rows.reduce((a, r) => a + (r.area_m2 ?? 0), 0),
      }}
    />
  )
}
