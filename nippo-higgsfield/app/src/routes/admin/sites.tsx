import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button, Input, Label, Card, CardBody, CardHeader, CardTitle, ErrorBox, SuccessBox } from '../../nippo/ui'
import { ImportExcel } from '../../nippo/import-excel'
import { DeleteSiteModal } from '../../nippo/site-delete'
import { cn, jfetch, formatJstDateTime } from '../../nippo/utils'

export const Route = createFileRoute('/admin/sites')({
  component: SitesPage,
})

type SiteRow = {
  id: string
  token: string
  name: string
  address: string | null
  drawing_key: string | null
  status: string
  opened_on: string | null
  closed_at: string | null
}

function SitesPage() {
  const [tab, setTab] = React.useState<'active' | 'closed'>('active')
  const [rows, setRows] = React.useState<SiteRow[] | null>(null)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [created, setCreated] = React.useState<{ id: string; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null)
  const [deleted, setDeleted] = React.useState('')
  const [reloadKey, setReloadKey] = React.useState(0)
  const formRef = React.useRef<HTMLFormElement>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await jfetch<{ rows: SiteRow[] }>(`/api/admin/sites?status=${tab}`)
      if (cancelled) return
      if (res.ok) setRows(res.data.rows)
      else setError(res.message)
    })()
    return () => {
      cancelled = true
    }
  }, [tab, reloadKey])

  async function createSite(fd: FormData) {
    setBusy(true)
    setError('')
    const name = String(fd.get('name') ?? '')
    const res = await jfetch<{ id: string; token: string }>('/api/admin/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        address: String(fd.get('address') ?? ''),
        totalAreaM2: String(fd.get('totalAreaM2') ?? '').trim(),
      }),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setCreated({ id: res.data.id, name })
    formRef.current?.reset()
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">現場管理</h1>

      <Card>
        <CardHeader>
          <CardTitle>現場を新規作成</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault()
              void createSite(new FormData(e.currentTarget))
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-56 flex-1">
              <Label htmlFor="site-name">現場名</Label>
              <Input id="site-name" name="name" required maxLength={120} className="mt-1" />
            </div>
            <div className="min-w-56 flex-1">
              <Label htmlFor="site-address">住所（任意）</Label>
              <Input id="site-address" name="address" maxLength={200} className="mt-1" />
            </div>
            <div className="w-44">
              <Label htmlFor="site-area">総施工面積 m²（任意）</Label>
              <Input id="site-area" name="totalAreaM2" type="number" min={0} step="0.1" className="mt-1" />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? '作成中…' : '作成する'}
            </Button>
          </form>

          <ErrorBox>{error}</ErrorBox>

          <div className="border-t border-slate-100 pt-3">
            <ImportExcel kind="sites" onDone={() => setReloadKey((k) => k + 1)} />
            <p className="mt-1 text-xs text-slate-500">
              一括登録した現場のURL/QRは、一覧の各現場の詳細ページから確認できます。
            </p>
          </div>

          {created && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">
                「{created.name}」を作成しました。
              </p>
              <p className="mt-1 text-sm text-emerald-900">
                次に<b>業者を割り当てる</b>と、業者ごとの日報URL・QRが発行されます。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/admin/site/$id" params={{ id: created.id }}>
                  <Button size="sm">業者を割り当てる（現場の詳細へ）</Button>
                </Link>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <SuccessBox>{deleted && `「${deleted}」を削除しました`}</SuccessBox>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <CardTitle className="mr-auto">現場一覧</CardTitle>
          <TabButton active={tab === 'active'} onClick={() => setTab('active')} label="稼働中" />
          <TabButton active={tab === 'closed'} onClick={() => setTab('closed')} label="終了" />
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">現場名</th>
                <th className="px-4 py-2 font-medium">住所</th>
                <th className="w-32 px-4 py-2 font-medium">開始日</th>
                <th className="w-40 px-4 py-2 font-medium">{tab === 'closed' ? '終了日時' : '図面'}</th>
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    {tab === 'closed' ? '終了した現場はありません' : '稼働中の現場はありません'}
                  </td>
                </tr>
              )}
              {(rows ?? []).map((site) => (
                <tr key={site.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link
                      to="/admin/site/$id"
                      params={{ id: site.id }}
                      className="text-sky-700 hover:underline"
                    >
                      {site.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{site.address ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{site.opened_on ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {tab === 'closed'
                      ? formatJstDateTime(site.closed_at) || '—'
                      : site.drawing_key
                        ? '登録済'
                        : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <Link
                        to="/admin/site/$id"
                        params={{ id: site.id }}
                        className="text-sm text-sky-700 hover:underline"
                      >
                        詳細
                      </Link>
                      <button
                        onClick={() => setDeleteTarget({ id: site.id, name: site.name })}
                        className="text-sm text-red-700 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {deleteTarget && (
        <DeleteSiteModal
          site={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(name) => {
            setDeleteTarget(null)
            setDeleted(name)
            setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-sm',
        active ? 'bg-sky-600 font-semibold text-white' : 'bg-slate-100 text-slate-700',
      )}
    >
      {label}
    </button>
  )
}
