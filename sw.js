// Service worker: precache the app shell and serve it cache-first, so the app works offline.
// The block between the STAMP markers is rewritten by tools/stamp_version.py; don't edit it by hand.

// STAMP:BEGIN
const CACHE = 'fe-8cbde23119';
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
  "js/mic.js",
  "js/pitch.js",
  "js/progress.js",
  "js/reference.js",
  "js/samples.js",
  "js/storage.js",
  "js/ui.js",
  "manifest.webmanifest",
  "samples/eg-clean/40.mp3",
  "samples/eg-clean/41.mp3",
  "samples/eg-clean/42.mp3",
  "samples/eg-clean/43.mp3",
  "samples/eg-clean/44.mp3",
  "samples/eg-clean/45.mp3",
  "samples/eg-clean/46.mp3",
  "samples/eg-clean/47.mp3",
  "samples/eg-clean/48.mp3",
  "samples/eg-clean/49.mp3",
  "samples/eg-clean/50.mp3",
  "samples/eg-clean/51.mp3",
  "samples/eg-clean/52.mp3",
  "samples/eg-clean/53.mp3",
  "samples/eg-clean/54.mp3",
  "samples/eg-clean/55.mp3",
  "samples/eg-clean/56.mp3",
  "samples/eg-clean/57.mp3",
  "samples/eg-clean/58.mp3",
  "samples/eg-clean/59.mp3",
  "samples/eg-clean/60.mp3",
  "samples/eg-clean/61.mp3",
  "samples/eg-clean/62.mp3",
  "samples/eg-clean/63.mp3",
  "samples/eg-clean/64.mp3",
  "samples/eg-clean/65.mp3",
  "samples/eg-clean/66.mp3",
  "samples/eg-clean/67.mp3",
  "samples/eg-clean/68.mp3",
  "samples/eg-clean/69.mp3",
  "samples/eg-clean/70.mp3",
  "samples/eg-clean/71.mp3",
  "samples/eg-clean/72.mp3",
  "samples/eg-clean/73.mp3",
  "samples/eg-clean/74.mp3",
  "samples/eg-clean/75.mp3",
  "samples/eg-clean/76.mp3",
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
