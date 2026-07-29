'use client'
import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/** 管理者ログイン画面専用のブラウザクライアント（anonキー）。 */
export function supabaseBrowser() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)
}
