import 'server-only'
import { supabaseService } from '@/lib/supabase/service'
import type { Site } from '@/lib/types'

export type TokenResult =
  | { ok: true; site: Site }
  | { ok: false; status: 404 | 410 | 503; message: string }

/** nanoid(21) の形。桁・文字種が合わないものはDBを引く前に弾く。 */
const TOKEN_RE = /^[A-Za-z0-9_-]{21}$/

/**
 * token → 現場の解決。必ずサーバ側（Route Handler / Server Component）で行う。
 * クライアントに anon キーで sites を読ませない（§2）。
 */
export async function resolveSiteByToken(token: string): Promise<TokenResult> {
  if (!TOKEN_RE.test(token)) {
    return { ok: false, status: 404, message: 'この日報URLは無効です' }
  }

  let data: unknown = null
  try {
    const res = await supabaseService().from('sites').select('*').eq('token', token).maybeSingle()
    if (res.error) throw new Error(res.error.message)
    data = res.data
  } catch (e) {
    console.error('resolveSiteByToken failed', e)
    return {
      ok: false,
      status: 503,
      message: '接続できませんでした。時間をおいて再度お試しください',
    }
  }

  if (!data) {
    return { ok: false, status: 404, message: 'この日報URLは無効です' }
  }
  if ((data as Site).status === 'closed') {
    return { ok: false, status: 410, message: 'この現場の日報受付は終了しました' }
  }
  return { ok: true, site: data as Site }
}
