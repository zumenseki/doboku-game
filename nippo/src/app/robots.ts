import type { MetadataRoute } from 'next'

// 全ページ noindex（§2）。サイトマップは作らない。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}
