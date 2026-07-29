'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { QrCode } from '@/components/qr-code'
import { CopyButton } from '@/components/copy-button'
import { MAX_DRAWING_BYTES } from '@/lib/validation'
import { formatJstDateTime } from '@/lib/utils'
import type { Site } from '@/lib/types'
import {
  closeSite,
  reopenSite,
  reissueToken,
  updateSite,
  presignDrawingUpload,
  saveDrawingKey,
  getDrawingUrl,
} from '../actions'

export function SiteDetail({
  site,
  appUrl,
  reportCount,
}: {
  site: Site
  appUrl: string
  reportCount: number
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const [confirm, setConfirm] = React.useState<null | 'close' | 'reopen' | 'reissue'>(null)
  const [uploading, setUploading] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const base = appUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  const url = `${base}/r/${site.token}`

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, okMessage: string) {
    setError('')
    setMessage('')
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.message ?? '処理に失敗しました')
      else {
        setMessage(okMessage)
        router.refresh()
      }
    })
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
    try {
      const presigned = await presignDrawingUpload(site.id, file.type, file.size)
      if (!presigned.ok) throw new Error(presigned.message)

      const put = await fetch(presigned.data!.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      })
      if (!put.ok) throw new Error('アップロードに失敗しました')

      const saved = await saveDrawingKey(site.id, presigned.data!.objectKey)
      if (!saved.ok) throw new Error(saved.message)

      setMessage('図面をアップロードしました')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function openDrawing() {
    setError('')
    const res = await getDrawingUrl(site.id)
    if (!res.ok) {
      setError(res.message)
      return
    }
    window.open(res.data!.url, '_blank', 'noopener')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">{site.name}</h1>
        {site.status === 'active' ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">稼働中</span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">終了</span>
        )}
        <Link href="/admin/sites" className="ml-auto text-sm text-sky-700 hover:underline">
          ← 現場一覧へ
        </Link>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

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
                  <CopyButton size="sm" variant="outline" text={url}>
                    URLをコピー
                  </CopyButton>
                  <Link href={`/admin/sites/${site.id}/print`} target="_blank">
                    <Button size="sm" variant="outline">
                      A6印刷ビュー
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setConfirm('reissue')}
                  >
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
              action={(fd) => run(() => updateSite(site.id, fd), '現場情報を更新しました')}
              className="space-y-3"
            >
              <div>
                <Label htmlFor="name">現場名</Label>
                <Input id="name" name="name" defaultValue={site.name} required maxLength={120} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="address">住所</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={site.address ?? ''}
                  maxLength={200}
                  className="mt-1"
                />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                <div>
                  <dt className="text-xs text-slate-500">開始日</dt>
                  <dd>{site.opened_on ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">日報件数</dt>
                  <dd>{reportCount} 件</dd>
                </div>
                {site.closed_at && (
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">終了日時</dt>
                    <dd>{formatJstDateTime(site.closed_at)}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" size="sm" disabled={pending}>
                  保存
                </Button>
                {site.status === 'active' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => setConfirm('close')}
                  >
                    現場を終了する
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
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
                <Button size="sm" variant="outline" onClick={openDrawing}>
                  図面を開く
                </Button>
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
          run(() => closeSite(site.id), '現場を終了しました')
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
          run(() => reopenSite(site.id), '受付を再開しました')
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
          run(() => reissueToken(site.id), 'トークンを再発行しました。新しいQRを配布してください')
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
