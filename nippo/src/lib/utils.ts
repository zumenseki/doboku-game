import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** JSTでの「今日」を YYYY-MM-DD で返す（サーバがUTCでも日本の日付になる） */
export function todayJst(): string {
  return jstDateString(new Date())
}

export function jstDateString(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

/** timestamptz を「2026/07/29 14:05」形式（JST）にする */
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

/** 当月の初日/末日（JST基準） */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

/** YYYY-MM（JST） */
export function currentMonth(): string {
  return todayJst().slice(0, 7)
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return ''
  return n.toLocaleString('ja-JP', { maximumFractionDigits: digits })
}
