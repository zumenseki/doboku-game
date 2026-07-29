import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '@/lib/env'

/**
 * 管理者セッション（Supabase Auth）付きのサーバクライアント。
 * anonキー + ログイン中ユーザーのJWTで動くため、RLSの authenticated ポリシーが適用される。
 */
export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Component から呼ばれた場合は書き込めない。middleware 側で更新されるので無視してよい。
        }
      },
    },
  })
}

/** ログイン中の管理者ユーザーを返す。未ログインなら null。 */
export async function getAdminUser() {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

/**
 * Server Action / Route Handler の入口で使う管理者ガード。
 * middleware だけに頼らず、書き込み処理側でも必ず確認する。
 */
export async function requireAdmin() {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('ログインが必要です')
  return { user: data.user, supabase }
}
