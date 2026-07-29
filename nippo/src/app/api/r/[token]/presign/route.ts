import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { resolveSiteByToken } from '@/lib/site-token'
import { presignPut, objectKeys } from '@/lib/r2'
import { presignSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/r/{token}/presign
 * body: { reportId, contentType: 'image/webp', size }
 * → { uploadUrl, objectKey }
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  // 写真は1日報あたり複数枚あるため、reports より緩め
  if (!rateLimit(`presign:${token}`, 60)) {
    return NextResponse.json({ message: 'アップロードが多すぎます。少し待って再度お試しください' }, { status: 429 })
  }

  const result = await resolveSiteByToken(token)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'リクエストが不正です' }, { status: 400 })
  }

  const parsed = presignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' },
      { status: 400 },
    )
  }

  const { reportId, contentType, size } = parsed.data
  const objectKey = objectKeys.photo(reportId, nanoid())

  try {
    const uploadUrl = await presignPut(objectKey, contentType, size)
    return NextResponse.json({ uploadUrl, objectKey }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('presign failed', e)
    return NextResponse.json({ message: '写真のアップロード準備に失敗しました' }, { status: 500 })
  }
}
