import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { appUrl } from '@/lib/env'
import { SiteDetail } from './site-detail'
import type { Site } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await supabaseServer()

  const { data } = await supabase.from('sites').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()

  const { count } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', id)

  return <SiteDetail site={data as Site} appUrl={appUrl()} reportCount={count ?? 0} />
}
