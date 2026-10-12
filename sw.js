/* Fuel service worker — offline app shell + food database. Bump VERSION to ship updates. */
const VERSION = 'fuel-v1.4.1';
const SHELL = ['./','index.html','css/app.css','css/themes.css','js/theme-boot.js','js/nutrients.js','js/appearance.js','js/app.js','js/coach.js','css/coach.css','manifest.webmanifest',
  'icons/icon-180.png','icons/icon-192.png','icons/icon-512.png','icons/favicon-32.png','data/foods.json','vendor/zxing.min.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Open Food Facts etc. go straight to network
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined));
      return hit || net;
    })
  );
});
