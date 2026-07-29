/** UTF-8 BOM。Excelでの文字化け対策（§7） */
const BOM = '\uFEFF'

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** ヘッダ + 行から BOM付きUTF-8 CSV文字列を作る */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(escapeCell).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','))
  }
  return BOM + lines.join('\r\n') + '\r\n'
}

/** ブラウザでCSVをダウンロードさせる */
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

/** 日報CSVの列順（§7） */
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
