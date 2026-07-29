'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { createMaster, updateMaster, deleteMaster, type MasterTable } from './actions'

export type MasterRow = {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export function MasterTableView({
  table,
  label,
  rows,
}: {
  table: MasterTable
  label: string
  rows: MasterRow[]
}) {
  const router = useRouter()
  const [error, setError] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<MasterRow | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError('')
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.message ?? '処理に失敗しました')
      else router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{label}を追加</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            ref={formRef}
            action={(fd) =>
              run(async () => {
                const res = await createMaster(table, fd)
                if (res.ok) formRef.current?.reset()
                return res
              })
            }
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-56 flex-1">
              <label className="block text-sm font-medium text-slate-700">名称</label>
              <Input name="name" required maxLength={60} className="mt-1" />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-slate-700">表示順</label>
              <Input name="displayOrder" type="number" defaultValue={0} min={0} max={9999} className="mt-1" />
            </div>
            <Button type="submit" disabled={pending}>
              追加
            </Button>
          </form>
        </CardBody>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {label}一覧（{rows.length}件）
          </CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">名称</th>
                <th className="w-24 px-4 py-2 font-medium">表示順</th>
                <th className="w-24 px-4 py-2 font-medium">状態</th>
                <th className="w-56 px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    まだ登録がありません
                  </td>
                </tr>
              )}
              {rows.map((row) =>
                editingId === row.id ? (
                  <tr key={row.id} className="border-t border-slate-100 bg-sky-50/50">
                    <td colSpan={4} className="px-4 py-3">
                      <form
                        action={(fd) =>
                          run(async () => {
                            const res = await updateMaster(table, row.id, fd)
                            if (res.ok) setEditingId(null)
                            return res
                          })
                        }
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
                          <input
                            type="checkbox"
                            name="isActive"
                            defaultChecked={row.is_active}
                            className="h-4 w-4"
                          />
                          有効
                        </label>
                        <Button type="submit" size="sm" disabled={pending}>
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
                      {row.is_active ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                          有効
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                          無効
                        </span>
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
          if (target) run(() => deleteMaster(table, target.id))
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
