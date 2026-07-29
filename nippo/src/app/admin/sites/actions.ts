'use server'
import { revalidatePath } from 'next/cache'
import { nanoid } from 'nanoid'
import { requireAdmin } from '@/lib/supabase/server'
import { siteSchema, MAX_DRAWING_BYTES } from '@/lib/validation'
import { presignPut, presignGet, objectKeys } from '@/lib/r2'

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; message: string }

/** 現場作成。tokenは nanoid(21)。現場名・日付・地名などは一切含めない（§2） */
export async function createSite(
  formData: FormData,
): Promise<ActionResult<{ id: string; token: string }>> {
  const { supabase } = await requireAdmin()

  const parsed = siteSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? '') || undefined,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }
  }

  const token = nanoid(21)
  const { data, error } = await supabase
    .from('sites')
    .insert({
      token,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      status: 'active',
    })
    .select('id, token')
    .single()

  if (error || !data) {
    return { ok: false, message: '現場の作成に失敗しました' }
  }

  revalidatePath('/admin/sites')
  return { ok: true, data: { id: data.id as string, token: data.token as string } }
}

export async function updateSite(id: string, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin()

  const parsed = siteSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? '') || undefined,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }
  }

  const { error } = await supabase
    .from('sites')
    .update({ name: parsed.data.name, address: parsed.data.address ?? null })
    .eq('id', id)

  if (error) return { ok: false, message: '更新に失敗しました' }

  revalidatePath('/admin/sites')
  revalidatePath(`/admin/sites/${id}`)
  return { ok: true }
}

/** 現場を終了する = トークン即失効（/r/{token} が受付終了になる） */
export async function closeSite(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('sites')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, message: '終了処理に失敗しました' }

  revalidatePath('/admin/sites')
  revalidatePath(`/admin/sites/${id}`)
  return { ok: true }
}

export async function reopenSite(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('sites')
    .update({ status: 'active', closed_at: null })
    .eq('id', id)
  if (error) return { ok: false, message: '再開に失敗しました' }

  revalidatePath('/admin/sites')
  revalidatePath(`/admin/sites/${id}`)
  return { ok: true }
}

/** トークン再発行。旧URLは即座に無効になる */
export async function reissueToken(id: string): Promise<ActionResult<{ token: string }>> {
  const { supabase } = await requireAdmin()
  const token = nanoid(21)
  const { error } = await supabase.from('sites').update({ token }).eq('id', id)
  if (error) return { ok: false, message: 'トークンの再発行に失敗しました' }

  revalidatePath('/admin/sites')
  revalidatePath(`/admin/sites/${id}`)
  return { ok: true, data: { token } }
}

/** 図面PDFのアップロード用 presigned PUT URL（10MB上限） */
export async function presignDrawingUpload(
  siteId: string,
  contentType: string,
  size: number,
): Promise<ActionResult<{ uploadUrl: string; objectKey: string }>> {
  await requireAdmin()

  if (contentType !== 'application/pdf') {
    return { ok: false, message: 'PDFファイルを選択してください' }
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_DRAWING_BYTES) {
    return { ok: false, message: '図面PDFは10MBまでです' }
  }

  const objectKey = objectKeys.drawing(siteId)
  try {
    const uploadUrl = await presignPut(objectKey, contentType, size)
    return { ok: true, data: { uploadUrl, objectKey } }
  } catch {
    return { ok: false, message: 'アップロードURLの発行に失敗しました' }
  }
}

/** PUT完了後にキーをDBへ保存する */
export async function saveDrawingKey(siteId: string, objectKey: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin()

  if (objectKey !== objectKeys.drawing(siteId)) {
    return { ok: false, message: '図面の指定が不正です' }
  }

  const { error } = await supabase.from('sites').update({ drawing_key: objectKey }).eq('id', siteId)
  if (error) return { ok: false, message: '図面の保存に失敗しました' }

  revalidatePath(`/admin/sites/${siteId}`)
  return { ok: true }
}

/** 図面の閲覧用 presigned GET URL（15分） */
export async function getDrawingUrl(siteId: string): Promise<ActionResult<{ url: string }>> {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('sites')
    .select('drawing_key')
    .eq('id', siteId)
    .maybeSingle()

  if (error || !data?.drawing_key) {
    return { ok: false, message: '図面が登録されていません' }
  }

  try {
    return { ok: true, data: { url: await presignGet(data.drawing_key as string) } }
  } catch {
    return { ok: false, message: '図面URLの発行に失敗しました' }
  }
}
