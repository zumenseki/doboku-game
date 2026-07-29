import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateWithWeekday, formatJstDateTime, formatNumber, todayJst } from '@/lib/utils'
import { DateJump } from './date-jump'

export const dynamic = 'force-dynamic'

type TodayReport = {
  id: string
  site_id: string
  workers: number
  area_m2: number | null
  work_type: string
  created_at: string
  subs: { name: string } | { name: string }[] | null
}

function subName(rel: TodayReport['subs']): string {
  if (!rel) return '(不明)'
  return (Array.isArray(rel) ? rel[0]?.name : rel.name) ?? '(不明)'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const sp = await searchParams
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : todayJst()

  const supabase = await supabaseServer()
  const [sitesRes, reportsRes] = await Promise.all([
    supabase
      .from('sites')
      .select('id, name')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('reports')
      .select('id, site_id, workers, area_m2, work_type, created_at, subs(name)')
      .eq('work_date', date),
  ])

  const sites = sitesRes.data ?? []
  const reports = (reportsRes.data ?? []) as unknown as TodayReport[]

  const bySite = new Map<string, TodayReport[]>()
  for (const r of reports) {
    const list = bySite.get(r.site_id) ?? []
    list.push(r)
    bySite.set(r.site_id, list)
  }

  const submittedSites = sites.filter((s) => (bySite.get(s.id)?.length ?? 0) > 0)
  const totalWorkers = reports.reduce((a, r) => a + r.workers, 0)
  const totalArea = reports.reduce((a, r) => a + (r.area_m2 ?? 0), 0)

  // 未提出の現場を先に出す
  const ordered = [...sites].sort((a, b) => {
    const aHas = (bySite.get(a.id)?.length ?? 0) > 0 ? 1 : 0
    const bHas = (bySite.get(b.id)?.length ?? 0) > 0 ? 1 : 0
    return aHas - bHas || a.name.localeCompare(b.name, 'ja')
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          提出状況 <span className="text-base font-normal text-slate-600">{formatDateWithWeekday(date)}</span>
        </h1>
        <DateJump date={date} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="日報件数" value={`${formatNumber(reports.length)} 件`} />
        <Stat label="延べ人数" value={`${formatNumber(totalWorkers)} 人`} />
        <Stat label="施工面積" value={`${formatNumber(totalArea, 1)} m²`} />
        <Stat
          label="提出のあった現場"
          value={`${submittedSites.length} / ${sites.length}`}
          accent={submittedSites.length < sites.length}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>稼働中の現場（{sites.length}件）</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {sites.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">
              稼働中の現場がありません。
              <Link href="/admin/sites" className="ml-1 text-sky-700 hover:underline">
                現場管理から作成
              </Link>
            </p>
          )}

          {ordered.map((site) => {
            const list = bySite.get(site.id) ?? []
            return (
              <div
                key={site.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/sites/${site.id}`}
                    className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
                  >
                    {site.name}
                  </Link>
                  {list.length === 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                      未提出
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                      {list.length}件 / {formatNumber(list.reduce((a, r) => a + r.workers, 0))}人
                    </span>
                  )}
                </div>

                {list.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {list.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                        title={`提出 ${formatJstDateTime(r.created_at)}`}
                      >
                        <span className="font-medium text-slate-900">{subName(r.subs)}</span>
                        <span className="ml-1 text-slate-500">
                          {r.workers}人 / {r.work_type}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </CardBody>
      </Card>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-amber-600' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
