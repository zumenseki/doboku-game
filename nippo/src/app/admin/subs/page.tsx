import { supabaseServer } from '@/lib/supabase/server'
import { MasterTableView, type MasterRow } from '../masters/master-table'

export const dynamic = 'force-dynamic'

export default async function SubsPage() {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('subs')
    .select('id, name, display_order, is_active')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">業者マスタ</h1>
      <MasterTableView table="subs" label="業者" rows={(data ?? []) as MasterRow[]} />
    </div>
  )
}
