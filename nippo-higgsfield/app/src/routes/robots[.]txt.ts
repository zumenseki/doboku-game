import { createFileRoute } from '@tanstack/react-router'

// 社内業務ツールのため全ページクロール拒否 (§2 noindex)。サイトマップは作らない。
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => {
        return new Response('User-agent: *\nDisallow: /\n', {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
          },
        })
      },
    },
  },
})
