import { mount } from './ui.js';

mount(document.getElementById('app'));

// ---------- service worker + update toast ----------

function showUpdateToast(worker) {
  if (document.getElementById('update-toast')) return;
  const t = document.createElement('div');
  t.id = 'update-toast';
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML = '<span>A new version is ready.</span><button class="btn primary small" type="button">Reload</button>';
  t.querySelector('button').addEventListener('click', () => worker.postMessage({ type: 'SKIP_WAITING' }));
  document.body.appendChild(t);
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // Only offer an update when an older version already controls the page.
    const offer = (w) => { if (w && navigator.serviceWorker.controller) showUpdateToast(w); };
    offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
    });
    // Check for updates when the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); });
  }).catch(() => { /* offline support unavailable; the app still works online */ });
}
