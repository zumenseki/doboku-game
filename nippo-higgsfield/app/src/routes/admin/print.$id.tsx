import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button, ErrorBox } from '../../nippo/ui'
import { QrCode } from '../../nippo/qr'
import { jfetch } from '../../nippo/utils'

export const Route = createFileRoute('/admin/print/$id')({
  component: PrintPage,
})

type SiteDetail = {
  site: { id: string; token: string; name: string; address: string | null }
}

/** A6印刷ビュー (QR + 現場名)。現場詰所に貼り出す用。 */
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
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}/r/${site.token}`

  return (
    <div className="min-h-dvh bg-white p-4">
      <style>{`
        @page { size: A6 portrait; margin: 6mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center gap-3">
        <Button onClick={() => window.print()}>印刷する</Button>
        <span className="text-sm text-slate-600">A6サイズ（105×148mm）で印刷されます</span>
      </div>

      <div className="mx-auto flex w-[105mm] flex-col items-center justify-start border border-slate-200 p-[6mm] text-center print:w-auto print:border-0">
        <p className="text-[10pt] tracking-wide text-slate-500">作業日報 入力用QR</p>
        <h1 className="mt-1 text-[15pt] font-bold leading-tight text-slate-900">{site.name}</h1>
        {site.address && <p className="mt-1 text-[8pt] text-slate-600">{site.address}</p>}
        <div className="my-[4mm]">
          <QrCode value={url} size={300} className="h-[62mm] w-[62mm]" />
        </div>
        <p className="break-all text-[7pt] text-slate-500">{url}</p>
        <p className="mt-[3mm] text-[9pt] leading-snug text-slate-800">
          スマホのカメラでQRを読み取り
          <br />
          その日の作業内容を入力してください
        </p>
      </div>
    </div>
  )
}
