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
  Modal,
  ErrorBox,
  SuccessBox,
} from '../../nippo/ui'
import { QrCode } from '../../nippo/qr'
import { CopyButton } from './sites'
import { convertDrawing } from '../../nippo/drawing-convert'
import { MAX_DRAWING_BYTES } from '../../nippo/validation'
import { jfetch, formatJstDateTime, formatNumber } from '../../nippo/utils'

export const Route = createFileRoute('/admin/site/$id')({
  component: SiteDetailPage,
})

type PaintRow = { id: string; objectKey: string; areaM2: number; workDate: string; subName: string }

type SiteDetail = {
  site: {
    id: string
    token: string
    name: string
    address: string | null
    drawing_key: string | null
    drawing_image_key: string | null
    scale_m_per_unit: number | null
    total_area_m2: number | null
    status: string
    opened_on: string | null
    closed_at: string | null
  }
  reportCount: number
  paints: PaintRow[]
}

function SiteDetailPage() {
  const { id } = Route.useParams()
  const [data, setData] = React.useState<SiteDetail | null>(null)
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [confirm, setConfirm] = React.useState<null | 'close' | 'reopen' | 'reissue'>(null)
  const [uploading, setUploading] = React.useState(false)
  const [scaleOpen, setScaleOpen] = React.useState(false)
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
    if (file.size > MAX_DRAWING_BYTES) {
      setError('図面は10MBまでです')
      return
    }
    setUploading(true)
    try {
      const converted = await convertDrawing(file)
      const form = new FormData()
      form.append('siteId', id)
      form.append('image', new File([converted.png], 'drawing.png', { type: 'image/png' }))
      if (file.type === 'application/pdf') form.append('pdf', file)
      const res = await jfetch('/api/admin/drawing', { method: 'POST', body: form })
      if (!res.ok) throw new Error(res.message)
      setMessage('図面を登録しました。次に「縮尺を設定」してください')
      setReloadKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '図面の登録に失敗しました')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
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
  const drawingImageUrl = site.drawing_image_key
    ? `/api/admin/file?key=${encodeURIComponent(site.drawing_image_key)}`
    : null

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
                  {
                    action: 'update',
                    name: String(fd.get('name') ?? ''),
                    address: String(fd.get('address') ?? ''),
                    totalAreaM2: String(fd.get('totalAreaM2') ?? '').trim(),
                  },
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
              <div>
                <Label htmlFor="totalArea">総施工面積 (m²)</Label>
                <Input
                  id="totalArea"
                  name="totalAreaM2"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={site.total_area_m2 ?? ''}
                  placeholder="例: 3500"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-slate-500">色塗り進捗率の分母になります</p>
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
            <CardTitle>図面と縮尺</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleDrawingUpload(file)
                }}
              />
              <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? '変換中…' : site.drawing_image_key ? '図面を差し替える' : '図面をアップロード'}
              </Button>
              {site.drawing_image_key && (
                <Button size="sm" variant="outline" onClick={() => setScaleOpen(true)}>
                  縮尺を設定
                </Button>
              )}
              {site.drawing_key && (
                <a href={`/api/admin/drawing?siteId=${site.id}&kind=pdf`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost">
                    PDF原本を開く
                  </Button>
                </a>
              )}
              <span className="text-xs text-slate-500">PDFまたは画像 / 10MBまで</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <StatusChip ok={Boolean(site.drawing_image_key)} label="図面" />
              <StatusChip ok={Boolean(site.scale_m_per_unit)} label="縮尺" />
              <StatusChip ok={site.total_area_m2 !== null} label="総施工面積" />
              <span className="text-xs text-slate-500">
                3つ揃うと下請けフォームに「図面を塗って面積を測る」が表示されます
              </span>
            </div>

            {drawingImageUrl ? (
              <PaintOverlay
                drawingUrl={drawingImageUrl}
                paints={data.paints}
                scaleMPerUnit={site.scale_m_per_unit}
                totalAreaM2={site.total_area_m2}
              />
            ) : (
              <p className="text-sm text-slate-500">図面は未登録です。</p>
            )}
          </CardBody>
        </Card>
      </div>

      {scaleOpen && drawingImageUrl && (
        <ScaleModal
          drawingUrl={drawingImageUrl}
          currentScale={site.scale_m_per_unit}
          onClose={() => setScaleOpen(false)}
          onSave={(scaleMPerUnit) => {
            setScaleOpen(false)
            void patch({ action: 'scale', scaleMPerUnit }, '縮尺を設定しました')
          }}
        />
      )}

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

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800'
          : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600'
      }
    >
      {ok ? '✓' : '未'} {label}
    </span>
  )
}

