import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Button, Input, Modal, ConfirmDialog, ErrorBox } from './ui'
import { QrCode } from './qr'
import { cn, jfetch, formatNumber } from './utils'

export type AssignmentRow = {
  id: string
  token: string
  sub_id: string
  sub_name: string
  sub_active: number
  report_count: number
  last_date: string | null
}

export type Sub = { id: string; name: string }

export function assignmentUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/r/${token}`
}

/** 現場詳細の「業者ごとの日報URL」セクション */
export function AssignmentPanel({
  siteId,
  siteName,
  rows,
  onChanged,
}: {
  siteId: string
  siteName: string
  rows: AssignmentRow[]
  onChanged: () => void
}) {
  const [subs, setSubs] = React.useState<Sub[]>([])
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [checked, setChecked] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [qrTarget, setQrTarget] = React.useState<AssignmentRow | null>(null)
  const [removeTarget, setRemoveTarget] = React.useState<AssignmentRow | null>(null)
  const [reissueTarget, setReissueTarget] = React.useState<AssignmentRow | null>(null)

  const assigned = new Set(rows.map((r) => r.sub_id))

  async function openPicker() {
    setError('')
    setChecked(new Set())
    setQuery('')
    setPickerOpen(true)
    const res = await jfetch<{ rows: { id: string; name: string; is_active: number }[] }>(
      '/api/admin/masters?table=subs',
    )
    if (res.ok) setSubs(res.data.rows.filter((s) => s.is_active === 1).map((s) => ({ id: s.id, name: s.name })))
    else setError(res.message)
  }

  async function addChecked() {
    if (checked.size === 0) return
    setBusy(true)
    setError('')
    const res = await jfetch<{ created: number }>('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, subIds: [...checked] }),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setPickerOpen(false)
    onChanged()
  }

  async function remove(row: AssignmentRow) {
    setBusy(true)
    const res = await jfetch(`/api/admin/assignments?id=${row.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) setError(res.message)
    else onChanged()
  }

  async function reissue(row: AssignmentRow) {
    setBusy(true)
    const res = await jfetch('/api/admin/assignments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, action: 'reissue' }),
    })
    setBusy(false)
    if (!res.ok) setError(res.message)
    else onChanged()
  }

  const filtered = query.trim()
    ? subs.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    : subs

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={openPicker}>
          ＋ 業者を割り当てる
        </Button>
        {rows.length > 0 && (
          <Link to="/admin/print/$id" params={{ id: siteId }} target="_blank">
            <Button size="sm" variant="outline">
              全業者のQRをまとめて印刷
            </Button>
          </Link>
        )}
        <span className="text-xs text-slate-500">
          割り当てた業者ごとに専用URLが発行されます（業者は選択不要）
        </span>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          まだ業者が割り当てられていません。「業者を割り当てる」から追加すると、日報URLとQRが発行されます。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">業者</th>
                <th className="px-3 py-2 font-medium">日報URL</th>
                <th className="w-24 px-3 py-2 text-right font-medium">提出</th>
                <th className="w-28 px-3 py-2 font-medium">最終提出</th>
                <th className="w-64 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
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
                    <code className="block max-w-72 truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      {assignmentUrl(r.token)}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.report_count)}</td>
                  <td className="px-3 py-2 text-slate-600">{r.last_date ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => setQrTarget(r)}>
                        QR
                      </Button>
                      <CopyBtn text={assignmentUrl(r.token)} />
                      <Button size="sm" variant="ghost" onClick={() => setReissueTarget(r)}>
                        再発行
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(r)}>
                        解除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 業者を選ぶ */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="この現場に業者を割り当てる"
        footer={
          <>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              キャンセル
            </Button>
            <Button disabled={busy || checked.size === 0} onClick={() => void addChecked()}>
              {busy ? '追加中…' : `${checked.size}社を割り当てる`}
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          placeholder="業者名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-3"
        />
        <ul className="max-h-[45dvh] overflow-y-auto rounded-lg border border-slate-200">
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-slate-500">該当する業者がありません</li>
          )}
          {filtered.map((s) => {
            const already = assigned.has(s.id)
            return (
              <li key={s.id} className="border-b border-slate-100 last:border-b-0">
                <label
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5',
                    already ? 'text-slate-400' : 'cursor-pointer hover:bg-slate-50',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    disabled={already}
                    checked={checked.has(s.id)}
                    onChange={(e) => {
                      setChecked((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(s.id)
                        else next.delete(s.id)
                        return next
                      })
                    }}
                  />
                  <span>{s.name}</span>
                  {already && <span className="ml-auto text-xs">割当済み</span>}
                </label>
              </li>
            )
          })}
        </ul>
      </Modal>

      {/* QR表示 */}
      <Modal open={qrTarget !== null} onClose={() => setQrTarget(null)} title={`${qrTarget?.sub_name ?? ''} 用のQR`}>
        {qrTarget && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-600">
              {siteName} ／ <b className="text-slate-900">{qrTarget.sub_name}</b>
            </p>
            <div className="inline-block rounded-lg border border-slate-200 bg-white p-3">
              <QrCode value={assignmentUrl(qrTarget.token)} size={200} />
            </div>
            <code className="block break-all rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-800">
              {assignmentUrl(qrTarget.token)}
            </code>
            <div className="flex justify-center gap-2">
              <CopyBtn text={assignmentUrl(qrTarget.token)} />
              <Link to="/admin/print/$id" params={{ id: siteId }} target="_blank">
                <Button size="sm" variant="outline">
                  印刷ビュー
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={removeTarget !== null}
        title="割り当てを解除しますか?"
        message={`「${removeTarget?.sub_name}」のこの現場用URLを無効にします。提出済みの日報は残ります。`}
        confirmLabel="解除する"
        destructive
        onConfirm={() => {
          const t = removeTarget
          setRemoveTarget(null)
          if (t) void remove(t)
        }}
        onCancel={() => setRemoveTarget(null)}
      />
      <ConfirmDialog
        open={reissueTarget !== null}
        title="URLを再発行しますか?"
        message={`「${reissueTarget?.sub_name}」の新しいURLを発行します。配布済みの古いQR・URLは使えなくなります。`}
        confirmLabel="再発行する"
        destructive
        onConfirm={() => {
          const t = reissueTarget
          setReissueTarget(null)
          if (t) void reissue(t)
        }}
        onCancel={() => setReissueTarget(null)}
      />
    </div>
  )
}

