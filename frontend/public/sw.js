const CACHE = 'wabulk-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/v1/') || e.request.url.includes('/auth/') || e.request.url.includes('/sessions')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
