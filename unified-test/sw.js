/* 土木ゲーム PWA service worker
   HTML はネット優先（オンライン時は最新／オフライン時はキャッシュ）、
   それ以外（mp3・Three.js・アイコン等）はキャッシュ優先で、オフラインでも遊べるようにする。
   ゲームを更新したら下の CACHE のバージョンを上げる（古いキャッシュは自動削除）。 */
const CACHE = 'doboku-v1';
const LOCAL = ['./', './index.html', './manifest.webmanifest', './track-fwd.mp3', './track-rev.mp3', './icon-192.png', './icon-512.png'];
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try { await c.addAll(LOCAL); } catch (_) {}
    try { await c.add(CDN); } catch (_) {}   // CDN は失敗しても致命的にしない
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');
  if (isHTML) {
    // HTML はネット優先
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, net.clone());
        return net;
      } catch (_) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }
  // それ以外はキャッシュ優先
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const net = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, net.clone());
      return net;
    } catch (_) {
      return hit;
    }
  })());
});
