import { z } from 'zod'

/** 写真1枚あたりのアップロード上限 (圧縮後・JPEGフォールバック込み) */
export const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024
/** 図面PDFのアップロード上限 */
export const MAX_DRAWING_BYTES = 10 * 1024 * 1024
/** 1日報あたりの写真枚数上限 */
export const MAX_PHOTOS_PER_REPORT = 10
/** 色塗りマスクPNGの上限 */
export const MAX_MASK_BYTES = 2 * 1024 * 1024

const uuid = z.uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が不正です')

/** 図面色塗りの結果 (マスクPNGのキー + 概算面積) */
export const paintRegionSchema = z.object({
  objectKey: z.string().min(1),
  areaM2: z.number().min(0).max(9_999_999),
  width: z.number().int().min(1).max(4000),
  height: z.number().int().min(1).max(4000),
})
export type PaintRegionInput = z.infer<typeof paintRegionSchema>

/** 1日報に入れられる作業内容の数 */
export const MAX_WORK_ITEMS = 20

/** 作業内容1件ぶん（作業の種類 + その作業に入った人数） */
export const workItemSchema = z.object({
  workType: z
    .string()
    .trim()
    .min(1, '作業内容を選択してください')
    .max(100, '作業内容は100文字までです'),
  workers: z
    .number()
    .int()
    .min(1, '人数は1人以上で入力してください')
    .max(99, '人数は99人までです'),
})
export type WorkItemInput = z.infer<typeof workItemSchema>

/** 同じ作業内容が2回出てこないか確かめる */
const uniqueWorkTypes = (items: WorkItemInput[]) =>
  new Set(items.map((i) => i.workType)).size === items.length

const workItemsField = z
  .array(workItemSchema)
  .min(1, '作業内容を1つ以上選択してください')
  .max(MAX_WORK_ITEMS, `作業内容は${MAX_WORK_ITEMS}件までです`)
  .refine(uniqueWorkTypes, '同じ作業内容が重複しています')

/** POST /api/rreport */
export const reportSchema = z.object({
  token: z.string().min(1),
  reportId: uuid,
  workDate: isoDate,
  workItems: workItemsField,
  areaM2: z.number().min(0, '施工面積は0以上で入力してください').max(9_999_999).optional(),
  note: z.string().trim().max(1000, '備考は1000文字までです').optional(),
  objectKeys: z.array(z.string().min(1)).max(MAX_PHOTOS_PER_REPORT).default([]),
  paintRegion: paintRegionSchema.optional(),
})
export type ReportInput = z.infer<typeof reportSchema>

/** 管理側: 業者・工種マスタ */
export const masterSchema = z.object({
  name: z.string().trim().min(1, '名称を入力してください').max(60, '名称は60文字までです'),
  displayOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
})

/** 管理側: 現場 */
export const siteSchema = z.object({
  name: z.string().trim().min(1, '現場名を入力してください').max(120, '現場名は120文字までです'),
  address: z.string().trim().max(200).optional(),
  totalAreaM2: z
    .number()
    .min(0, '総施工面積は0以上で入力してください')
    .max(99_999_999)
    .nullable()
    .optional(),
})

/** 管理側: 日報の編集 */
export const reportEditSchema = z.object({
  workDate: isoDate,
  subId: z.string().min(1).max(64),
  workItems: workItemsField,
  areaM2: z.number().min(0).max(9_999_999).nullable(),
  note: z.string().trim().max(1000).nullable(),
})

/** 内訳から、一覧やCSVに出す「作業内容」のまとめ文字列を作る */
export function summarizeWorkTypes(items: { workType: string }[]): string {
  return items.map((i) => i.workType).join('・')
}

/** 内訳から合計人数を出す */
export function totalWorkers(items: { workers: number }[]): number {
  return items.reduce((sum, i) => sum + i.workers, 0)
}
