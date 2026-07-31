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

/** POST /api/rreport */
export const reportSchema = z.object({
  token: z.string().min(1),
  reportId: uuid,
  workDate: isoDate,
  workers: z.number().int().min(1, '人数は1人以上で入力してください').max(99, '人数は99人までです'),
  workType: z.string().trim().min(1, '作業内容を選択してください').max(100, '作業内容は100文字までです'),
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
  workers: z.number().int().min(1).max(99),
  workType: z.string().trim().min(1).max(100),
  areaM2: z.number().min(0).max(9_999_999).nullable(),
  note: z.string().trim().max(1000).nullable(),
})
