import * as React from 'react'
import { Button, Modal, ErrorBox, SuccessBox } from './ui'
import { jfetch, toCsv, downloadCsv, formatNumber } from './utils'

/**
 * Excel (.xlsx / .xls / .csv) から業者・現場を一括登録する。
 * SheetJSは押されたときだけ動的ロードする (管理PCのみ)。
 * CSVはUTF-8とShift_JIS(Excel既定)の両方に対応。
 */

type Kind = 'subs' | 'sites'

type ParsedRow = {
  name: string
  displayOrder?: number
  address?: string
  totalAreaM2?: number | ''
  invalid?: string
}

type ImportResult = { created: number; skipped: { row: number; name: string; reason: string }[] }

const CONFIG: Record<
  Kind,
  { label: string; columns: string[]; headerWords: string[]; template: unknown[][] }
> = {
  subs: {
    label: '業者',
    columns: ['業者名', '表示順(任意)'],
    headerWords: ['業者名', '名称', '業者', '表示順', 'name'],
    template: [
      ['サンプル建設', 10],
      ['サンプル工業', 20],
    ],
  },
  sites: {
    label: '現場',
    columns: ['現場名', '住所(任意)', '総施工面積m²(任意)'],
    headerWords: ['現場名', '名称', '住所', '面積', '現場', 'name'],
    template: [
      ['第1工区 道路改良工事', '東京都千代田区1-1', 3500],
      ['○○ビル外構工事', '', ''],
    ],
  },
}

async function decodeCsv(buffer: ArrayBuffer): Promise<string> {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    // ExcelのCSV既定はShift_JIS
    return new TextDecoder('shift_jis').decode(buffer)
  }
}

export function ImportExcel({ kind, onDone }: { kind: Kind; onDone: () => void }) {
  const cfg = CONFIG[kind]
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [rows, setRows] = React.useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [result, setResult] = React.useState<ImportResult | null>(null)

  async function handleFile(file: File) {
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = /\.csv$/i.test(file.name)
        ? XLSX.read(await decodeCsv(buffer), { type: 'string' })
        : XLSX.read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) throw new Error('シートが見つかりません')
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as unknown[][]

      const parsed: ParsedRow[] = []
      for (const cells of raw) {
        const c0 = String(cells[0] ?? '').trim()
        const c1 = String(cells[1] ?? '').trim()
        const c2 = String(cells[2] ?? '').trim()
        if (!c0 && !c1 && !c2) continue
        // 見出し行はスキップ
        if (parsed.length === 0 && cfg.headerWords.some((w) => c0.toLowerCase().includes(w.toLowerCase()))) {
          continue
        }
        if (kind === 'subs') {
          const orderNum = c1 === '' ? undefined : Number(c1)
          parsed.push({
            name: c0,
            displayOrder: orderNum !== undefined && Number.isFinite(orderNum) ? orderNum : undefined,
            invalid: !c0 ? '名前が空' : c0.length > 60 ? '60文字超' : undefined,
          })
        } else {
          const areaNum = c2 === '' ? '' : Number(c2)
          parsed.push({
            name: c0,
            address: c1,
            totalAreaM2: areaNum === '' ? '' : Number.isFinite(areaNum) ? areaNum : '',
            invalid: !c0
              ? '名前が空'
              : c0.length > 120
                ? '120文字超'
                : c2 !== '' && !Number.isFinite(Number(c2))
                  ? '面積が数値でない'
                  : undefined,
          })
        }
        if (parsed.length >= 500) break
      }
      if (parsed.length === 0) throw new Error('登録できる行が見つかりませんでした')
      setFileName(file.name)
      setRows(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ファイルを読み込めませんでした')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function submit() {
    if (!rows) return
    const valid = rows.filter((r) => !r.invalid)
    setBusy(true)
    setError('')
    const res = await jfetch<ImportResult>('/api/admin/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        rows: valid.map((r) =>
          kind === 'subs'
            ? { name: r.name, displayOrder: r.displayOrder }
            : { name: r.name, address: r.address, totalAreaM2: r.totalAreaM2 },
        ),
      }),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setRows(null)
    setResult(res.data)
    onDone()
  }

  function downloadTemplate() {
    downloadCsv(`${cfg.label}インポート様式.csv`, toCsv(cfg.columns, cfg.template))
  }

  const validCount = rows?.filter((r) => !r.invalid).length ?? 0
  const invalidCount = (rows?.length ?? 0) - validCount

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? '読み込み中…' : `📄 Excelから${cfg.label}を一括登録`}
        </Button>
        <button onClick={downloadTemplate} className="text-xs text-sky-700 underline">
          様式をダウンロード
        </button>
      </div>

      {error && (
        <div className="mt-2">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}

      {result && (
        <div className="mt-2">
          <SuccessBox>
            {formatNumber(result.created)}件の{cfg.label}を登録しました
            {result.skipped.length > 0 && `（${result.skipped.length}件スキップ）`}
            {result.skipped.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {result.skipped.slice(0, 10).map((s) => (
                  <li key={`${s.row}-${s.name}`}>
                    {s.row}行目 {s.name || '(名前なし)'}: {s.reason}
                  </li>
                ))}
                {result.skipped.length > 10 && <li>ほか{result.skipped.length - 10}件</li>}
              </ul>
            )}
          </SuccessBox>
        </div>
      )}

      {/* プレビュー → 確認 */}
      <Modal
        open={rows !== null}
        onClose={() => setRows(null)}
        title={`${cfg.label}の一括登録プレビュー`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRows(null)}>
              キャンセル
            </Button>
            <Button disabled={busy || validCount === 0} onClick={() => void submit()}>
              {busy ? '登録中…' : `${validCount}件を登録する`}
            </Button>
          </>
        }
      >
        <p className="mb-2 text-xs text-slate-500">
          {fileName} — {formatNumber(rows?.length ?? 0)}行読み込み
          {invalidCount > 0 && (
            <span className="ml-1 text-red-700">（{invalidCount}行は不備のため登録されません）</span>
          )}
          。同名の{cfg.label}が既にある行は登録時にスキップされます。
        </p>
        <div className="max-h-[45dvh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-2 py-1.5 font-medium">#</th>
                {cfg.columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 font-medium">
                    {c}
                  </th>
                ))}
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).slice(0, 200).map((r, i) => (
                <tr key={i} className={`border-t border-slate-100 ${r.invalid ? 'bg-red-50' : ''}`}>
                  <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                  <td className="px-2 py-1 font-medium">{r.name}</td>
                  {kind === 'subs' ? (
                    <td className="px-2 py-1">{r.displayOrder ?? ''}</td>
                  ) : (
                    <>
                      <td className="px-2 py-1">{r.address}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.totalAreaM2}</td>
                    </>
                  )}
                  <td className="px-2 py-1 text-red-700">{r.invalid}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(rows?.length ?? 0) > 200 && (
            <p className="px-2 py-1.5 text-center text-xs text-slate-500">
              …ほか{(rows?.length ?? 0) - 200}行（登録には全行含まれます）
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
