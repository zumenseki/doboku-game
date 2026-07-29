import type { Metadata } from 'next'
import { resolveSiteByToken } from '@/lib/site-token'
import { supabaseService } from '@/lib/supabase/service'
import { ReportForm } from './report-form'
import { InstallPrompt } from '@/components/install-prompt'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '作業日報の入力',
  robots: { index: false, follow: false, nocache: true },
}

function ClosedScreen({ message, status }: { message: string; status: 404 | 410 | 503 }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="text-4xl">{status === 503 ? '📡' : '🚧'}</div>
        <p className="mt-4 text-lg font-semibold text-slate-900">{message}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {status === 503
            ? '電波の良い場所で、画面を再読み込みしてください。'
            : 'お手数ですが、元請の担当者にご連絡ください。'}
        </p>
      </div>
    </main>
  )
}

export default async function SiteReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await resolveSiteByToken(token)

  if (!result.ok) {
    return <ClosedScreen message={result.message} status={result.status} />
  }

  const db = supabaseService()
  const [subsRes, workTypesRes] = await Promise.all([
    db
      .from('subs')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    db
      .from('work_types')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
  ])

  return (
    <>
      <ReportForm
        token={token}
        siteName={result.site.name}
        subs={subsRes.data ?? []}
        workTypes={(workTypesRes.data ?? []).map((w) => w.name)}
      />
      <InstallPrompt />
    </>
  )
}
