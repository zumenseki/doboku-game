import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { appUrl } from '@/lib/env'
import { PrintView } from './print-view'
import type { Site } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** A6印刷ビュー（QR + 現場名）。現場詰所に貼り出す用。 */
export default async function SitePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await supabaseServer()
  const { data } = await supabase.from('sites').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()

  return <PrintView site={data as Site} appUrl={appUrl()} />
}
