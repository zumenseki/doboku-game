import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env'

let cached: SupabaseClient | null = null

/**
 * service_role キーを使うサーバ専用クライアント。RLSをバイパスする。
 * 下請け側（ログインなし）の読み書きは必ずこのクライアント経由で Route Handler 内から行う。
 * 絶対にクライアントコンポーネントから import しないこと（'server-only' で保護）。
 */
export function supabaseService(): SupabaseClient {
  if (cached) return cached
  const { supabaseUrl, serviceRoleKey } = serverEnv()
  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
