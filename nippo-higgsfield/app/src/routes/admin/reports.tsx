import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Button,
  Input,
  Label,
  Select,
  Textarea,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Modal,
  ErrorBox,
} from '../../nippo/ui'
import {
  jfetch,
  toCsv,
  downloadCsv,
  REPORT_CSV_HEADER,
  currentMonth,
  monthRange,
  formatJstDateTime,
  formatNumber,
} from '../../nippo/utils'

export const Route = createFileRoute('/admin/reports')({
  component: ReportsPage,
})

type Option = { id: string; name: string }

type WorkItem = { workType: string; workers: number }

type ReportRow = {
  id: string
  site_id: string
  sub_id: string
  work_date: string
  workers: number
  work_type: string
  workItems: WorkItem[]
  area_m2: number | null
  note: string | null
  created_at: string
  site_name: string | null
  sub_name: string | null
  photo_count: number
}

type ReportsData = {
  rows: ReportRow[]
  total: number
  pageSize: number
  sites: Option[]
  subs: Option[]
  workTypes: string[]
}

type Filters = { from: string; to: string; siteId: string; subId: string; workType: string }

function filterQuery(f: Filters): string {
  const params = new URLSearchParams()
  if (f.from) params.set('from', f.from)
  if (f.to) params.set('to', f.to)
  if (f.siteId) params.set('siteId', f.siteId)
  if (f.subId) params.set('subId', f.subId)
  if (f.workType) params.set('workType', f.workType)
  return params.toString()
}

