import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { appUrl } from '@/lib/env'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { NewSiteForm } from './new-site-form'
import { cn, formatJstDateTime } from '@/lib/utils'
import type { Site } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const tab = status === 'closed' ? 'closed' : 'active'

  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('sites')
    .select('*')
    .eq('status', tab)
    .order('created_at', { ascending: false })

  const sites = (data ?? []) as Site[]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">現場管理</h1>

      <NewSiteForm appUrl={appUrl()} />

      <Card>
        <CardHeader className="flex items-center gap-2">
          <CardTitle className="mr-auto">現場一覧</CardTitle>
          <Tab href="/admin/sites?status=active" active={tab === 'active'} label="稼働中" />
          <Tab href="/admin/sites?status=closed" active={tab === 'closed'} label="終了" />
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">現場名</th>
                <th className="px-4 py-2 font-medium">住所</th>
                <th className="w-32 px-4 py-2 font-medium">開始日</th>
                <th className="w-40 px-4 py-2 font-medium">
                  {tab === 'closed' ? '終了日時' : '図面'}
                </th>
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    {tab === 'closed' ? '終了した現場はありません' : '稼働中の現場はありません'}
                  </td>
                </tr>
              )}
              {sites.map((site) => (
                <tr key={site.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/admin/sites/${site.id}`} className="text-sky-700 hover:underline">
                      {site.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{site.address ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{site.opened_on ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {tab === 'closed'
                      ? formatJstDateTime(site.closed_at) || '—'
                      : site.drawing_key
                        ? '登録済'
                        : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/sites/${site.id}`}
                      className="text-sm text-sky-700 hover:underline"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  )
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full px-3 py-1 text-sm',
        active ? 'bg-sky-600 font-semibold text-white' : 'bg-slate-100 text-slate-700',
      )}
    >
      {label}
    </Link>
  )
}
