import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button, ErrorBox } from '../../nippo/ui'
import { QrCode } from '../../nippo/qr'
import { jfetch } from '../../nippo/utils'
import { assignmentUrl, type AssignmentRow } from '../../nippo/assignments'

export const Route = createFileRoute('/admin/print/$id')({
  component: PrintPage,
})

type SiteDetail = {
  site: { id: string; name: string; address: string | null }
  assignments: AssignmentRow[]
}

/** A6印刷ビュー。業者ごとに1枚ずつ（現場名＋業者名＋QR）出力する。 */
function PrintPage() {
  const { id } = Route.useParams()
  const [data, setData] = React.useState<SiteDetail | null>(null)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await jfetch<SiteDetail>(`/api/admin/site?id=${id}`)
      if (cancelled) return
      if (res.ok) setData(res.data)
      else setError(res.message)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!data) {
    return (
      <main className="p-6">
        <ErrorBox>{error}</ErrorBox>
        {!error && <p className="text-sm text-slate-500">読み込み中…</p>}
      </main>
    )
  }

  const site = data.site
  const rows = data.assignments ?? []

  return (
    <div className="min-h-dvh bg-white p-4">
      <style>{`
        @page { size: A6 portrait; margin: 6mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .sheet { page-break-after: always; border: 0 !important; width: auto !important; }
          .sheet:last-child { page-break-after: auto; }
        }
      `}</style>

      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => window.print()} disabled={rows.length === 0}>
          印刷する（{rows.length}枚）
        </Button>
        <span className="text-sm text-slate-600">
          A6サイズ（105×148mm）。業者ごとに1枚ずつ出力されます
        </span>
      </div>

      {rows.length === 0 && (
        <p className="no-print rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          この現場にはまだ業者が割り当てられていません。現場詳細で業者を割り当ててください。
        </p>
      )}

      {rows.map((r) => (
        <div
          key={r.id}
          className="sheet mx-auto mb-6 flex w-[105mm] flex-col items-center justify-start border border-slate-200 p-[6mm] text-center"
        >
          <p className="text-[10pt] tracking-wide text-slate-500">作業日報 入力用QR</p>
          <h1 className="mt-1 text-[15pt] font-bold leading-tight text-slate-900">{site.name}</h1>
          <p className="mt-[2mm] rounded bg-slate-100 px-[4mm] py-[1.5mm] text-[12pt] font-bold text-slate-900">
            {r.sub_name} 様
          </p>
          <div className="my-[3mm]">
            <QrCode value={assignmentUrl(r.token)} size={300} className="h-[56mm] w-[56mm]" />
          </div>
          <p className="break-all text-[7pt] text-slate-500">{assignmentUrl(r.token)}</p>
          <p className="mt-[2mm] text-[9pt] leading-snug text-slate-800">
            スマホのカメラでQRを読み取り
            <br />
            その日の作業内容を入力してください
          </p>
          <p className="mt-[2mm] text-[7.5pt] text-slate-500">
            ※このQRは{r.sub_name}様専用です。他社と共用しないでください
          </p>
        </div>
      ))}
    </div>
  )
}
