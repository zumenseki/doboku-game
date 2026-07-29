import { NextResponse } from 'next/server'
import { resolveSiteByToken } from '@/lib/site-token'
import { supabaseService } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/r/{token}
 * → { site: { name }, subs: [...], workTypes: [...] }
 * token不明: 404 / closed: 410
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  if (!rateLimit(`get:${token}`, 60)) {
    return NextResponse.json({ message: 'アクセスが多すぎます。少し待って再度お試しください' }, { status: 429 })
  }

  const result = await resolveSiteByToken(token)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }

  const db = supabaseService()
  const [subsRes, workTypesRes] = await Promise.all([
    db
      .from('subs')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    db
      .from('work_types')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
  ])

  if (subsRes.error || workTypesRes.error) {
    return NextResponse.json({ message: 'マスタの取得に失敗しました' }, { status: 500 })
  }

  return NextResponse.json(
    {
      site: { name: result.site.name },
      subs: subsRes.data ?? [],
      workTypes: workTypesRes.data ?? [],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
