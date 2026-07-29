import { NextResponse } from 'next/server'
import { resolveSiteByToken } from '@/lib/site-token'
import { supabaseService } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/r/{token}/duplicate?subId=&workDate=
 * 同一「現場×業者×日付」の提出が既にあるかを返す（§6-1: 送信前の警告用）。
 * 重複送信自体は許可する。
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  if (!rateLimit(`dup:${token}`, 60)) {
    return NextResponse.json({ exists: false })
  }

  const result = await resolveSiteByToken(token)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }

  const url = new URL(req.url)
  const subId = url.searchParams.get('subId') ?? ''
  const workDate = url.searchParams.get('workDate') ?? ''
  if (!UUID_RE.test(subId) || !DATE_RE.test(workDate)) {
    return NextResponse.json({ message: 'パラメータが不正です' }, { status: 400 })
  }

  const { count, error } = await supabaseService()
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', result.site.id)
    .eq('sub_id', subId)
    .eq('work_date', workDate)

  if (error) {
    // 警告表示は補助機能なので、失敗しても送信を妨げない
    return NextResponse.json({ exists: false })
  }

  return NextResponse.json(
    { exists: (count ?? 0) > 0, count: count ?? 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
