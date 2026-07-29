import { NextResponse } from 'next/server'
import { resolveSiteByToken } from '@/lib/site-token'
import { supabaseService } from '@/lib/supabase/service'
import { reportSchema } from '@/lib/validation'
import { isPhotoKeyOf } from '@/lib/r2'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/r/{token}/reports
 * body: { reportId, workDate, subId, workers, workType, areaM2?, note?, objectKeys[] }
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  // §8 簡易レート制限: 同一tokenへのPOSTを毎分10回
  if (!rateLimit(`post:${token}`, 10)) {
    return NextResponse.json(
      { message: '送信が多すぎます。1分ほど待ってから再送してください' },
      { status: 429 },
    )
  }

  const result = await resolveSiteByToken(token)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }
  const site = result.site

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'リクエストが不正です' }, { status: 400 })
  }

  const parsed = reportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' },
      { status: 400 },
    )
  }
  const input = parsed.data

  // 他日報のキーを紐付けられないよう、写真キーの所属を検証
  if (input.objectKeys.some((key) => !isPhotoKeyOf(key, input.reportId))) {
    return NextResponse.json({ message: '写真の指定が不正です' }, { status: 400 })
  }

  const db = supabaseService()

  const { error: reportError } = await db.from('reports').insert({
    id: input.reportId,
    site_id: site.id,
    sub_id: input.subId,
    work_date: input.workDate,
    workers: input.workers,
    work_type: input.workType,
    area_m2: input.areaM2 ?? null,
    note: input.note && input.note.length > 0 ? input.note : null,
  })

  if (reportError) {
    // 同一IDの再送（ネットワーク断後のリトライ）は成功済みとして扱う
    if (reportError.code === '23505') {
      return NextResponse.json({ id: input.reportId, alreadySubmitted: true })
    }
    // 業者IDが存在しない等
    if (reportError.code === '23503') {
      return NextResponse.json({ message: '業者の選択が不正です' }, { status: 400 })
    }
    console.error('report insert failed', reportError)
    return NextResponse.json({ message: '日報の保存に失敗しました' }, { status: 500 })
  }

  if (input.objectKeys.length > 0) {
    const { error: photoError } = await db.from('report_photos').insert(
      input.objectKeys.map((object_key) => ({ report_id: input.reportId, object_key })),
    )
    if (photoError) {
      // 写真が保存できなければ日報ごと巻き戻す（トランザクション相当）
      await db.from('reports').delete().eq('id', input.reportId)
      console.error('report_photos insert failed', photoError)
      return NextResponse.json({ message: '写真の保存に失敗しました' }, { status: 500 })
    }
  }

  return NextResponse.json({ id: input.reportId })
}
