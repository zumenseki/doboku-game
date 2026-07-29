// 最小構成のService Worker (キャッシュなし)。
// Chromeの「ホーム画面に追加」提案条件を満たすために置いている。
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
