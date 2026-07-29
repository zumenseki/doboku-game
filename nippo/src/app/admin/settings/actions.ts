'use server'
import { requireAdmin } from '@/lib/supabase/server'
import { deleteObjects } from '@/lib/r2'
import { RETENTION_DAYS } from '@/lib/constants'

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string }

async function collectOldPhotos() {
  const { supabase } = await requireAdmin()

  const threshold = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: sites, error: siteError } = await supabase
    .from('sites')
    .select('id, name, closed_at')
    .eq('status', 'closed')
    .lt('closed_at', threshold)

  if (siteError) throw new Error('対象現場の取得に失敗しました')
  const siteIds = (sites ?? []).map((s) => s.id as string)
  if (siteIds.length === 0) return { supabase, sites: sites ?? [], photoIds: [], keys: [] as string[] }

  const { data: reports, error: reportError } = await supabase
    .from('reports')
    .select('id')
    .in('site_id', siteIds)
  if (reportError) throw new Error('対象日報の取得に失敗しました')

  const reportIds = (reports ?? []).map((r) => r.id as string)
  if (reportIds.length === 0) return { supabase, sites: sites ?? [], photoIds: [], keys: [] as string[] }

  const { data: photos, error: photoError } = await supabase
    .from('report_photos')
    .select('id, object_key')
    .in('report_id', reportIds)
  if (photoError) throw new Error('対象写真の取得に失敗しました')

  return {
    supabase,
    sites: sites ?? [],
    photoIds: (photos ?? []).map((p) => p.id as string),
    keys: (photos ?? []).map((p) => p.object_key as string),
  }
}

/** 削除対象の件数だけを数える（実行前の確認用） */
export async function countOldPhotos(): Promise<
  ActionResult<{ siteCount: number; photoCount: number }>
> {
  try {
    const { sites, keys } = await collectOldPhotos()
    return { ok: true, data: { siteCount: sites.length, photoCount: keys.length } }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '集計に失敗しました' }
  }
}

/**
 * 終了後180日を超えた現場の写真をR2ごと一括削除する。
 * 日報レコード自体（人数・面積・備考）は残す。
 */
export async function purgeOldPhotos(): Promise<ActionResult<{ deleted: number }>> {
  try {
    const { supabase, photoIds, keys } = await collectOldPhotos()
    if (keys.length === 0) return { ok: true, data: { deleted: 0 } }

    await deleteObjects(keys)

    for (let i = 0; i < photoIds.length; i += 500) {
      const chunk = photoIds.slice(i, i + 500)
      const { error } = await supabase.from('report_photos').delete().in('id', chunk)
      if (error) return { ok: false, message: 'DBからの削除に失敗しました' }
    }

    return { ok: true, data: { deleted: keys.length } }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '削除に失敗しました' }
  }
}
