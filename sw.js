/* LifeBalance service worker: offline cache (network-first) and Web Push display. */
const CACHE = 'lifebalance-v3';
const ASSETS = ['./', 'index.html', 'styles.css', 'logo.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'js/core.js', 'js/meals.js', 'js/state.js', 'js/views-core.js', 'js/views-events.js', 'js/views-wellness.js', 'js/reminders.js', 'js/calendar.js', 'js/settings.js', 'js/main.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  const title = d.title || 'LifeBalance';
  e.waitUntil(self.registration.showNotification(title, { body: d.body || 'You have a reminder.', tag: d.key || 'lb-reminder', icon: 'logo.png', badge: 'logo.png', data: { url: './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs[0]; return c ? c.focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './'); }));
});
