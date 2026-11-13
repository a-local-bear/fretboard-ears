// Service worker for the whole site: precache the menu and every app, and serve them cache-first,
// so everything works offline. tools/site.py replaces the block between the STAMP markers with the
// file list and a hash of the files' contents; any change gives a new cache name, so browsers see a new worker.

// STAMP:BEGIN
const CACHE = 'fe-dev';
const PRECACHE = ['./'];
// STAMP:END

self.addEventListener('install', (event) => {
  // Wait in "installed" until the page asks to activate (update toast), except on first install.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('fe-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      // A folder address is that folder's index.html: the menu, or one of the apps.
      const path = new URL(req.url).pathname;
      const page = path.endsWith('/') ? path + 'index.html' : path;
      return (await cache.match(page, { ignoreSearch: true })) || fetch(req);
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || fetch(req);
  })());
});
