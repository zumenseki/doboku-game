import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { MasterTableView } from '../../nippo/master-table'
import { ImportExcel } from '../../nippo/import-excel'

export const Route = createFileRoute('/admin/subs')({
  component: SubsPage,
})

function SubsPage() {
  const [reloadKey, setReloadKey] = React.useState(0)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-bold text-slate-900">業者マスタ</h1>
        <ImportExcel kind="subs" onDone={() => setReloadKey((k) => k + 1)} />
      </div>
      <MasterTableView key={reloadKey} table="subs" label="業者" />
    </div>
  )
}
