import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button, Input, Textarea, ConfirmDialog } from '../../nippo/ui'
import { compressPhoto, formatBytes } from '../../nippo/photo'
import { PaintScreen, type PaintResult } from '../../nippo/paint'
import { MAX_PHOTOS_PER_REPORT } from '../../nippo/validation'
import { cn, jfetch, todayJst, formatDateWithWeekday, formatNumber } from '../../nippo/utils'

export const Route = createFileRoute('/r/$token')({
  component: SiteReportPage,
})

const INSTALL_DISMISS_KEY = 'nippo_install_dismissed'

type SiteData = {
  site: { name: string }
  sub: { name: string }
  workTypes: string[]
  paint: { drawingKey: string; scaleMPerUnit: number; maskKeys: string[] } | null
}

type PhotoItem = {
  id: string
  previewUrl: string
  file: File | null
  bytes: number
  status: 'compressing' | 'ready' | 'uploading' | 'uploaded' | 'error'
  objectKey?: string
}

type Draft = {
  workDate: string
  workers: number
  workType: string
  isOther: boolean
  otherText: string
  area: string
  note: string
  reportId: string
  objectKeys: string[]
}

type Submitted = {
  workDate: string
  workers: number
  workType: string
  area: string
  note: string
  photoCount: number
}

function SiteReportPage() {
  const { token } = Route.useParams()
  const [state, setState] = React.useState<
    | { kind: 'loading' }
    | { kind: 'blocked'; status: number; message: string }
    | { kind: 'ready'; data: SiteData }
  >({ kind: 'loading' })

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await jfetch<SiteData>(`/api/rsite?token=${encodeURIComponent(token)}`)
      if (cancelled) return
      if (res.ok) setState({ kind: 'ready', data: res.data })
      else setState({ kind: 'blocked', status: res.status, message: res.message })
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  if (state.kind === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-slate-500">読み込み中…</p>
      </main>
    )
  }

  if (state.kind === 'blocked') {
    const offline = state.status === 0 || state.status === 503 || state.status === 429
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="text-4xl">{offline ? '📡' : '🚧'}</div>
          <p className="mt-4 text-lg font-semibold text-slate-900">{state.message}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {offline
              ? '電波の良い場所で、画面を再読み込みしてください。'
              : 'お手数ですが、元請の担当者にご連絡ください。'}
          </p>
          {offline && (
            <Button className="mt-5 w-full" onClick={() => window.location.reload()}>
              再読み込み
            </Button>
          )}
        </div>
      </main>
    )
  }

  return (
    <>
      <ReportForm token={token} data={state.data} />
      <InstallPrompt />
    </>
  )
}

// ---------------- 入力フォーム ----------------

