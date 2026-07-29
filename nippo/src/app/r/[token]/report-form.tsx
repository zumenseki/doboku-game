'use client'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/dialog'
import { SubPicker, type SubOption } from './sub-picker'
import { PhotoInput, compressPhoto, type PhotoItem } from './photo-input'
import { reportSchema, MAX_PHOTOS_PER_REPORT, PHOTO_CONTENT_TYPE } from '@/lib/validation'
import { cn, todayJst, formatDateWithWeekday } from '@/lib/utils'

const SUB_STORAGE_KEY = 'nippo_sub_id'
const OTHER = '__other__'

type Draft = {
  workDate: string
  subId: string
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
  subName: string
  workers: number
  workType: string
  area: string
  note: string
  photoCount: number
}

export function ReportForm({
  token,
  siteName,
  subs,
  workTypes,
}: {
  token: string
  siteName: string
  subs: SubOption[]
  workTypes: string[]
}) {
  const draftKey = `nippo_draft_${token}`

  const [workDate, setWorkDate] = React.useState(todayJst)
  const [subId, setSubId] = React.useState('')
  const [workers, setWorkers] = React.useState(1)
  const [workType, setWorkType] = React.useState('')
  const [isOther, setIsOther] = React.useState(false)
  const [otherText, setOtherText] = React.useState('')
  const [area, setArea] = React.useState('')
  const [note, setNote] = React.useState('')
  const [photos, setPhotos] = React.useState<PhotoItem[]>([])

  const [reportId, setReportId] = React.useState<string>('')
  const [confirm, setConfirm] = React.useState<null | 'area' | 'duplicate'>(null)
  const [duplicateCount, setDuplicateCount] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [hasDraft, setHasDraft] = React.useState(false)
  const [submitted, setSubmitted] = React.useState<Submitted | null>(null)

  // 初期化: 前回の業者 / 送信できなかった下書きを復元
  React.useEffect(() => {
    setReportId(crypto.randomUUID())
    try {
      const savedSub = localStorage.getItem(SUB_STORAGE_KEY)
      if (savedSub) setSubId(savedSub)

      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const d = JSON.parse(raw) as Draft
        setWorkDate(d.workDate ?? todayJst())
        if (d.subId) setSubId(d.subId)
        setWorkers(d.workers ?? 1)
        setWorkType(d.workType ?? '')
        setIsOther(Boolean(d.isOther))
        setOtherText(d.otherText ?? '')
        setArea(d.area ?? '')
        setNote(d.note ?? '')
        if (d.reportId) setReportId(d.reportId)
        // 写真の実体は復元できない（アップロード済みのキーのみ引き継ぐ）
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
      // localStorage が使えない環境では黙って無視する
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const effectiveWorkType = isOther ? otherText.trim() : workType

  function saveDraft() {
    try {
      const draft: Draft = {
        workDate,
        subId,
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
              p.id === item.id
                ? { ...p, file: compressed, bytes: compressed.size, status: 'ready' }
                : p,
            ),
          )
        } catch {
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, status: 'error', error: '圧縮に失敗しました' } : p,
            ),
          )
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
    if (!subId) return '業者を選択してください'
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

    // 面積未入力の確認（§6-1）
    if (!opts.areaOk && area.trim() === '') {
      setConfirm('area')
      return
    }

    // 同一「現場×業者×日付」の重複警告（送信自体は許可）
    if (!opts.dupOk) {
      try {
        const res = await fetch(
          `/api/r/${token}/duplicate?subId=${encodeURIComponent(subId)}&workDate=${encodeURIComponent(workDate)}`,
        )
        if (res.ok) {
          const json = (await res.json()) as { exists?: boolean; count?: number }
          if (json.exists) {
            setDuplicateCount(json.count ?? 1)
            setConfirm('duplicate')
            return
          }
        }
      } catch {
        // 確認できなくても送信は継続する
      }
    }

    await doSubmit()
  }

  async function doSubmit() {
    setSubmitting(true)
    setError('')
    try {
      // 1. 写真: 圧縮済みのものを presign → PUT
      const keys: string[] = []
      for (const photo of photos) {
        if (photo.objectKey) {
          keys.push(photo.objectKey)
          continue
        }
        if (!photo.file) continue

        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'uploading' } : p)))

        const presignRes = await fetch(`/api/r/${token}/presign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId,
            contentType: PHOTO_CONTENT_TYPE,
            size: photo.file.size,
          }),
        })
        if (!presignRes.ok) {
          const j = await presignRes.json().catch(() => ({}))
          throw new Error(j.message ?? '写真のアップロードに失敗しました')
        }
        const { uploadUrl, objectKey } = (await presignRes.json()) as {
          uploadUrl: string
          objectKey: string
        }

        let putOk = false
        try {
          const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': PHOTO_CONTENT_TYPE },
            body: photo.file,
          })
          putOk = putRes.ok
        } catch {
          // ネットワーク断・CORS等。fetchの生エラーを見せない
          putOk = false
        }
        if (!putOk) {
          setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'error' } : p)))
          throw new Error('写真のアップロードに失敗しました')
        }

        keys.push(objectKey)
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, status: 'uploaded', objectKey } : p)),
        )
      }

      // 2. 日報本体
      const payload = {
        reportId,
        workDate,
        subId,
        workers,
        workType: effectiveWorkType,
        areaM2: area.trim() === '' ? undefined : Number(area),
        note: note.trim() === '' ? undefined : note.trim(),
        objectKeys: keys,
      }
      const parsed = reportSchema.safeParse(payload)
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? '入力内容を確認してください')
      }

      const res = await fetch(`/api/r/${token}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message ?? '送信に失敗しました')
      }

      try {
        localStorage.setItem(SUB_STORAGE_KEY, subId)
      } catch {
        /* noop */
      }
      clearDraft()
      setSubmitted({
        workDate,
        subName: subs.find((s) => s.id === subId)?.name ?? '',
        workers,
        workType: effectiveWorkType,
        area: area.trim(),
        note: note.trim(),
        photoCount: keys.length,
      })
    } catch (e) {
      // 送信失敗: 下書きを保存して再送導線を出す（§8）
      saveDraft()
      // fetch自体の失敗(ネットワーク断)は生メッセージを見せない
      const message =
        e instanceof TypeError
          ? '送信できませんでした。電波の良い場所でお試しください'
          : e instanceof Error
            ? e.message
            : '送信に失敗しました'
      setError(message)
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
    setError('')
    window.scrollTo({ top: 0 })
  }

  // ---------- 完了画面 ----------
  if (submitted) {
    return (
      <main className="mx-auto min-h-dvh max-w-md p-4">
        <div className="rounded-xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
          <div className="text-5xl">✅</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">送信しました</h1>
          <p className="mt-1 text-sm text-slate-600">{siteName}</p>

          <dl className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200 text-left text-sm">
            <Row label="日付" value={formatDateWithWeekday(submitted.workDate)} />
            <Row label="業者" value={submitted.subName} />
            <Row label="人数" value={`${submitted.workers} 人`} />
            <Row label="作業内容" value={submitted.workType} />
            <Row label="施工面積" value={submitted.area ? `${submitted.area} m²` : '—'} />
            <Row label="写真" value={`${submitted.photoCount} 枚`} />
            {submitted.note && <Row label="備考" value={submitted.note} />}
          </dl>

          <Button size="lg" className="mt-6 w-full" onClick={startNext}>
            続けて入力
          </Button>
        </div>
      </main>
    )
  }

  // ---------- 入力フォーム ----------
  return (
    <main className="mx-auto min-h-dvh max-w-md pb-28">
      <header className="sticky top-0 z-10 border-b border-sky-700 bg-sky-600 px-4 py-3 text-white shadow-sm">
        <p className="text-[11px] leading-none text-sky-100">現場</p>
        <h1 className="mt-1 truncate text-lg font-bold leading-tight">{siteName}</h1>
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

        <Field label="業者">
          <SubPicker subs={subs} value={subId} onChange={setSubId} />
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
              key={OTHER}
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
        </Field>

        <Field label="写真" hint="任意">
          <PhotoInput
            photos={photos}
            onAdd={handleAddPhotos}
            onRemove={handleRemovePhoto}
            disabled={submitting}
          />
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
          <Button
            size="lg"
            className="w-full text-lg"
            disabled={submitting}
            onClick={() => attemptSubmit()}
          >
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

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[15px] font-semibold text-slate-800">{label}</span>
        {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
      </Label>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <dt className="w-20 shrink-0 text-slate-500">{label}</dt>
      <dd className="flex-1 break-words font-medium text-slate-900">{value}</dd>
    </div>
  )
}
