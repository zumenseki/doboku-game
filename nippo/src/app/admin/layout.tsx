import Link from 'next/link'
import { getAdminUser, supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/reports', label: '日報一覧' },
  { href: '/admin/summary', label: '集計' },
  { href: '/admin/sites', label: '現場管理' },
  { href: '/admin/subs', label: '業者マスタ' },
  { href: '/admin/work-types', label: '工種マスタ' },
  { href: '/admin/settings', label: '設定' },
]

async function signOut() {
  'use server'
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect('/admin/login')
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser()

  // 未ログイン（= /admin/login）はナビ無しでそのまま表示する
  if (!user) return <>{children}</>

  return (
    <div className="min-h-dvh">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/admin" className="text-base font-bold text-slate-900">
            作業日報 管理
          </Link>
          <nav className="flex flex-1 flex-wrap gap-x-3 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOut}>
            <button className="text-sm text-slate-500 hover:text-slate-900">ログアウト</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
