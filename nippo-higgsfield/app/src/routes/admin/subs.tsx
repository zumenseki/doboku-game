import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '../../nippo/ui'
import { MasterTableView, type MasterRow } from '../../nippo/master-table'
import { ImportExcel } from '../../nippo/import-excel'
import { SubSitesModal } from '../../nippo/assignments'
import { jfetch } from '../../nippo/utils'

export const Route = createFileRoute('/admin/subs')({
  component: SubsPage,
})

function SubsPage() {
  const [reloadKey, setReloadKey] = React.useState(0)
  const [target, setTarget] = React.useState<{ id: string; name: string } | null>(null)
  const [counts, setCounts] = React.useState<Record<string, number>>({})

  // 業者ごとの「割当現場数」を出す
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await jfetch<{ rows: { sub_id: string }[] }>('/api/admin/assignments?status=active')
      if (cancelled || !res.ok) return
      const map: Record<string, number> = {}
      for (const r of res.data.rows) map[r.sub_id] = (map[r.sub_id] ?? 0) + 1
      setCounts(map)
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-bold text-slate-900">業者マスタ</h1>
        <ImportExcel kind="subs" onDone={() => setReloadKey((k) => k + 1)} />
      </div>

      <p className="text-sm text-slate-600">
        「<b>現場に割当</b>」から、1社をまとめて複数の現場に割り当てられます。
        現場ごとに別々の日報URL・QRが発行されます。
      </p>

      <MasterTableView
        table="subs"
        label="業者"
        reloadSignal={reloadKey}
        rowExtra={(row: MasterRow) => (
          <Button size="sm" variant="outline" onClick={() => setTarget({ id: row.id, name: row.name })}>
            現場に割当
            {counts[row.id] ? (
              <span className="ml-1 rounded-full bg-sky-100 px-1.5 text-xs text-sky-800">{counts[row.id]}</span>
            ) : null}
          </Button>
        )}
      />

      {target && (
        <SubSitesModal
          sub={target}
          onClose={() => setTarget(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  )
}
