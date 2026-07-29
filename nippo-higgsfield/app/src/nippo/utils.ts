import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** JSTでの「今日」を YYYY-MM-DD で返す */
export function todayJst(): string {
  return jstDateString(new Date())
}

export function jstDateString(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

/** ISO日時 → 「2026/07/29 14:05」(JST) */
export function formatJstDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${jst.getUTCFullYear()}/${p(jst.getUTCMonth() + 1)}/${p(jst.getUTCDate())} ${p(jst.getUTCHours())}:${p(jst.getUTCMinutes())}`
}

/** YYYY-MM-DD → 2026/07/29(水) */
export function formatDateWithWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const wd = ['日', '月', '火', '水', '木', '金', '土'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}(${wd})`
}

/** YYYY-MM → 当月の初日/末日 */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

export function currentMonth(): string {
  return todayJst().slice(0, 7)
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return ''
  return n.toLocaleString('ja-JP', { maximumFractionDigits: digits })
}

// ---------------- CSV (UTF-8 BOM付き / Excel対応) ----------------

const BOM = '\uFEFF'

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(escapeCell).join(',')]
  for (const row of rows) lines.push(row.map(escapeCell).join(','))
  return BOM + lines.join('\r\n') + '\r\n'
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const REPORT_CSV_HEADER = [
  '日付',
  '現場名',
  '業者名',
  '人数',
  '作業内容',
  '施工面積(m2)',
  '備考',
  '提出日時',
]

// ---------------- fetchヘルパ ----------------

export async function jfetch<T>(
  input: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(input, init)
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: typeof body.message === 'string' ? body.message : '通信に失敗しました',
      }
    }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, status: 0, message: '通信できませんでした。電波の良い場所でお試しください' }
  }
}
