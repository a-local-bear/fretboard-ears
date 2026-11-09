// Service worker: precache the app shell and serve it cache-first, so the app works offline.
// The block between the STAMP markers is rewritten by tools/stamp_version.py; don't edit it by hand.

// STAMP:BEGIN
const CACHE = 'fe-f71c942f49';
const PRECACHE = [
  "./",
  "fonts/fraunces-latin-wght-normal.woff2",
  "fonts/manrope-latin-wght-normal.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512-maskable.png",
  "icons/icon-512.png",
  "index.html",
  "js/audio.js",
  "js/data.js",
  "js/deck.js",
  "js/fretboard.js",
  "js/ks.js",
  "js/main.js",
  "js/progress.js",
  "js/storage.js",
  "js/ui.js",
  "manifest.webmanifest",
  "style.css"
];
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
      return (await cache.match('./', { ignoreSearch: true })) || (await cache.match('index.html')) || fetch(req);
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || fetch(req);
  })());
});
