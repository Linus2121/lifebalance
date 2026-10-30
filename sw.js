/* LifeBalance service worker: offline cache (network-first) and Web Push display. */
const CACHE = 'lifebalance-work-15';
const ASSETS = ['./', 'index.html', 'styles.css', 'logo.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'config.js', 'js/merge.js', 'js/sync.js', 'js/core.js', 'js/meals.js', 'js/state.js', 'js/region.js', 'js/work.js', 'js/views-work.js', 'js/views-core.js', 'js/views-events.js', 'js/views-wellness.js', 'js/reminders.js', 'js/calendar.js', 'js/settings.js', 'js/main.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  const title = d.title || 'LifeBalance', isTest = String(d.key || '').startsWith('test|');
  const opts = { body: d.body || 'You have a reminder.', tag: d.key || 'lb-reminder', icon: 'logo.png', badge: 'logo.png', data: { url: './', key: d.key, deviceId: d.deviceId, token: d.token, api: d.api, ev: d.ev, title: d.title, body: d.body } };
  if (!isTest && d.token && d.deviceId) opts.actions = [{ action: 'snooze', title: 'Snooze 10 min' }];
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, opts),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage({ type: 'lb-push', key: d.key })))
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const n = e.notification.data || {};
  if (e.action === 'snooze' && n.token && n.deviceId && n.key) {
    const base = String(n.key).replace(/(\|s\d+)+$/, '');
    e.waitUntil(fetch((n.api || '') + '/api/snooze', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: n.deviceId, key: n.key, token: n.token, minutes: 10, newKey: base + '|s' + Date.now(), title: n.title, body: n.body, ev: n.ev }) }).catch(() => {}));
    return;
  }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs[0]; return c ? c.focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './'); }));
});
