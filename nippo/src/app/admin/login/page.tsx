'use client'
import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError('メールアドレスまたはパスワードが違います')
      return
    }
    const next = params.get('next') ?? '/admin'
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">管理画面ログイン</h1>

      <div>
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="password">パスワード</Label>
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

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'ログイン中…' : 'ログイン'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <React.Suspense fallback={null}>
        <LoginForm />
      </React.Suspense>
    </main>
  )
}
