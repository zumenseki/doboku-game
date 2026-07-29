import * as React from 'react'
import { Button, Input, Card, CardBody, CardHeader, CardTitle, ConfirmDialog, ErrorBox } from './ui'
import { jfetch } from './utils'

export type MasterRow = {
  id: string
  name: string
  display_order: number
  is_active: number
}

export function MasterTableView({ table, label }: { table: 'subs' | 'work_types'; label: string }) {
  const [rows, setRows] = React.useState<MasterRow[] | null>(null)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<MasterRow | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const createFormRef = React.useRef<HTMLFormElement>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await jfetch<{ rows: MasterRow[] }>(`/api/admin/masters?table=${table}`)
      if (cancelled) return
      if (res.ok) setRows(res.data.rows)
      else setError(res.message)
    })()
    return () => {
      cancelled = true
    }
  }, [table, reloadKey])

  async function post(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true)
    setError('')
    const res = await jfetch('/api/admin/masters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, ...body }),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return false
    }
    setReloadKey((k) => k + 1)
    return true
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{label}を追加</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            ref={createFormRef}
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              void post({
                action: 'create',
                name: String(fd.get('name') ?? ''),
                displayOrder: Number(fd.get('displayOrder') ?? 0),
              }).then((ok) => {
                if (ok) createFormRef.current?.reset()
              })
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-56 flex-1">
              <label className="block text-sm font-medium text-slate-700">名称</label>
              <Input name="name" required maxLength={60} className="mt-1" />
            </div>
            <div className="w-36">
              <label className="block text-sm font-medium text-slate-700">表示順</label>
              <Input name="displayOrder" type="number" defaultValue={0} min={0} max={9999} className="mt-1" />
            </div>
            <Button type="submit" disabled={busy}>
              追加
            </Button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            <strong className="text-slate-700">表示順</strong>は、日報の入力画面で
            {label}が並ぶ順番です。<strong className="text-slate-700">数字の小さいものが上（先）</strong>
            に出ます。同じ数字なら名前順。よく使う{label}を10・20・30…にしておくと、
            後から間に追加しやすくなります。こだわらない場合は0のままで構いません。
          </p>
        </CardBody>
      </Card>

      <ErrorBox>{error}</ErrorBox>

      <Card>
        <CardHeader>
          <CardTitle>
            {label}一覧（{rows?.length ?? 0}件）
          </CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">名称</th>
                <th className="w-32 px-4 py-2 font-medium" title="日報の入力画面で並ぶ順番。小さい数字ほど上に出ます">
                  表示順 <span className="font-normal text-slate-400">(小さい順)</span>
                </th>
                <th className="w-24 px-4 py-2 font-medium">状態</th>
                <th className="w-56 px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    まだ登録がありません
                  </td>
                </tr>
              )}
              {(rows ?? []).map((row) =>
                editingId === row.id ? (
                  <tr key={row.id} className="border-t border-slate-100 bg-sky-50/50">
                    <td colSpan={4} className="px-4 py-3">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          const fd = new FormData(e.currentTarget)
                          void post({
                            action: 'update',
                            id: row.id,
                            name: String(fd.get('name') ?? ''),
                            displayOrder: Number(fd.get('displayOrder') ?? 0),
                            isActive: fd.get('isActive') === 'on',
                          }).then((ok) => {
                            if (ok) setEditingId(null)
                          })
                        }}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <div className="min-w-48 flex-1">
                          <Input name="name" defaultValue={row.name} required maxLength={60} />
                        </div>
                        <Input
                          name="displayOrder"
                          type="number"
                          defaultValue={row.display_order}
                          min={0}
                          max={9999}
                          className="w-28"
                        />
                        <label className="flex h-11 items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" name="isActive" defaultChecked={row.is_active === 1} className="h-4 w-4" />
                          有効
                        </label>
                        <Button type="submit" size="sm" disabled={busy}>
                          保存
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          キャンセル
                        </Button>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-2 text-slate-600">{row.display_order}</td>
                    <td className="px-4 py-2">
                      {row.is_active === 1 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">有効</span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">無効</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingId(row.id)}>
                          編集
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(row)}>
                          削除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`${label}を削除`}
        message={`「${deleteTarget?.name}」を削除します。よろしいですか?`}
        confirmLabel="削除する"
        destructive
        onConfirm={() => {
          const target = deleteTarget
          setDeleteTarget(null)
          if (target) void post({ action: 'delete', id: target.id })
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
