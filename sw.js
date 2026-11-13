// Service worker: precache the app shell and serve it cache-first, so the app works offline.
// The block between the STAMP markers is rewritten by tools/stamp_version.py; don't edit it by hand.

// STAMP:BEGIN
const CACHE = 'fe-981ab42e56';
const PRECACHE = [
  "./",
  "fonts/jetbrains-mono-latin-wght-normal.woff2",
  "fonts/manrope-latin-wght-normal.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512-maskable.png",
  "icons/icon-512.png",
  "index.html",
  "js/adaptive.js",
  "js/audio.js",
  "js/charts.js",
  "js/data.js",
  "js/deck.js",
  "js/drills.js",
  "js/fretboard.js",
  "js/harmony.js",
  "js/ks.js",
  "js/listen.js",
  "js/main.js",
  "js/mic.js",
  "js/path.js",
  "js/phrase.js",
  "js/pitch.js",
  "js/progress.js",
  "js/reference.js",
  "js/samples.js",
  "js/sequencer.js",
  "js/session.js",
  "js/songs.js",
  "js/stats.js",
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
  "songcraft/index.html",
  "songcraft/js/engine.js",
  "songcraft/js/lessons.js",
  "songcraft/js/main.js",
  "songcraft/js/riff.js",
  "songcraft/js/shapes.js",
  "songcraft/js/song.js",
  "songcraft/js/theory.js",
  "songcraft/js/ui.js",
  "songcraft/style.css",
  "style.css",
  "woozy/css/app.css",
  "woozy/favicon.svg",
  "woozy/index.html",
  "woozy/js/audio/audio.js",
  "woozy/js/audio/dsp.js",
  "woozy/js/audio/engine.js",
  "woozy/js/content/cookbook.js",
  "woozy/js/content/curriculum.js",
  "woozy/js/content/helpers.js",
  "woozy/js/content/m1-foundations.js",
  "woozy/js/content/m3-progressions.js",
  "woozy/js/content/m4-colour-rhythm.js",
  "woozy/js/content/m6-melody.js",
  "woozy/js/content/m7-songwriting.js",
  "woozy/js/dom.js",
  "woozy/js/main.js",
  "woozy/js/music/melody.js",
  "woozy/js/music/theory.js",
  "woozy/js/music/voicings.js",
  "woozy/js/songs.js",
  "woozy/js/store.js",
  "woozy/js/ui/blocks.js",
  "woozy/js/ui/chord-diagram.js",
  "woozy/js/ui/fretboard.js",
  "woozy/js/ui/melody-editor.js",
  "woozy/js/ui/progression.js",
  "woozy/js/ui/quiz.js",
  "woozy/js/ui/tab.js",
  "woozy/js/ui/widgets.js",
  "woozy/js/views/home.js",
  "woozy/js/views/lesson.js",
  "woozy/js/views/studio.js",
  "woozy/js/views/tools.js"
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
      // Songcraft and Woozy are pages of their own; every other address is the single-page ear trainer.
      const path = new URL(req.url).pathname;
      if (/\/songcraft\/(index\.html)?$/.test(path)) return (await cache.match('songcraft/index.html')) || fetch(req);
      if (/\/woozy\/(index\.html)?$/.test(path)) return (await cache.match('woozy/index.html')) || fetch(req);
      return (await cache.match('./', { ignoreSearch: true })) || (await cache.match('index.html')) || fetch(req);
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || fetch(req);
  })());
});
