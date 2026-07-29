/**
 * 簡易レート制限（§8）。インメモリ・固定ウィンドウ。
 * サーバレスではインスタンスごとに独立するため厳密ではないが、
 * 誤操作の連打・単純な悪戯を弾く目的には十分。
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000

/**
 * @returns true = 許可 / false = 制限超過
 */
export function rateLimit(key: string, limit = 10, windowMs = WINDOW_MS): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 5000) sweep(now)
    return true
  }

  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}
