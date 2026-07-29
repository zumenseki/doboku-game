/**
 * 環境変数アクセスの一元化。
 * SUPABASE_SERVICE_ROLE_KEY / R2_* はサーバ専用（NEXT_PUBLIC_ を付けないこと）。
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。.env.example を参照してください。`)
  }
  return value
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
}

export function serverEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  }
}

export function r2Env() {
  return {
    accountId: required('R2_ACCOUNT_ID', process.env.R2_ACCOUNT_ID),
    accessKeyId: required('R2_ACCESS_KEY_ID', process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY', process.env.R2_SECRET_ACCESS_KEY),
    bucket: required('R2_BUCKET', process.env.R2_BUCKET),
  }
}

/** QR / 現場URL の組み立てに使うベースURL */
export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (url) return url.replace(/\/$/, '')
  return ''
}
