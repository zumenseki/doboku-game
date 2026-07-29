// 作業日報アプリ サーバ専用コア。ルートハンドラから動的importで読み込むこと
// (静的importするとクライアントバンドルに cloudflare:workers が混入する)。
import { env } from 'cloudflare:workers'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'

type NippoEnv = {
  DB?: D1Database
  STORAGE?: R2Bucket
  ADMIN_PASSWORD?: string
  SESSION_SECRET?: string
}

function bindings(): NippoEnv {
  return env as unknown as NippoEnv
}

export function requireDB(): D1Database {
  const { DB } = bindings()
  if (!DB) throw new Error('D1 binding (DB) がありません')
  return DB
}

export function requireR2(): R2Bucket {
  const { STORAGE } = bindings()
  if (!STORAGE) throw new Error('R2 binding (STORAGE) がありません')
  return STORAGE
}

export function secrets() {
  return {
    adminPassword: bindings().ADMIN_PASSWORD ?? '',
    sessionSecret: bindings().SESSION_SECRET ?? '',
  }
}

// ---------------- 汎用レスポンス ----------------

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function uuid(): string {
  return crypto.randomUUID()
}

/** nanoid(21)相当のURLトークン (約126bit)。連番・現場名・日付は含めない */
export function randomToken(length = 21): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] & 63]
  return out
}

// ---------------- 簡易レート制限 (インメモリ・isolate単位) ----------------

type Bucket = { count: number; resetAt: number }
const rateBuckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    if (rateBuckets.size > 5000) {
      for (const [k, b] of rateBuckets) if (b.resetAt <= now) rateBuckets.delete(k)
    }
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown'
}

// ---------------- token → 現場の解決 ----------------

export type SiteRow = {
  id: string
  token: string
  name: string
  address: string | null
  drawing_key: string | null
  drawing_image_key: string | null
  scale_m_per_unit: number | null
  total_area_m2: number | null
  status: string
  opened_on: string | null
  closed_at: string | null
  created_at: string
}

const TOKEN_RE = /^[A-Za-z0-9_-]{21}$/

export type TokenResult =
  | { ok: true; site: SiteRow }
  | { ok: false; status: 404 | 410; message: string }

export async function resolveSiteByToken(token: string): Promise<TokenResult> {
  if (!TOKEN_RE.test(token)) {
    return { ok: false, status: 404, message: 'この日報URLは無効です' }
  }
  const site = await requireDB()
    .prepare('SELECT * FROM sites WHERE token = ?')
    .bind(token)
    .first<SiteRow>()
  if (!site) return { ok: false, status: 404, message: 'この日報URLは無効です' }
  if (site.status === 'closed') {
    return { ok: false, status: 410, message: 'この現場の日報受付は終了しました' }
  }
  return { ok: true, site }
}

// ---------------- 管理者セッション (HMAC署名Cookie) ----------------

const COOKIE_NAME = 'nippo_admin'
const SESSION_DAYS = 30

function b64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return b64url(sig)
}

export async function createSessionCookie(): Promise<string> {
  const { sessionSecret } = secrets()
  if (!sessionSecret) throw new Error('SESSION_SECRET が未設定です')
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const rand = randomToken(16)
  const payload = `${exp}.${rand}`
  const sig = await hmac(sessionSecret, payload)
  const value = `${payload}.${sig}`
  const maxAge = SESSION_DAYS * 24 * 60 * 60
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export async function isAdmin(request: Request): Promise<boolean> {
  const { sessionSecret } = secrets()
  if (!sessionSecret) return false
  const cookie = request.headers.get('cookie') ?? ''
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  if (!match) return false
  const parts = match[1].split('.')
  if (parts.length !== 3) return false
  const [exp, rand, sig] = parts
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false
  const expected = await hmac(sessionSecret, `${exp}.${rand}`)
  if (sig.length !== expected.length) return false
  // 定数時間比較
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

/** 管理APIの入口ガード。未ログインなら401レスポンスを返す */
export async function requireAdmin(request: Request): Promise<Response | null> {
  if (await isAdmin(request)) return null
  return json({ message: 'ログインが必要です' }, 401)
}

/** 写真キーが「この日報のもの」かを検証 */
export function isPhotoKeyOf(objectKey: string, reportId: string): boolean {
  return objectKey.startsWith(`reports/${reportId}/`)
}

/** 管理画面から閲覧してよいR2キーか (パストラバーサル防止) */
export function isReadableKey(key: string): boolean {
  return (
    !key.includes('..') &&
    (key.startsWith('reports/') || key.startsWith('sites/') || key.startsWith('paintmasks/'))
  )
}

/** 色塗りマスクのR2キー (現場×日報ごとに1枚) */
export function maskKeyFor(siteId: string, reportId: string): string {
  return `paintmasks/${siteId}/${reportId}.png`
}

/** この現場の下請けが token 経由で閲覧してよいキーか (図面画像 + 同現場のマスク) */
export function isTokenReadableKey(key: string, site: SiteRow): boolean {
  if (key.includes('..')) return false
  if (site.drawing_image_key && key === site.drawing_image_key) return true
  return key.startsWith(`paintmasks/${site.id}/`)
}
