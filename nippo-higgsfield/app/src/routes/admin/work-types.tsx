import { createFileRoute } from '@tanstack/react-router'
import { MasterTableView } from '../../nippo/master-table'

export const Route = createFileRoute('/admin/work-types')({
  component: () => (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">工種マスタ</h1>
      <MasterTableView table="work_types" label="工種" />
    </div>
  ),
})