/** 図面 + 全マスクの重ね表示と進捗率 (重複部分は1回だけ数える) */
function PaintOverlay({
  drawingUrl,
  paints,
  scaleMPerUnit,
  totalAreaM2,
}: {
  drawingUrl: string
  paints: PaintRow[]
  scaleMPerUnit: number | null
  totalAreaM2: number | null
}) {
  const [unionArea, setUnionArea] = React.useState<number | null>(null)
  const maskUrls = React.useMemo(
    () => paints.map((p) => `/api/admin/file?key=${encodeURIComponent(p.objectKey)}`),
    [paints],
  )

  React.useEffect(() => {
    if (!scaleMPerUnit || maskUrls.length === 0) {
      setUnionArea(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const imgs = await Promise.all(
          maskUrls.map(
            (u) =>
              new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image()
                img.onload = () => resolve(img)
                img.onerror = () => reject(new Error('mask load failed'))
                img.src = u
              }),
          ),
        )
        if (cancelled || imgs.length === 0) return
        const W = 800
        const H = Math.round((imgs[0].height / imgs[0].width) * W)
        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        for (const img of imgs) ctx.drawImage(img, 0, 0, W, H)
        const data = ctx.getImageData(0, 0, W, H).data
        let count = 0
        for (let i = 3; i < data.length; i += 4) if (data[i] > 96) count++
        const mPerPx = scaleMPerUnit / W
        if (!cancelled) setUnionArea(count * mPerPx * mPerPx)
      } catch {
        if (!cancelled) setUnionArea(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [maskUrls, scaleMPerUnit])

  const progress =
    unionArea !== null && totalAreaM2 && totalAreaM2 > 0
      ? Math.min(100, (unionArea / totalAreaM2) * 100)
      : null

  return (
    <div className="space-y-3">
      {paints.length > 0 && scaleMPerUnit && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span>
              塗り済み面積 (概算){' '}
              <strong className="tabular-nums">
                {unionArea === null ? '計算中…' : `${formatNumber(unionArea, 1)} m²`}
              </strong>
            </span>
            {totalAreaM2 !== null && (
              <span>
                総施工面積 <strong className="tabular-nums">{formatNumber(totalAreaM2, 1)} m²</strong>
              </span>
            )}
            {progress !== null && (
              <span>
                進捗率 <strong className="tabular-nums">{formatNumber(progress, 1)}%</strong>
              </span>
            )}
          </div>
          {progress !== null && (
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-sky-600" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="relative max-w-3xl overflow-hidden rounded-lg border border-slate-200">
        <img src={drawingUrl} alt="図面" className="block w-full" />
        {maskUrls.map((u) => (
          <img
            key={u}
            src={u}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full opacity-45"
          />
        ))}
      </div>

      {paints.length > 0 && (
        <table className="w-full max-w-3xl text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-1.5 font-medium">日付</th>
              <th className="px-3 py-1.5 font-medium">業者</th>
              <th className="px-3 py-1.5 text-right font-medium">塗った面積(m²)</th>
            </tr>
          </thead>
          <tbody>
            {paints.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-1.5">{p.workDate}</td>
                <td className="px-3 py-1.5">{p.subName}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(p.areaM2, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** 縮尺設定: 図面上の2点をクリック → 実際の距離(m)を入力 */
function ScaleModal({
  drawingUrl,
  currentScale,
  onClose,
  onSave,
}: {
  drawingUrl: string
  currentScale: number | null
  onClose: () => void
  onSave: (scaleMPerUnit: number) => void
}) {
  const [points, setPoints] = React.useState<{ nx: number; ny: number }[]>([])
  const [meters, setMeters] = React.useState('')
  const imgRef = React.useRef<HTMLImageElement>(null)

  function onClick(e: React.MouseEvent<HTMLImageElement>) {
    if (points.length >= 2) return
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    // 幅を1とした正規化座標 (yも幅基準にして縦横比を保つ)
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.width
    setPoints((prev) => [...prev, { nx, ny }])
  }

  const distNorm =
    points.length === 2
      ? Math.hypot(points[1].nx - points[0].nx, points[1].ny - points[0].ny)
      : 0
  const metersNum = Number(meters)
  const canSave = points.length === 2 && distNorm > 0.001 && Number.isFinite(metersNum) && metersNum > 0

  return (
    <Modal open onClose={onClose} title="縮尺を設定">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          図面上で<strong>実際の長さがわかる2点</strong>（寸法線の両端など）を順にクリックし、
          その実際の距離をメートルで入力してください。
          {currentScale && (
            <span className="ml-1 text-xs text-slate-500">(設定済み。やり直すと上書きされます)</span>
          )}
        </p>
        <div className="relative max-h-[50dvh] overflow-auto rounded-lg border border-slate-200">
          <img
            ref={imgRef}
            src={drawingUrl}
            alt="図面"
            className="block w-full cursor-crosshair select-none"
            onClick={onClick}
            draggable={false}
          />
          {points.map((p, i) => (
            <span
              key={i}
              className="pointer-events-none absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white"
              style={{
                left: `${p.nx * 100}%`,
                top: `${((p.ny * (imgRef.current?.clientWidth ?? 1)) / (imgRef.current?.clientHeight ?? 1)) * 100}%`,
              }}
            >
              {i + 1}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="scale-m">2点間の実際の距離 (m)</Label>
            <Input
              id="scale-m"
              type="number"
              min={0}
              step="0.01"
              placeholder="例: 25"
              value={meters}
              onChange={(e) => setMeters(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <Button variant="outline" size="sm" disabled={points.length === 0} onClick={() => setPoints([])}>
            点を選び直す
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          {points.length < 2 ? `あと${2 - points.length}点クリックしてください` : '距離を入力して保存してください'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button disabled={!canSave} onClick={() => onSave(metersNum / distNorm)}>
            保存
          </Button>
        </div>
      </div>
    </Modal>
  )
}
