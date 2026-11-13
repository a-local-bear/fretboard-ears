// Register the site's service worker. The menu has no state to lose, so a new version is taken at once;
// inside an app, the app decides when (the ear trainer shows "A new version is ready").
if ('serviceWorker' in navigator && window.isSecureContext) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) location.reload(); });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const take = (w) => { if (w && hadController) w.postMessage({ type: 'SKIP_WAITING' }); };
    take(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') take(w); });
    });
  }).catch(() => { /* offline support unavailable; the site still works online */ });
}
