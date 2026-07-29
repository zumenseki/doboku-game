'use server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/supabase/server'
import { masterSchema } from '@/lib/validation'

export type MasterTable = 'subs' | 'work_types'

export type ActionResult = { ok: boolean; message?: string }

function pathOf(table: MasterTable) {
  return table === 'subs' ? '/admin/subs' : '/admin/work-types'
}

function labelOf(table: MasterTable) {
  return table === 'subs' ? '業者' : '工種'
}

export async function createMaster(table: MasterTable, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin()

  const parsed = masterSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    displayOrder: Number(formData.get('displayOrder') ?? 0),
    isActive: true,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message }
  }

  const { error } = await supabase.from(table).insert({
    name: parsed.data.name,
    display_order: parsed.data.displayOrder,
    is_active: true,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, message: `同じ名前の${labelOf(table)}が既にあります` }
    return { ok: false, message: '登録に失敗しました' }
  }

  revalidatePath(pathOf(table))
  return { ok: true }
}

export async function updateMaster(
  table: MasterTable,
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireAdmin()

  const parsed = masterSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    displayOrder: Number(formData.get('displayOrder') ?? 0),
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message }
  }

  const { error } = await supabase
    .from(table)
    .update({
      name: parsed.data.name,
      display_order: parsed.data.displayOrder,
      is_active: parsed.data.isActive,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { ok: false, message: `同じ名前の${labelOf(table)}が既にあります` }
    return { ok: false, message: '更新に失敗しました' }
  }

  revalidatePath(pathOf(table))
  return { ok: true }
}

export async function deleteMaster(table: MasterTable, id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) {
    // 日報から参照されている業者は削除できない（外部キー）
    if (error.code === '23503') {
      return { ok: false, message: '日報で使用されているため削除できません。「無効」にしてください' }
    }
    return { ok: false, message: '削除に失敗しました' }
  }

  revalidatePath(pathOf(table))
  return { ok: true }
}
