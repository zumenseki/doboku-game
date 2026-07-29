import { createFileRoute } from '@tanstack/react-router'
import { MasterTableView } from '../../nippo/master-table'

export const Route = createFileRoute('/admin/subs')({
  component: () => (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">業者マスタ</h1>
      <MasterTableView table="subs" label="業者" />
    </div>
  ),
})
