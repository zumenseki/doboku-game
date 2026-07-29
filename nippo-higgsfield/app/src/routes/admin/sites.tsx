import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button, Input, Label, Card, CardBody, CardHeader, CardTitle, ErrorBox } from '../../nippo/ui'
import { QrCode } from '../../nippo/qr'
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
  const [created, setCreated] = React.useState<{ id: string; token: string; name: string } | null>(null)
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
    setCreated({ id: res.data.id, token: res.data.token, name })
    formRef.current?.reset()
    setReloadKey((k) => k + 1)
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const createdUrl = created ? `${origin}/r/${created.token}` : ''

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
              {busy ? '作成中…' : '作成してQRを表示'}
            </Button>
          </form>

          <ErrorBox>{error}</ErrorBox>

          {created && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">
                「{created.name}」を作成しました。下のURL/QRを業者に配布してください。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="rounded-lg bg-white p-2">
                  <QrCode value={createdUrl} size={160} />
                </div>
                <div className="min-w-64 flex-1 space-y-2">
                  <code className="block break-all rounded bg-white px-2 py-1.5 text-xs text-slate-800">
                    {createdUrl}
                  </code>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={createdUrl} />
                    <Link to="/admin/print/$id" params={{ id: created.id }} target="_blank">
                      <Button size="sm" variant="outline">
                        A6印刷ビュー
                      </Button>
                    </Link>
                    <Link to="/admin/site/$id" params={{ id: created.id }}>
                      <Button size="sm" variant="ghost">
                        現場の詳細へ
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

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
                    <Link
                      to="/admin/site/$id"
                      params={{ id: site.id }}
                      className="text-sm text-sky-700 hover:underline"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
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

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('コピーしてください', text)
        }
      }}
    >
      {copied ? 'コピーしました' : 'URLをコピー'}
    </Button>
  )
}
