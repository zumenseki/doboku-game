import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardBody, CardHeader, CardTitle, Input, ErrorBox } from '../../nippo/ui'
import { jfetch, todayJst, formatDateWithWeekday, formatJstDateTime, formatNumber } from '../../nippo/utils'

export const Route = createFileRoute('/admin/')({
  component: DashboardPage,
})

type Assignment = { id: string; site_id: string; sub_id: string; sub_name: string }
type Report = {
  id: string
  site_id: string
  sub_id: string
  workers: number
  area_m2: number | null
  work_type: string
  created_at: string
}
type DashboardData = {
  sites: { id: string; name: string }[]
  assignments: Assignment[]
  reports: Report[]
}

function DashboardPage() {
  const [date, setDate] = React.useState(todayJst)
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await jfetch<DashboardData>(`/api/admin/dashboard?date=${date}`)
      if (cancelled) return
      if (res.ok) setData(res.data)
      else setError(res.message)
    })()
    return () => {
      cancelled = true
    }
  }, [date])

  const sites = data?.sites ?? []
  const reports = data?.reports ?? []
  const assignments = data?.assignments ?? []

  // 現場ごとに「割り当て業者 × その日の提出有無」を組み立てる
  const reportKey = (siteId: string, subId: string) => `${siteId}|${subId}`
  const byPair = new Map<string, Report[]>()
  for (const r of reports) {
    const k = reportKey(r.site_id, r.sub_id)
    const list = byPair.get(k) ?? []
    list.push(r)
    byPair.set(k, list)
  }
  const assignBySite = new Map<string, Assignment[]>()
  for (const a of assignments) {
    const list = assignBySite.get(a.site_id) ?? []
    list.push(a)
    assignBySite.set(a.site_id, list)
  }

  const totalWorkers = reports.reduce((a, r) => a + r.workers, 0)
  const totalArea = reports.reduce((a, r) => a + (r.area_m2 ?? 0), 0)
  const submittedPairs = assignments.filter((a) => (byPair.get(reportKey(a.site_id, a.sub_id))?.length ?? 0) > 0)

  // 未提出の多い現場を上に
  const ordered = [...sites].sort((a, b) => {
    const pending = (sid: string) =>
      (assignBySite.get(sid) ?? []).filter((x) => (byPair.get(reportKey(sid, x.sub_id))?.length ?? 0) === 0).length
    return pending(b.id) - pending(a.id) || a.name.localeCompare(b.name, 'ja')
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          提出状況{' '}
          <span className="text-base font-normal text-slate-600">{formatDateWithWeekday(date)}</span>
        </h1>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setDate(e.target.value)
          }}
          className="h-9 w-44"
          aria-label="表示する日付"
        />
      </div>

      <ErrorBox>{error}</ErrorBox>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="日報件数" value={`${formatNumber(reports.length)} 件`} />
        <Stat label="延べ人数" value={`${formatNumber(totalWorkers)} 人`} />
        <Stat label="施工面積" value={`${formatNumber(totalArea, 1)} m²`} />
        <Stat
          label="提出済みの業者"
          value={`${submittedPairs.length} / ${assignments.length}`}
          accent={submittedPairs.length < assignments.length}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>稼働中の現場（{sites.length}件）</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {data && sites.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">
              稼働中の現場がありません。
              <Link to="/admin/sites" className="ml-1 text-sky-700 hover:underline">
                現場管理から作成
              </Link>
            </p>
          )}
          {ordered.map((site) => {
            const list = assignBySite.get(site.id) ?? []
            const done = list.filter((a) => (byPair.get(reportKey(site.id, a.sub_id))?.length ?? 0) > 0)
            return (
              <div key={site.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/admin/site/$id"
                    params={{ id: site.id }}
                    className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
                  >
                    {site.name}
                  </Link>
                  {list.length === 0 ? (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                      業者未割当
                    </span>
                  ) : (
                    <span
                      className={
                        done.length === list.length
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800'
                          : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900'
                      }
                    >
                      {done.length} / {list.length} 社 提出
                    </span>
                  )}
                </div>

                {list.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    この現場にはまだ業者が割り当てられていません（日報URLが未発行です）
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {list.map((a) => {
                      const rs = byPair.get(reportKey(site.id, a.sub_id)) ?? []
                      const submitted = rs.length > 0
                      return (
                        <li
                          key={a.id}
                          className={
                            submitted
                              ? 'rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-slate-700'
                              : 'rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900'
                          }
                          title={submitted ? `提出 ${formatJstDateTime(rs[0].created_at)}` : '未提出'}
                        >
                          <span className="font-medium text-slate-900">{a.sub_name}</span>
                          {submitted ? (
                            <span className="ml-1 text-slate-600">
                              {rs.reduce((n, r) => n + r.workers, 0)}人 / {rs.map((r) => r.work_type).join('・')}
                            </span>
                          ) : (
                            <span className="ml-1 font-semibold">未提出</span>
                          )}
                        </li>
                      )
                    })}
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
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
