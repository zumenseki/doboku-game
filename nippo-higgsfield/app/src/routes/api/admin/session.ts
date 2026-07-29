import { createFileRoute } from '@tanstack/react-router'

// GET  /api/admin/session → { authed }
// POST /api/admin/session {password} → ログイン (Set-Cookie)
// DELETE /api/admin/session → ログアウト
export const Route = createFileRoute('/api/admin/session')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        return core.json({ authed: await core.isAdmin(request) })
      },
      POST: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')

        if (!core.rateLimit(`login:${core.clientIp(request)}`, 10)) {
          return core.json({ message: '試行が多すぎます。しばらく待ってからお試しください' }, 429)
        }

        const body = (await core.readJson(request)) as { password?: unknown } | null
        const password = typeof body?.password === 'string' ? body.password : ''
        const { adminPassword } = core.secrets()

        if (!adminPassword) {
          return core.json({ message: '管理者パスワードが未設定です (ADMIN_PASSWORD)' }, 500)
        }

        // 定数時間比較
        const a = new TextEncoder().encode(password)
        const b = new TextEncoder().encode(adminPassword)
        let diff = a.length === b.length ? 0 : 1
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          diff |= (a[i % Math.max(a.length, 1)] ?? 0) ^ (b[i % Math.max(b.length, 1)] ?? 0)
        }
        if (a.length !== b.length || diff !== 0) {
          return core.json({ message: 'パスワードが違います' }, 401)
        }

        return core.json({ authed: true }, 200, { 'Set-Cookie': await core.createSessionCookie() })
      },
      DELETE: async () => {
        const core = await import('../../../nippo/server/core.server')
        return core.json({ authed: false }, 200, { 'Set-Cookie': core.clearSessionCookie() })
      },
    },
  },
})