function ReportsPage() {
  const defaults = monthRange(currentMonth())
  const [filters, setFilters] = React.useState<Filters>({
    from: defaults.from,
    to: defaults.to,
    siteId: '',
    subId: '',
    workType: '',
  })
  const [page, setPage] = React.useState(1)
  const [data, setData] = React.useState<ReportsData | null>(null)
  const [error, setError] = React.useState('')
  const [editing, setEditing] = React.useState<ReportRow | null>(null)
  // 編集ダイアログの作業内容。開くたびに対象の日報の内訳を入れ直す
  const [editItems, setEditItems] = React.useState<WorkItem[]>([])

  function startEdit(row: ReportRow) {
    setEditItems(
      row.workItems?.length
        ? row.workItems.map((i) => ({ ...i }))
        : [{ workType: row.work_type, workers: row.workers }],
    )
    setEditing(row)
  }
  const [deleteTarget, setDeleteTarget] = React.useState<ReportRow | null>(null)
  const [photoUrls, setPhotoUrls] = React.useState<string[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await jfetch<ReportsData>(`/api/admin/reports?${filterQuery(filters)}&page=${page}`)
      if (cancelled) return
      if (res.ok) setData(res.data)
      else setError(res.message)
    })()
    return () => {
      cancelled = true
    }
  }, [filters, page, reloadKey])

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / (data?.pageSize ?? 100)))
  const sumWorkers = rows.reduce((a, r) => a + r.workers, 0)
  const sumArea = rows.reduce((a, r) => a + (r.area_m2 ?? 0), 0)

  function applyFilters(form: HTMLFormElement) {
    const fd = new FormData(form)
    setPage(1)
    setFilters({
      from: String(fd.get('from') ?? ''),
      to: String(fd.get('to') ?? ''),
      siteId: String(fd.get('siteId') ?? ''),
      subId: String(fd.get('subId') ?? ''),
      workType: String(fd.get('workType') ?? ''),
    })
  }

  async function handleCsv() {
    setBusy(true)
    setError('')
    const res = await jfetch<{ rows: ReportRow[] }>(`/api/admin/reports?${filterQuery(filters)}&all=1`)
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    const csv = toCsv(
      REPORT_CSV_HEADER,
      res.data.rows.map((r) => [
        r.work_date,
        r.site_name ?? '',
        r.sub_name ?? '',
        r.workers,
        r.work_type,
        // 作業ごとの人数を1セルにまとめる（例: 積込み 2人 / 搬入 3人）
        (r.workItems ?? []).map((i) => `${i.workType} ${i.workers}人`).join(' / '),
        r.area_m2 ?? '',
        r.note ?? '',
        formatJstDateTime(r.created_at),
      ]),
    )
    downloadCsv(`日報_${filters.from}_${filters.to}.csv`, csv)
  }

  async function showPhotos(report: ReportRow) {
    setError('')
    const res = await jfetch<{ keys: string[] }>(`/api/admin/photos?reportId=${report.id}`)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setPhotoUrls(res.data.keys.map((key) => `/api/admin/file?key=${encodeURIComponent(key)}`))
  }

  async function submitEdit(fd: FormData) {
    if (!editing) return
    setBusy(true)
    setError('')
    const areaRaw = String(fd.get('areaM2') ?? '').trim()
    const res = await jfetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing.id,
        workDate: String(fd.get('workDate') ?? ''),
        subId: String(fd.get('subId') ?? ''),
        workItems: editItems.map((i) => ({ workType: i.workType.trim(), workers: i.workers })),
        areaM2: areaRaw === '' ? null : Number(areaRaw),
        note: String(fd.get('note') ?? ''),
      }),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setEditing(null)
    setReloadKey((k) => k + 1)
  }

  async function submitDelete() {
    const target = deleteTarget
    setDeleteTarget(null)
    if (!target) return
    setBusy(true)
    const res = await jfetch(`/api/admin/reports?id=${target.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) setError(res.message)
    else setReloadKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">日報一覧</h1>

      <Card>
        <CardHeader>
          <CardTitle>絞り込み</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              applyFilters(e.currentTarget)
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div>
              <Label htmlFor="from">開始日</Label>
              <Input id="from" name="from" type="date" defaultValue={filters.from} className="mt-1 w-44" />
            </div>
            <div>
              <Label htmlFor="to">終了日</Label>
              <Input id="to" name="to" type="date" defaultValue={filters.to} className="mt-1 w-44" />
            </div>
            <div>
              <Label htmlFor="siteId">現場</Label>
              <Select id="siteId" name="siteId" defaultValue={filters.siteId} className="mt-1 w-52">
                <option value="">すべて</option>
                {(data?.sites ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="subId">業者</Label>
              <Select id="subId" name="subId" defaultValue={filters.subId} className="mt-1 w-52">
                <option value="">すべて</option>
                {(data?.subs ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="workType">工種</Label>
              <Select id="workType" name="workType" defaultValue={filters.workType} className="mt-1 w-44">
                <option value="">すべて</option>
                {(data?.workTypes ?? []).map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">絞り込む</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={handleCsv}>
              {busy ? '処理中…' : 'CSV出力'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <ErrorBox>{error}</ErrorBox>

      <Card>
        <CardHeader className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <CardTitle className="mr-auto">
            {formatNumber(total)} 件 / {page} ページ目
          </CardTitle>
          <span className="text-sm text-slate-600">
            表示中の延べ人数 <strong>{formatNumber(sumWorkers)}</strong> 人 ・ 面積{' '}
            <strong>{formatNumber(sumArea, 1)}</strong> m²
          </span>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">日付</th>
                <th className="px-3 py-2 font-medium">現場</th>
                <th className="px-3 py-2 font-medium">業者</th>
                <th className="px-3 py-2 font-medium">人数</th>
                <th className="px-3 py-2 font-medium">作業内容</th>
                <th className="px-3 py-2 font-medium">面積(m²)</th>
                <th className="px-3 py-2 font-medium">写真</th>
                <th className="px-3 py-2 font-medium">備考</th>
                <th className="px-3 py-2 font-medium">提出日時</th>
                <th className="w-32 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    該当する日報がありません
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2">{r.work_date}</td>
                  <td className="px-3 py-2">{r.site_name ?? ''}</td>
                  <td className="px-3 py-2">{r.sub_name ?? ''}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.workers}</td>
                  <td className="px-3 py-2">
                    {(r.workItems ?? []).length > 1 ? (
                      <ul className="space-y-0.5">
                        {r.workItems.map((i) => (
                          <li key={i.workType} className="whitespace-nowrap">
                            {i.workType}
                            <span className="ml-1 text-slate-500">{i.workers}人</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      (r.workItems?.[0]?.workType ?? r.work_type)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.area_m2, 1)}</td>
                  <td className="px-3 py-2">
                    {r.photo_count > 0 ? (
                      <button className="text-sky-700 hover:underline" onClick={() => showPhotos(r)}>
                        {r.photo_count}枚
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="max-w-48 px-3 py-2 text-slate-600">{r.note}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                    {formatJstDateTime(r.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                        編集
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r)}>
                        削除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            前へ
          </Button>
          <span className="text-sm text-slate-600">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            次へ
          </Button>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="日報を編集">
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submitEdit(new FormData(e.currentTarget))
            }}
            className="space-y-3"
          >
            <div>
              <Label htmlFor="e-date">日付</Label>
              <Input id="e-date" name="workDate" type="date" defaultValue={editing.work_date} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="e-sub">業者</Label>
              <Select id="e-sub" name="subId" defaultValue={editing.sub_id} className="mt-1">
                {(data?.subs ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>作業内容と人数</Label>
              <div className="mt-1 space-y-2">
                {editItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      list="work-type-list"
                      value={item.workType}
                      required
                      maxLength={100}
                      placeholder="作業内容"
                      aria-label={`作業内容 ${idx + 1}`}
                      onChange={(e) =>
                        setEditItems((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, workType: e.target.value } : p)),
                        )
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={item.workers}
                      required
                      aria-label={`${item.workType || `作業${idx + 1}`}の人数`}
                      onChange={(e) =>
                        setEditItems((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? { ...p, workers: Math.min(99, Math.max(1, Math.trunc(Number(e.target.value) || 1))) }
                              : p,
                          ),
                        )
                      }
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-slate-500">人</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={editItems.length <= 1}
                      onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      削除
                    </Button>
                  </div>
                ))}
              </div>
              <datalist id="work-type-list">
                {(data?.workTypes ?? []).map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
              <div className="mt-2 flex items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditItems((prev) => [...prev, { workType: '', workers: 1 }])}
                >
                  ＋ 作業内容を追加
                </Button>
                <span className="text-sm text-slate-600">
                  合計{' '}
                  <b className="text-base text-slate-900">
                    {editItems.reduce((a, i) => a + i.workers, 0)}
                  </b>{' '}
                  人
                </span>
              </div>
            </div>
            <div>
              <Label htmlFor="e-area">面積(m²)</Label>
              <Input
                id="e-area"
                name="areaM2"
                type="number"
                min={0}
                step="0.1"
                defaultValue={editing.area_m2 ?? ''}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="e-note">備考</Label>
              <Textarea id="e-note" name="note" defaultValue={editing.note ?? ''} maxLength={1000} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={busy}>
                保存
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={photoUrls !== null} onClose={() => setPhotoUrls(null)} title="日報の写真">
        <div className="grid grid-cols-2 gap-2">
          {(photoUrls ?? []).map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt="日報写真" className="w-full rounded-lg border border-slate-200" />
            </a>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="日報を削除"
        message={`${deleteTarget?.work_date} / ${deleteTarget?.sub_name ?? ''} の日報を削除します。写真も一緒に削除されます。よろしいですか?`}
        confirmLabel="削除する"
        destructive
        onConfirm={() => void submitDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