export function CopyBtn({ text }: { text: string }) {
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
      {copied ? 'コピー済' : 'URLコピー'}
    </Button>
  )
}

/** 1業者を複数の現場にまとめて割り当てるモーダル（業者マスタから使う） */
export function SubSitesModal({
  sub,
  onClose,
  onChanged,
}: {
  sub: { id: string; name: string }
  onClose: () => void
  onChanged: () => void
}) {
  const [sites, setSites] = React.useState<{ id: string; name: string }[]>([])
  const [assigned, setAssigned] = React.useState<Set<string>>(new Set())
  const [checked, setChecked] = React.useState<Set<string>>(new Set())
  const [query, setQuery] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [loaded, setLoaded] = React.useState(false)

  const load = React.useCallback(async () => {
    const [siteRes, asgRes] = await Promise.all([
      jfetch<{ rows: { id: string; name: string }[] }>('/api/admin/sites?status=active'),
      jfetch<{ rows: { site_id: string; sub_id: string }[] }>('/api/admin/assignments?status=active'),
    ])
    if (siteRes.ok) setSites(siteRes.data.rows)
    else setError(siteRes.message)
    if (asgRes.ok) {
      setAssigned(new Set(asgRes.data.rows.filter((r) => r.sub_id === sub.id).map((r) => r.site_id)))
    }
    setLoaded(true)
  }, [sub.id])

  React.useEffect(() => {
    void load()
  }, [load])

  async function submit() {
    if (checked.size === 0) return
    setBusy(true)
    setError('')
    const res = await jfetch<{ created: number }>('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subId: sub.id, siteIds: [...checked] }),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setChecked(new Set())
    await load()
    onChanged()
  }

  const filtered = query.trim()
    ? sites.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    : sites
  const notAssigned = filtered.filter((s) => !assigned.has(s.id))

  return (
    <Modal
      open
      onClose={onClose}
      title={`${sub.name} を現場に割り当てる`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
          <Button disabled={busy || checked.size === 0} onClick={() => void submit()}>
            {busy ? '追加中…' : `${checked.size}現場に割り当てる`}
          </Button>
        </>
      }
    >
      <p className="mb-2 text-xs text-slate-500">
        1社を複数の現場に割り当てられます。現場ごとに別々のURL・QRが発行されます。
        （現在 <b className="text-slate-700">{assigned.size}</b> 現場に割当済み）
      </p>
      <ErrorBox>{error}</ErrorBox>
      <Input
        autoFocus
        placeholder="現場名で検索"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="my-2"
      />
      <div className="mb-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={notAssigned.length === 0}
          onClick={() => setChecked(new Set(notAssigned.map((s) => s.id)))}
        >
          表示中をすべて選択
        </Button>
        <Button size="sm" variant="ghost" disabled={checked.size === 0} onClick={() => setChecked(new Set())}>
          選択を解除
        </Button>
      </div>
      <ul className="max-h-[45dvh] overflow-y-auto rounded-lg border border-slate-200">
        {loaded && filtered.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-slate-500">該当する稼働中の現場がありません</li>
        )}
        {filtered.map((s) => {
          const already = assigned.has(s.id)
          return (
            <li key={s.id} className="border-b border-slate-100 last:border-b-0">
              <label
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5',
                  already ? 'text-slate-400' : 'cursor-pointer hover:bg-slate-50',
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  disabled={already}
                  checked={checked.has(s.id)}
                  onChange={(e) =>
                    setChecked((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(s.id)
                      else next.delete(s.id)
                      return next
                    })
                  }
                />
                <span>{s.name}</span>
                {already && <span className="ml-auto text-xs">割当済み</span>}
              </label>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
