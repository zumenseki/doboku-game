import { supabaseServer } from '@/lib/supabase/server'
import { ReportsView } from './reports-view'
import type { ReportRow } from '@/lib/types'
import { currentMonth, monthRange } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 100

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const defaults = monthRange(currentMonth())

  const filters = {
    from: sp.from ?? defaults.from,
    to: sp.to ?? defaults.to,
    siteId: sp.siteId ?? '',
    subId: sp.subId ?? '',
    workType: sp.workType ?? '',
  }
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await supabaseServer()

  let query = supabase
    .from('reports')
    .select('*, sites(name), subs(name), report_photos(id, object_key)', { count: 'exact' })
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filters.from) query = query.gte('work_date', filters.from)
  if (filters.to) query = query.lte('work_date', filters.to)
  if (filters.siteId) query = query.eq('site_id', filters.siteId)
  if (filters.subId) query = query.eq('sub_id', filters.subId)
  if (filters.workType) query = query.eq('work_type', filters.workType)

  const [{ data, count }, sitesRes, subsRes, workTypesRes] = await Promise.all([
    query,
    supabase.from('sites').select('id, name').order('created_at', { ascending: false }),
    supabase.from('subs').select('id, name').order('display_order').order('name'),
    supabase.from('work_types').select('name').order('display_order').order('name'),
  ])

  return (
    <ReportsView
      reports={(data ?? []) as unknown as ReportRow[]}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      filters={filters}
      sites={sitesRes.data ?? []}
      subs={subsRes.data ?? []}
      workTypes={(workTypesRes.data ?? []).map((w) => w.name as string)}
    />
  )
}
