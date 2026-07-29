import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Button,
  Input,
  Label,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  ErrorBox,
  SuccessBox,
} from '../../nippo/ui'
import { QrCode } from '../../nippo/qr'
import { CopyButton } from './sites'
import { MAX_DRAWING_BYTES } from '../../nippo/validation'
import { jfetch, formatJstDateTime } from '../../nippo/utils'

export const Route = createFileRoute('/admin/site/$id')({
  component: SiteDetailPage,
})

type SiteDetail = {
  site: {
    id: string
    token: string
    name: string
    address: string | null
    drawing_key: string | null
    status: string
    opened_on: string | null
    closed_at: string | null
  }
  reportCount: number
}

function SiteDetailPage() {
  const { id } = Route.useParams()
  const [data, setData] = React.useState<SiteDetail | null>(null)
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [confirm, setConfirm] = React.useState<null | 'close' | 'reopen' | 'reissue'>(null)
  const [uploading, setUploading] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await jfetch<SiteDetail>(`/api/admin/site?id=${id}`)
      if (cancelled) return
      if (res.ok) setData(res.data)
      else setError(res.message)
    })()
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  async function patch(body: Record<string, unknown>, okMessage: string) {
    setBusy(true)
    setError('')
    setMessage('')
    const res = await jfetch('/api/admin/site', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setMessage(okMessage)
    setReloadKey((k) => k + 1)
  }

  async function handleDrawingUpload(file: File) {
    setError('')
    setMessage('')
    if (file.type !== 'application/pdf') {
      setError('PDFファイルを選択してください')
      return
    }
    if (file.size > MAX_DRAWING_BYTES) {
      setError('図面PDFは10MBまでです')
      return
    }
    setUploading(true)
    const form = new FormData()
    form.append('siteId', id)
    form.append('file', file)
    const res = await jfetch('/api/admin/drawing', { method: 'POST', body: form })
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if (!res.ok) {
      setError(res.message)
      return
    }
    setMessage('図面をアップロードしました')
    setReloadKey((k) => k + 1)
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        {!error && <p className="text-sm text-slate-500">読み込み中…</p>}
      </div>
    )
  }

  const site = data.site
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}/r/${site.token}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">{site.name}</h1>
        {site.status === 'active' ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">稼働中</span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">終了</span>
        )}
        <Link to="/admin/sites" className="ml-auto text-sm text-sky-700 hover:underline">
          ← 現場一覧へ
        </Link>
      </div>

      <SuccessBox>{message}</SuccessBox>
      <ErrorBox>{error}</ErrorBox>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>日報入力URL / QR</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {site.status === 'closed' && (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
                この現場は終了済みです。URLを開いても入力できません。
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <QrCode value={url} size={160} />
              </div>
              <div className="min-w-56 flex-1 space-y-2">
                <code className="block break-all rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-800">
                  {url}
                </code>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={url} />
                  <Link to="/admin/print/$id" params={{ id: site.id }} target="_blank">
                    <Button size="sm" variant="outline">
                      A6印刷ビュー
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm('reissue')}>
                    トークン再発行
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>現場情報</CardTitle>
          </CardHeader>
          <CardBody>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                void patch(
                  { action: 'update', name: String(fd.get('name') ?? ''), address: String(fd.get('address') ?? '') },
                  '現場情報を更新しました',
                )
              }}
              className="space-y-3"
            >
              <div>
                <Label htmlFor="name">現場名</Label>
                <Input id="name" name="name" defaultValue={site.name} required maxLength={120} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="address">住所</Label>
                <Input id="address" name="address" defaultValue={site.address ?? ''} maxLength={200} className="mt-1" />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                <div>
                  <dt className="text-xs text-slate-500">開始日</dt>
                  <dd>{site.opened_on ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">日報件数</dt>
                  <dd>{data.reportCount} 件</dd>
                </div>
                {site.closed_at && (
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">終了日時</dt>
                    <dd>{formatJstDateTime(site.closed_at)}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" size="sm" disabled={busy}>
                  保存
                </Button>
                {site.status === 'active' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setConfirm('close')}
                  >
                    現場を終了する
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirm('reopen')}
                  >
                    受付を再開する
                  </Button>
                )}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>図面PDF</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleDrawingUpload(file)
                }}
              />
              <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? 'アップロード中…' : site.drawing_key ? '図面を差し替える' : '図面をアップロード'}
              </Button>
              {site.drawing_key && (
                <a href={`/api/admin/drawing?siteId=${site.id}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    図面を開く
                  </Button>
                </a>
              )}
              <span className="text-xs text-slate-500">PDF / 10MBまで</span>
            </div>
            {!site.drawing_key && <p className="text-sm text-slate-500">図面は未登録です。</p>}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'close'}
        title="現場を終了しますか?"
        message="終了するとこの現場のURLは即座に無効になり、業者は日報を送信できなくなります。"
        confirmLabel="終了する"
        destructive
        onConfirm={() => {
          setConfirm(null)
          void patch({ action: 'close' }, '現場を終了しました')
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        title="受付を再開しますか?"
        message="同じURLで再び日報を受け付けます。"
        confirmLabel="再開する"
        onConfirm={() => {
          setConfirm(null)
          void patch({ action: 'reopen' }, '受付を再開しました')
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reissue'}
        title="トークンを再発行しますか?"
        message="新しいURLが発行され、配布済みの旧URL・旧QRは使えなくなります。"
        confirmLabel="再発行する"
        destructive
        onConfirm={() => {
          setConfirm(null)
          void patch({ action: 'reissue' }, 'トークンを再発行しました。新しいQRを配布してください')
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
