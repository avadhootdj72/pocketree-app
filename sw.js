// Pocketree offline cache. Serves the app from the phone, then refreshes it in the background,
// so a new version shows on the next launch. Money data is never here (it lives in the app's database).
const CACHE = 'pocketree-app-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // The family invite page is its own page and always comes fresh from the web.
  if (url.pathname.endsWith('/join.html')) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = req.mode === 'navigate' ? new URL('./', self.registration.scope).href : req;
    const hit = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const net = fetch(req).then(res => {
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
