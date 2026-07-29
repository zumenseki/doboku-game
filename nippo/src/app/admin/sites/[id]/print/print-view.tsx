'use client'
import { Button } from '@/components/ui/button'
import { QrCode } from '@/components/qr-code'
import type { Site } from '@/lib/types'

export function PrintView({ site, appUrl }: { site: Site; appUrl: string }) {
  const base = appUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  const url = `${base}/r/${site.token}`

  return (
    <div className="bg-white">
      <style>{`
        @page { size: A6 portrait; margin: 6mm; }
        @media print {
          html, body { background: #fff !important; }
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
