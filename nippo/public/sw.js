// 最小構成のService Worker。
// キャッシュはしない（完全オフライン対応はv2）。
// Chrome が「ホーム画面に追加」を提案する条件として fetch ハンドラが必要なため置いている。
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
