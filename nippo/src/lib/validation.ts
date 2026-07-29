import { z } from 'zod'

/** 写真1枚あたりのアップロード上限（圧縮後） */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024 // 2MB
/** 図面PDFのアップロード上限 */
export const MAX_DRAWING_BYTES = 10 * 1024 * 1024 // 10MB
/** 1日報あたりの写真枚数上限 */
export const MAX_PHOTOS_PER_REPORT = 10

export const PHOTO_CONTENT_TYPE = 'image/webp'

const uuid = z.uuid()
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が不正です')

/** POST /api/r/{token}/presign */
export const presignSchema = z.object({
  reportId: uuid,
  contentType: z.literal(PHOTO_CONTENT_TYPE, {
    message: '写真は WebP 形式のみアップロードできます',
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_PHOTO_BYTES, '写真1枚あたり2MBまでです'),
})
export type PresignInput = z.infer<typeof presignSchema>

/** POST /api/r/{token}/reports */
export const reportSchema = z.object({
  reportId: uuid,
  workDate: isoDate,
  subId: uuid,
  workers: z
    .number()
    .int()
    .min(1, '人数は1人以上で入力してください')
    .max(99, '人数は99人までです'),
  workType: z
    .string()
    .trim()
    .min(1, '作業内容を選択してください')
    .max(100, '作業内容は100文字までです'),
  areaM2: z.number().min(0, '施工面積は0以上で入力してください').max(9_999_999).optional(),
  note: z.string().trim().max(1000, '備考は1000文字までです').optional(),
  objectKeys: z.array(z.string().min(1)).max(MAX_PHOTOS_PER_REPORT).default([]),
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
})

/** 日報の編集（管理側） */
export const reportEditSchema = z.object({
  workDate: isoDate,
  subId: uuid,
  workers: z.number().int().min(1).max(99),
  workType: z.string().trim().min(1).max(100),
  areaM2: z.number().min(0).max(9_999_999).nullable(),
  note: z.string().trim().max(1000).nullable(),
})