function ReportForm({ token, data }: { token: string; data: SiteData }) {
  const draftKey = `nippo_draft_${token}`
  const { workTypes } = data

  const [workDate, setWorkDate] = React.useState(todayJst)
  const [workers, setWorkers] = React.useState(1)
  const [workType, setWorkType] = React.useState('')
  const [isOther, setIsOther] = React.useState(false)
  const [otherText, setOtherText] = React.useState('')
  const [area, setArea] = React.useState('')
  const [note, setNote] = React.useState('')
  const [photos, setPhotos] = React.useState<PhotoItem[]>([])
  const [reportId, setReportId] = React.useState('')
  const [paintOpen, setPaintOpen] = React.useState(false)
  const [paintResult, setPaintResult] = React.useState<PaintResult | null>(null)
  const [confirm, setConfirm] = React.useState<null | 'area' | 'duplicate'>(null)
  const [duplicateCount, setDuplicateCount] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [hasDraft, setHasDraft] = React.useState(false)
  const [submitted, setSubmitted] = React.useState<Submitted | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setReportId(crypto.randomUUID())
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const d = JSON.parse(raw) as Draft
        setWorkDate(d.workDate ?? todayJst())
        setWorkers(d.workers ?? 1)
        setWorkType(d.workType ?? '')
        setIsOther(Boolean(d.isOther))
        setOtherText(d.otherText ?? '')
        setArea(d.area ?? '')
        setNote(d.note ?? '')
        if (d.reportId) setReportId(d.reportId)
        setPhotos(
          (d.objectKeys ?? []).map((key) => ({
            id: key,
            previewUrl: '',
            file: null,
            bytes: 0,
            status: 'uploaded' as const,
            objectKey: key,
          })),
        )
        setHasDraft(true)
      }
    } catch {
      /* localStorage不可の環境では無視 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const effectiveWorkType = isOther ? otherText.trim() : workType

  function saveDraft() {
    try {
      const draft: Draft = {
        workDate,
        workers,
        workType,
        isOther,
        otherText,
        area,
        note,
        reportId,
        objectKeys: photos.filter((p) => p.objectKey).map((p) => p.objectKey!),
      }
      localStorage.setItem(draftKey, JSON.stringify(draft))
      setHasDraft(true)
    } catch {
      /* noop */
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey)
    } catch {
      /* noop */
    }
    setHasDraft(false)
  }

  async function handleAddPhotos(files: File[]) {
    const items: PhotoItem[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(f),
      file: null,
      bytes: f.size,
      status: 'compressing',
    }))
    setPhotos((prev) => [...prev, ...items].slice(0, MAX_PHOTOS_PER_REPORT))

    await Promise.all(
      items.map(async (item, i) => {
        try {
          const compressed = await compressPhoto(files[i])
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, file: compressed, bytes: compressed.size, status: 'ready' } : p,
            ),
          )
        } catch {
          setPhotos((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: 'error' } : p)))
        }
      }),
    )
  }

  function handleRemovePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  function validate(): string | null {
    if (!effectiveWorkType) return '作業内容を選択してください'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return '日付を入力してください'
    if (workers < 1 || workers > 99) return '人数は1〜99人で入力してください'
    if (area.trim() !== '') {
      const n = Number(area)
      if (!Number.isFinite(n) || n < 0) return '施工面積は0以上の数値で入力してください'
    }
    if (photos.some((p) => p.status === 'compressing')) return '写真の処理中です。少しお待ちください'
    return null
  }

  async function attemptSubmit(opts: { areaOk?: boolean; dupOk?: boolean } = {}) {
    setError('')
    const message = validate()
    if (message) {
      setError(message)
      return
    }
    if (!opts.areaOk && area.trim() === '') {
      setConfirm('area')
      return
    }
    if (!opts.dupOk) {
      const res = await jfetch<{ exists?: boolean; count?: number }>(
        `/api/rduplicate?token=${encodeURIComponent(token)}&workDate=${encodeURIComponent(workDate)}`,
      )
      if (res.ok && res.data.exists) {
        setDuplicateCount(res.data.count ?? 1)
        setConfirm('duplicate')
        return
      }
    }
    await doSubmit()
  }

  async function doSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const keys: string[] = []
      for (const photo of photos) {
        if (photo.objectKey) {
          keys.push(photo.objectKey)
          continue
        }
        if (!photo.file) continue

        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'uploading' } : p)))
        const form = new FormData()
        form.append('token', token)
        form.append('reportId', reportId)
        form.append('file', photo.file)
        const up = await jfetch<{ objectKey: string }>('/api/rphoto', { method: 'POST', body: form })
        if (!up.ok) {
          setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'error' } : p)))
          throw new Error(up.status === 0 ? '写真のアップロードに失敗しました' : up.message)
        }
        keys.push(up.data.objectKey)
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, status: 'uploaded', objectKey: up.data.objectKey } : p)),
        )
      }

      // 色塗りマスクのアップロード (任意)
      let paintRegion: { objectKey: string; areaM2: number; width: number; height: number } | undefined
      if (paintResult) {
        const form = new FormData()
        form.append('token', token)
        form.append('reportId', reportId)
        form.append('file', new File([paintResult.blob], 'mask.png', { type: 'image/png' }))
        const up = await jfetch<{ objectKey: string }>('/api/rmask', { method: 'POST', body: form })
        if (!up.ok) {
          throw new Error(up.status === 0 ? '色塗りデータの送信に失敗しました' : up.message)
        }
        paintRegion = {
          objectKey: up.data.objectKey,
          areaM2: paintResult.areaM2,
          width: paintResult.width,
          height: paintResult.height,
        }
      }

      const payload = {
        token,
        reportId,
        workDate,
        workers,
        workType: effectiveWorkType,
        areaM2: area.trim() === '' ? undefined : Number(area),
        note: note.trim() === '' ? undefined : note.trim(),
        objectKeys: keys,
        paintRegion,
      }
      const res = await jfetch<{ id: string }>('/api/rreport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(res.message)

      clearDraft()
      setSubmitted({
        workDate,
        workers,
        workType: effectiveWorkType,
        area: area.trim(),
        note: note.trim(),
        photoCount: keys.length,
      })
    } catch (e) {
      saveDraft()
      setError(e instanceof Error ? e.message : '送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  function startNext() {
    setSubmitted(null)
    setReportId(crypto.randomUUID())
    setWorkers(1)
    setWorkType('')
    setIsOther(false)
    setOtherText('')
    setArea('')
    setNote('')
    photos.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    setPhotos([])
    setPaintResult(null)
    setError('')
    window.scrollTo({ top: 0 })
  }

  if (submitted) {
    return (
      <main className="mx-auto min-h-dvh max-w-md p-4">
        <div className="rounded-xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
          <div className="text-5xl">✅</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">送信しました</h1>
          <p className="mt-1 text-sm text-slate-600">{data.site.name}</p>
          <dl className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200 text-left text-sm">
            <SummaryRow label="日付" value={formatDateWithWeekday(submitted.workDate)} />
            <SummaryRow label="業者" value={data.sub.name} />
            <SummaryRow label="人数" value={`${submitted.workers} 人`} />
            <SummaryRow label="作業内容" value={submitted.workType} />
            <SummaryRow label="施工面積" value={submitted.area ? `${submitted.area} m²` : '—'} />
            <SummaryRow label="写真" value={`${submitted.photoCount} 枚`} />
            {submitted.note && <SummaryRow label="備考" value={submitted.note} />}
          </dl>
          <Button size="lg" className="mt-6 w-full" onClick={startNext}>
            続けて入力
          </Button>
        </div>
      </main>
    )
  }

  const remaining = MAX_PHOTOS_PER_REPORT - photos.length

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-28">
      <header className="sticky top-0 z-10 border-b border-sky-700 bg-sky-600 px-4 py-3 text-white shadow-sm">
        <p className="text-[11px] leading-none text-sky-100">現場</p>
        <h1 className="mt-1 truncate text-lg font-bold leading-tight">{data.site.name}</h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] leading-none text-sky-50">
          <span className="rounded bg-sky-700/70 px-1.5 py-0.5 text-[11px]">業者</span>
          <span className="truncate font-semibold">{data.sub.name}</span>
        </p>
      </header>

      <div className="space-y-5 p-4">
        {hasDraft && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            前回送信できなかった内容を復元しました。内容を確認して再送してください。
          </div>
        )}

        <Field label="日付">
          <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
        </Field>

        <Field label="人数">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 text-2xl"
              aria-label="1人減らす"
              onClick={() => setWorkers((n) => Math.max(1, n - 1))}
            >
              −
            </Button>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={workers}
              onChange={(e) => {
                const n = Number(e.target.value)
                setWorkers(Number.isFinite(n) ? Math.min(99, Math.max(1, Math.trunc(n))) : 1)
              }}
              className="h-14 flex-1 text-center text-2xl font-bold"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 text-2xl"
              aria-label="1人増やす"
              onClick={() => setWorkers((n) => Math.min(99, n + 1))}
            >
              ＋
            </Button>
          </div>
        </Field>

        <Field label="作業内容">
          <div className="flex flex-wrap gap-2">
            {workTypes.map((wt) => (
              <button
                key={wt}
                type="button"
                onClick={() => {
                  setWorkType(wt)
                  setIsOther(false)
                }}
                className={cn(
                  'rounded-full border px-4 py-2.5 text-sm',
                  !isOther && workType === wt
                    ? 'border-sky-600 bg-sky-600 font-semibold text-white'
                    : 'border-slate-300 bg-white text-slate-700',
                )}
              >
                {wt}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsOther(true)}
              className={cn(
                'rounded-full border px-4 py-2.5 text-sm',
                isOther
                  ? 'border-sky-600 bg-sky-600 font-semibold text-white'
                  : 'border-slate-300 bg-white text-slate-700',
              )}
            >
              その他
            </button>
          </div>
          {isOther && (
            <Input
              className="mt-2"
              placeholder="作業内容を入力"
              maxLength={100}
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
            />
          )}
        </Field>

        <Field label="施工面積 (m²)" hint="任意">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            placeholder="例: 120.5"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
          {data.paint && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setPaintOpen(true)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm',
                  paintResult
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-sky-300 bg-sky-50 text-sky-900',
                )}
              >
                <span className="font-medium">
                  {paintResult
                    ? `🖌 塗り済み: 約 ${formatNumber(paintResult.areaM2, 1)} m²（タップで塗り直す）`
                    : '🖌 図面を塗って面積を測る'}
                </span>
                <span className="text-slate-400">›</span>
              </button>
              {paintResult && (
                <button
                  type="button"
                  onClick={() => setPaintResult(null)}
                  className="mt-1 text-xs text-slate-500 underline"
                >
                  塗りを取り消す
                </button>
              )}
            </div>
          )}
        </Field>

        <Field label="写真" hint="任意">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
              >
                {p.previewUrl ? (
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">📷</div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">
                  {p.status === 'compressing' && '圧縮中…'}
                  {p.status === 'ready' && formatBytes(p.bytes)}
                  {p.status === 'uploading' && '送信中…'}
                  {p.status === 'uploaded' && '✓ 送信済'}
                  {p.status === 'error' && '失敗'}
                </div>
                {!submitting && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(p.id)}
                    aria-label="写真を削除"
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {remaining > 0 && !submitting && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-white text-slate-500"
              >
                <span className="text-2xl">📷</span>
                <span className="text-xs">写真を追加</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, remaining)
              if (files.length > 0) void handleAddPhotos(files)
              e.target.value = ''
            }}
          />
          <p className="mt-2 text-xs text-slate-500">最大{MAX_PHOTOS_PER_REPORT}枚。自動で縮小してから送信します。</p>
        </Field>

        <Field label="備考" hint="任意">
          <Textarea
            placeholder="連絡事項があれば入力"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
            <p className="mt-1 text-xs text-red-700">
              入力内容は端末に保存しました。電波の良い場所で「再送する」を押してください。
            </p>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button size="lg" className="w-full text-lg" disabled={submitting} onClick={() => attemptSubmit()}>
            {submitting ? '送信中…' : error ? '再送する' : '送信する'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'area'}
        title="面積なしで送信しますか?"
        message="施工面積が未入力です。このまま送信してよろしいですか?"
        confirmLabel="このまま送信"
        cancelLabel="入力に戻る"
        onConfirm={() => {
          setConfirm(null)
          void attemptSubmit({ areaOk: true })
        }}
        onCancel={() => setConfirm(null)}
      />
      {paintOpen && data.paint && (
        <PaintScreen
          drawingUrl={`/api/rfile?token=${encodeURIComponent(token)}&key=${encodeURIComponent(data.paint.drawingKey)}`}
          prevMaskUrls={data.paint.maskKeys.map(
            (key) => `/api/rfile?token=${encodeURIComponent(token)}&key=${encodeURIComponent(key)}`,
          )}
          scaleMPerUnit={data.paint.scaleMPerUnit}
          onConfirm={(result) => {
            setPaintResult(result)
            setArea(String(result.areaM2))
            setPaintOpen(false)
          }}
          onClose={() => setPaintOpen(false)}
        />
      )}

      <ConfirmDialog
        open={confirm === 'duplicate'}
        title="同じ日の日報があります"
        message={`この現場・業者・日付の日報が既に${duplicateCount}件提出されています。追加で送信しますか?`}
        confirmLabel="このまま送信"
        cancelLabel="入力に戻る"
        onConfirm={() => {
          setConfirm(null)
          void attemptSubmit({ areaOk: true, dupOk: true })
        }}
        onCancel={() => setConfirm(null)}
      />
    </main>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[15px] font-semibold text-slate-800">{label}</span>
        {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <dt className="w-20 shrink-0 text-slate-500">{label}</dt>
      <dd className="flex-1 break-words font-medium text-slate-900">{value}</dd>
    </div>
  )
}

// ---------------- 「ホーム画面に追加」バナー ----------------

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function InstallPrompt() {
  const [visible, setVisible] = React.useState(false)
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [isIos, setIsIos] = React.useState(false)

  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* 失敗しても機能に影響しない */
      })
    }
  }, [])

  React.useEffect(() => {
    try {
      if (localStorage.getItem(INSTALL_DISMISS_KEY)) return
    } catch {
      return
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return

    const ua = window.navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)
    setIsIos(ios)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    const timer = ios ? window.setTimeout(() => setVisible(true), 3000) : undefined
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1')
    } catch {
      /* noop */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-20 z-20 mx-auto max-w-md px-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-semibold text-slate-900">ホーム画面に追加すると便利です</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          {isIos
            ? '画面下の「共有」→「ホーム画面に追加」でアプリのように開けます。'
            : '次回からワンタップでこの現場の日報を開けます。'}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={dismiss}>
            閉じる
          </Button>
          {!isIos && deferred && (
            <Button
              size="sm"
              onClick={async () => {
                await deferred.prompt()
                await deferred.userChoice.catch(() => null)
                dismiss()
              }}
            >
              追加する
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
