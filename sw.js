/* Noor Traders Hazri — service worker.
   Sirf app ki apni files cache hoti hain. Hazri/salary ka data (Firebase) yahan se kabhi nahi guzarta. */
const APP_VERSION = 'v201';
const CACHE = 'nt-hazri-' + APP_VERSION;
const SHELL = ['./', './index.html', './styles.css', './boot.js', './app.js', './core.js', './auth.js', './data.js', './ui.js', './owner.js', './staffview.js', './pdf.js', './firebase-config.js', './archivo-latin.woff2', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' }))))));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && (k.startsWith('nt-hazri-') || k.startsWith('noor-traders-'))).map(k => caches.delete(k))))
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;               // Firebase / gstatic seedha internet se
  if (url.pathname.endsWith('version.json')) return;         // update check hamesha taza
  const key = request.mode === 'navigate' ? './index.html' : url.pathname;
  // Network pehle (nayi deployment foran milti hai); internet na ho to cache.
  event.respondWith(
    fetch(request, { cache: 'no-store' }).then(response => {
      if (response && response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(key, copy)).catch(() => {}); }
      return response;
    }).catch(() => caches.match(key, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});
