import { mount } from './ui.js';

mount(document.getElementById('app'));

// The service worker of the site (one folder up) also caches this app, so it works offline.
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('../sw.js').catch(() => { /* offline support unavailable; the app still works online */ });
}
