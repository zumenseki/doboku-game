'use server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/supabase/server'
import { reportEditSchema } from '@/lib/validation'
import { presignGet, deleteObjects } from '@/lib/r2'
import { toCsv, REPORT_CSV_HEADER } from '@/lib/csv'
import { formatJstDateTime } from '@/lib/utils'

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; message: string }

export type ReportFilters = {
  from?: string
  to?: string
  siteId?: string
  subId?: string
  workType?: string
}

export async function updateReport(id: string, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin()

  const areaRaw = String(formData.get('areaM2') ?? '').trim()
  const noteRaw = String(formData.get('note') ?? '').trim()

  const parsed = reportEditSchema.safeParse({
    workDate: String(formData.get('workDate') ?? ''),
    subId: String(formData.get('subId') ?? ''),
    workers: Number(formData.get('workers') ?? 0),
    workType: String(formData.get('workType') ?? ''),
    areaM2: areaRaw === '' ? null : Number(areaRaw),
    note: noteRaw === '' ? null : noteRaw,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }
  }

  const { error } = await supabase
    .from('reports')
    .update({
      work_date: parsed.data.workDate,
      sub_id: parsed.data.subId,
      workers: parsed.data.workers,
      work_type: parsed.data.workType,
      area_m2: parsed.data.areaM2,
      note: parsed.data.note,
    })
    .eq('id', id)

  if (error) return { ok: false, message: '更新に失敗しました' }

  revalidatePath('/admin/reports')
  return { ok: true }
}

export async function deleteReport(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin()

  // R2の写真も一緒に消す（report_photos は ON DELETE CASCADE）
  const { data: photos } = await supabase.from('report_photos').select('object_key').eq('report_id', id)

  const { error } = await supabase.from('reports').delete().eq('id', id)
  if (error) return { ok: false, message: '削除に失敗しました' }

  const keys = (photos ?? []).map((p) => p.object_key as string)
  if (keys.length > 0) {
    try {
      await deleteObjects(keys)
    } catch {
      // DBは消えているので、R2の残骸は設定画面の一括削除で回収する
    }
  }

  revalidatePath('/admin/reports')
  return { ok: true }
}

/** 日報の写真を presigned GET URL（15分）で返す */
export async function getPhotoUrls(reportId: string): Promise<ActionResult<{ urls: string[] }>> {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('report_photos')
    .select('object_key')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) return { ok: false, message: '写真の取得に失敗しました' }

  try {
    const urls = await Promise.all((data ?? []).map((p) => presignGet(p.object_key as string)))
    return { ok: true, data: { urls } }
  } catch {
    return { ok: false, message: '写真URLの発行に失敗しました' }
  }
}

type CsvRow = {
  work_date: string
  workers: number
  work_type: string
  area_m2: number | null
  note: string | null
  created_at: string
  sites: { name: string } | { name: string }[] | null
  subs: { name: string } | { name: string }[] | null
}

function nameOf(rel: { name: string } | { name: string }[] | null): string {
  if (!rel) return ''
  return Array.isArray(rel) ? (rel[0]?.name ?? '') : rel.name
}

/** 絞り込み条件に一致する全日報をCSV（BOM付きUTF-8）で返す（§7） */
export async function exportReportsCsv(filters: ReportFilters): Promise<ActionResult<{ csv: string }>> {
  const { supabase } = await requireAdmin()

  let query = supabase
    .from('reports')
    .select('work_date, workers, work_type, area_m2, note, created_at, sites(name), subs(name)')
    .order('work_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(20000)

  if (filters.from) query = query.gte('work_date', filters.from)
  if (filters.to) query = query.lte('work_date', filters.to)
  if (filters.siteId) query = query.eq('site_id', filters.siteId)
  if (filters.subId) query = query.eq('sub_id', filters.subId)
  if (filters.workType) query = query.eq('work_type', filters.workType)

  const { data, error } = await query
  if (error) return { ok: false, message: 'CSVの作成に失敗しました' }

  const rows = ((data ?? []) as unknown as CsvRow[]).map((r) => [
    r.work_date,
    nameOf(r.sites),
    nameOf(r.subs),
    r.workers,
    r.work_type,
    r.area_m2 ?? '',
    r.note ?? '',
    formatJstDateTime(r.created_at),
  ])

  return { ok: true, data: { csv: toCsv(REPORT_CSV_HEADER, rows) } }
}
