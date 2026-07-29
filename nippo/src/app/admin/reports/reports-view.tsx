'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog, Modal } from '@/components/ui/dialog'
import { downloadCsv } from '@/lib/csv'
import { formatJstDateTime, formatNumber } from '@/lib/utils'
import type { ReportRow } from '@/lib/types'
import { deleteReport, exportReportsCsv, getPhotoUrls, updateReport, type ReportFilters } from './actions'

type Option = { id: string; name: string }

export function ReportsView({
  reports,
  total,
  page,
  pageSize,
  filters,
  sites,
  subs,
  workTypes,
}: {
  reports: ReportRow[]
  total: number
  page: number
  pageSize: number
  filters: Required<ReportFilters>
  sites: Option[]
  subs: Option[]
  workTypes: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState('')
  const [editing, setEditing] = React.useState<ReportRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ReportRow | null>(null)
  const [photoUrls, setPhotoUrls] = React.useState<string[] | null>(null)
  const [csvPending, setCsvPending] = React.useState(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function applyFilters(form: HTMLFormElement) {
    const fd = new FormData(form)
    const params = new URLSearchParams()
    for (const key of ['from', 'to', 'siteId', 'subId', 'workType'] as const) {
      const value = String(fd.get(key) ?? '')
      if (value) params.set(key, value)
    }
    router.push(`/admin/reports?${params.toString()}`)
  }

  function goPage(next: number) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
    params.set('page', String(next))
    router.push(`/admin/reports?${params.toString()}`)
  }

  async function handleCsv() {
    setCsvPending(true)
    setError('')
    const res = await exportReportsCsv(filters)
    setCsvPending(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    downloadCsv(`日報_${filters.from}_${filters.to}.csv`, res.data!.csv)
  }

  async function showPhotos(report: ReportRow) {
    setError('')
    const res = await getPhotoUrls(report.id)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setPhotoUrls(res.data!.urls)
  }

  const sumWorkers = reports.reduce((acc, r) => acc + r.workers, 0)
  const sumArea = reports.reduce((acc, r) => acc + (r.area_m2 ?? 0), 0)

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
                {sites.map((s) => (
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
                {subs.map((s) => (
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
                {workTypes.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">絞り込む</Button>
            <Button type="button" variant="outline" disabled={csvPending} onClick={handleCsv}>
              {csvPending ? '作成中…' : 'CSV出力'}
            </Button>
          </form>
        </CardBody>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <CardTitle className="mr-auto">
            {total.toLocaleString('ja-JP')} 件 / {page} ページ目
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
              {reports.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    該当する日報がありません
                  </td>
                </tr>
              )}
              {reports.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2">{r.work_date}</td>
                  <td className="px-3 py-2">{r.sites?.name ?? ''}</td>
                  <td className="px-3 py-2">{r.subs?.name ?? ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.workers}</td>
                  <td className="px-3 py-2">{r.work_type}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.area_m2, 1)}</td>
                  <td className="px-3 py-2">
                    {r.report_photos?.length ? (
                      <button
                        className="text-sky-700 hover:underline"
                        onClick={() => showPhotos(r)}
                      >
                        {r.report_photos.length}枚
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
                      <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
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
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            前へ
          </Button>
          <span className="text-sm text-slate-600">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
          >
            次へ
          </Button>
        </div>
      )}

      {/* 編集モーダル */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="日報を編集">
        {editing && (
          <form
            action={(fd) => {
              setError('')
              startTransition(async () => {
                const res = await updateReport(editing.id, fd)
                if (!res.ok) setError(res.message)
                else {
                  setEditing(null)
                  router.refresh()
                }
              })
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
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="e-workers">人数</Label>
                <Input
                  id="e-workers"
                  name="workers"
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={editing.workers}
                  required
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
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
            </div>
            <div>
              <Label htmlFor="e-worktype">作業内容</Label>
              <Input
                id="e-worktype"
                name="workType"
                list="work-type-list"
                defaultValue={editing.work_type}
                required
                maxLength={100}
                className="mt-1"
              />
              <datalist id="work-type-list">
                {workTypes.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="e-note">備考</Label>
              <Textarea id="e-note" name="note" defaultValue={editing.note ?? ''} maxLength={1000} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={pending}>
                保存
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 写真ビューア */}
      <Modal open={photoUrls !== null} onClose={() => setPhotoUrls(null)} title="日報の写真">
        <div className="grid grid-cols-2 gap-2">
          {(photoUrls ?? []).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt="日報写真" className="w-full rounded-lg border border-slate-200" />
            </a>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="日報を削除"
        message={`${deleteTarget?.work_date} / ${deleteTarget?.subs?.name ?? ''} の日報を削除します。写真も一緒に削除されます。よろしいですか?`}
        confirmLabel="削除する"
        destructive
        onConfirm={() => {
          const target = deleteTarget
          setDeleteTarget(null)
          if (!target) return
          startTransition(async () => {
            const res = await deleteReport(target.id)
            if (!res.ok) setError(res.message)
            else router.refresh()
          })
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
