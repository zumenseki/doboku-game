import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button, Select, Label, Card, CardBody, CardHeader, CardTitle, ErrorBox, Modal } from '../../nippo/ui'
import { QrCode } from '../../nippo/qr'
import { CopyBtn, assignmentUrl } from '../../nippo/assignments'
import { cn, jfetch, toCsv, downloadCsv, formatNumber, todayJst } from '../../nippo/utils'

export const Route = createFileRoute('/admin/assignments')({
  component: AssignmentsPage,
})

type Row = {
  id: string
  token: string
  site_id: string
  site_name: string
  site_status: string
  sub_id: string
  sub_name: string
  sub_active: number
  report_count: number
  last_date: string | null
}

/** 現場×業者の割り当て（発行済み日報URL）の全体一覧 */
function AssignmentsPage() {
  const [status, setStatus] = React.useState<'active' | 'closed' | 'all'>('active')
  const [siteId, setSiteId] = React.useState('')
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [sites, setSites] = React.useState<{ id: string; name: string }[]>([])
  const [error, setError] = React.useState('')
  const [qr, setQr] = React.useState<Row | null>(null)
  const today = todayJst()

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const params = new URLSearchParams({ status })
      if (siteId) params.set('siteId', siteId)
      const res = await jfetch<{ rows: Row[] }>(`/api/admin/assignments?${params}`)
      if (cancelled) return
      if (res.ok) setRows(res.data.rows)
      else setError(res.message)
    })()
    return () => {
      cancelled = true
    }
  }, [status, siteId])

  React.useEffect(() => {
    void (async () => {
      const res = await jfetch<{ rows: { id: string; name: string }[] }>('/api/admin/sites?status=active')
      if (res.ok) setSites(res.data.rows)
    })()
  }, [])

  const list = rows ?? []
  const bySite = new Map<string, Row[]>()
  for (const r of list) {
    const arr = bySite.get(r.site_id) ?? []
    arr.push(r)
    bySite.set(r.site_id, arr)
  }

  function exportCsv() {
    downloadCsv(
      `日報URL一覧_${today}.csv`,
      toCsv(
        ['現場名', '業者名', '状態', '提出件数', '最終提出日', '日報URL'],
        list.map((r) => [
          r.site_name,
          r.sub_name,
          r.site_status === 'active' ? '稼働中' : '終了',
          r.report_count,
          r.last_date ?? '',
          assignmentUrl(r.token),
        ]),
      ),
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">日報URL一覧（現場 × 業者）</h1>

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="st">現場の状態</Label>
            <Select
              id="st"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'closed' | 'all')}
              className="mt-1 w-40"
            >
              <option value="active">稼働中</option>
              <option value="closed">終了</option>
              <option value="all">すべて</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="si">現場</Label>
            <Select id="si" value={siteId} onChange={(e) => setSiteId(e.target.value)} className="mt-1 w-64">
              <option value="">すべて</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={list.length === 0}>
            CSV出力
          </Button>
          <span className="ml-auto text-sm text-slate-600">
            {formatNumber(list.length)} 件のURLを発行中
          </span>
        </CardBody>
      </Card>

      <ErrorBox>{error}</ErrorBox>

      {rows && list.length === 0 && (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-slate-500">
              発行済みのURLがありません。
              <Link to="/admin/sites" className="ml-1 text-sky-700 hover:underline">
                現場管理
              </Link>
              から現場を開き、業者を割り当ててください。
            </p>
          </CardBody>
        </Card>
      )}

      {[...bySite.entries()].map(([sid, group]) => (
        <Card key={sid}>
          <CardHeader className="flex flex-wrap items-center gap-2">
            <CardTitle className="mr-auto">
              <Link to="/admin/site/$id" params={{ id: sid }} className="text-sky-700 hover:underline">
                {group[0].site_name}
              </Link>
              <span className="ml-2 text-sm font-normal text-slate-500">{group.length}社</span>
            </CardTitle>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs',
                group[0].site_status === 'active'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-700',
              )}
            >
              {group[0].site_status === 'active' ? '稼働中' : '終了'}
            </span>
            <Link to="/admin/print/$id" params={{ id: sid }} target="_blank">
              <Button size="sm" variant="outline">
                QRまとめ印刷
              </Button>
            </Link>
          </CardHeader>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">業者</th>
                  <th className="px-3 py-2 font-medium">日報URL</th>
                  <th className="w-24 px-3 py-2 text-right font-medium">提出件数</th>
                  <th className="w-32 px-3 py-2 font-medium">最終提出日</th>
                  <th className="w-40 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {group.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {r.sub_name}
                      {r.sub_active !== 1 && (
                        <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                          無効
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <code className="block max-w-80 truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                        {assignmentUrl(r.token)}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.report_count)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.last_date ?? <span className="text-amber-600">未提出</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setQr(r)}>
                          QR
                        </Button>
                        <CopyBtn text={assignmentUrl(r.token)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ))}

      <Modal open={qr !== null} onClose={() => setQr(null)} title="日報URLのQRコード">
        {qr && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-600">
              {qr.site_name} ／ <b className="text-slate-900">{qr.sub_name}</b>
            </p>
            <div className="inline-block rounded-lg border border-slate-200 bg-white p-3">
              <QrCode value={assignmentUrl(qr.token)} size={200} />
            </div>
            <code className="block break-all rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-800">
              {assignmentUrl(qr.token)}
            </code>
          </div>
        )}
      </Modal>
    </div>
  )
}
