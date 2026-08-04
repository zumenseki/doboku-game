import * as React from 'react'
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Button, Input, Label, ErrorBox } from '../../nippo/ui'
import { cn, jfetch } from '../../nippo/utils'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

const NAV = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/reports', label: '日報一覧' },
  { href: '/admin/summary', label: '集計' },
  { href: '/admin/sites', label: '現場管理' },
  { href: '/admin/assignments', label: '日報URL一覧' },
  { href: '/admin/subs', label: '業者マスタ' },
  { href: '/admin/work-types', label: '工種マスタ' },
  { href: '/admin/settings', label: '設定' },
] as const

/**
 * 今どのタブを見ているかを判定する。
 * 現場詳細(/admin/site/xxx)のような下位ページでも、親のタブ(現場管理)を選択中として扱う。
 */
function isActiveTab(pathname: string, href: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/admin'
  if (href === '/admin') return path === '/admin'
  if (href === '/admin/sites') return path.startsWith('/admin/sites') || path.startsWith('/admin/site/')
  return path === href || path.startsWith(`${href}/`)
}

function AdminLayout() {
  const [authed, setAuthed] = React.useState<boolean | null>(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isPrint = pathname.startsWith('/admin/print')

  React.useEffect(() => {
    void (async () => {
      const res = await jfetch<{ authed: boolean }>('/api/admin/session')
      setAuthed(res.ok ? res.data.authed : false)
    })()
  }, [])

  async function logout() {
    await jfetch('/api/admin/session', { method: 'DELETE' })
    setAuthed(false)
  }

  if (authed === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-slate-500">読み込み中…</p>
      </main>
    )
  }

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />
  }

  // 印刷ビューはナビ無し
  if (isPrint) {
    return <Outlet />
  }

  return (
    <div className="min-h-dvh">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/admin" className="text-base font-bold text-slate-900">
            作業日報 管理
          </Link>
          <nav aria-label="管理メニュー" className="flex flex-1 flex-wrap gap-x-1.5 gap-y-1 text-sm">
            {NAV.map((item) => {
              const active = isActiveTab(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-1.5 transition-colors',
                    active
                      ? 'bg-sky-600 font-bold text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-900">
            ログアウト
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await jfetch<{ authed: boolean }>('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    onSuccess()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-slate-900">管理画面ログイン</h1>
        <div>
          <Label htmlFor="password">管理者パスワード</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
          />
        </div>
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'ログイン中…' : 'ログイン'}
        </Button>
      </form>
    </main>
  )
}
