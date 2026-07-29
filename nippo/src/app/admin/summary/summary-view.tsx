'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { downloadCsv, toCsv } from '@/lib/csv'
import { cn, formatNumber } from '@/lib/utils'

export type SummaryRow = { name: string; reports: number; workers: number; area: number }

type TabKey = 'site' | 'sub' | 'workType'

const TABS: { key: TabKey; label: string; column: string }[] = [
  { key: 'site', label: '現場別', column: '現場名' },
  { key: 'sub', label: '業者別', column: '業者名' },
  { key: 'workType', label: '工種別', column: '作業内容' },
]

export function SummaryView({
  month,
  bySite,
  bySub,
  byWorkType,
  totals,
}: {
  month: string
  bySite: SummaryRow[]
  bySub: SummaryRow[]
  byWorkType: SummaryRow[]
  totals: { reports: number; workers: number; area: number }
}) {
  const router = useRouter()
  const [tab, setTab] = React.useState<TabKey>('site')

  const data = tab === 'site' ? bySite : tab === 'sub' ? bySub : byWorkType
  const meta = TABS.find((t) => t.key === tab)!

  function exportCsv() {
    const csv = toCsv(
      [meta.column, '日報件数', '延べ人数', '施工面積(m2)'],
      data.map((r) => [r.name, r.reports, r.workers, r.area === 0 ? '' : r.area]),
    )
    downloadCsv(`集計_${month}_${meta.label}.csv`, csv)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">集計</h1>

      <Card>
        <CardBody className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="month">対象月</Label>
            <Input
              id="month"
              type="month"
              defaultValue={month}
              className="mt-1 w-44"
              onChange={(e) => {
                if (/^\d{4}-\d{2}$/.test(e.target.value)) {
                  router.push(`/admin/summary?month=${e.target.value}`)
                }
              }}
            />
          </div>
          <dl className="flex flex-wrap gap-6 text-sm">
            <Stat label="日報件数" value={`${formatNumber(totals.reports)} 件`} />
            <Stat label="延べ人数" value={`${formatNumber(totals.workers)} 人`} />
            <Stat label="施工面積" value={`${formatNumber(totals.area, 1)} m²`} />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center gap-2">
          <div className="mr-auto flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm',
                  tab === t.key ? 'bg-sky-600 font-semibold text-white' : 'bg-slate-100 text-slate-700',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={data.length === 0}>
            CSV出力
          </Button>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">{meta.column}</th>
                <th className="w-32 px-4 py-2 text-right font-medium">日報件数</th>
                <th className="w-32 px-4 py-2 text-right font-medium">延べ人数</th>
                <th className="w-36 px-4 py-2 text-right font-medium">施工面積(m²)</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    この月の日報はありません
                  </td>
                </tr>
              )}
              {data.map((row) => (
                <tr key={row.name} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(row.reports)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(row.workers)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {row.area === 0 ? '—' : formatNumber(row.area, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-4 py-2">合計</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(totals.reports)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(totals.workers)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(totals.area, 1)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardBody>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-bold text-slate-900">{value}</dd>
    </div>
  )
}
