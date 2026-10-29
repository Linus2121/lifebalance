'use strict';
/* LifeBalance reminder server: stores a per-device reminder schedule and delivers Web Push messages when due.
   Plain Node http + web-push. No accounts: each browser registers and gets a random token (stored hashed). */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const webpush = require('web-push');
const accounts = require('./accounts');

const LATE_LIMIT_MS = 60 * 60000, MAX_ITEMS = 500, MAX_ATTEMPTS = 5, MAX_DEVICES = 2000, MAX_BODY = 512 * 1024, MAX_SYNC_BODY = 4 * 1024 * 1024, MAX_SNOOZES = 50;
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const STATIC = { 'index.html': 'text/html; charset=utf-8', 'config.js': 'text/javascript', 'styles.css': 'text/css', 'sw.js': 'text/javascript', 'logo.png': 'image/png', 'manifest.webmanifest': 'application/manifest+json', 'icons/icon-192.png': 'image/png', 'icons/icon-512.png': 'image/png' };

function loadVapid(dir, env) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const f = path.join(dir, 'vapid.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* generate */ }
  const k = webpush.generateVAPIDKeys(); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(f, JSON.stringify(k), { mode: 0o600 }); return k;
}

function createApp(opts) {
  opts = opts || {};
  const env = opts.env || process.env, dir = opts.dataDir || path.join(__dirname, 'data'), now = opts.now || Date.now;
  const vapid = opts.vapid || loadVapid(dir, env), subject = env.VAPID_SUBJECT || 'mailto:admin@example.com';
  const sender = opts.sender || ((sub, payload) => webpush.sendNotification(sub, payload, { vapidDetails: { subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey }, TTL: 3600, urgency: 'high' }));
  const origins = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const staticDir = opts.staticDir === undefined ? path.join(__dirname, '..') : opts.staticDir;
  const dbFile = path.join(dir, 'db.json');
  const masterKey = opts.masterKey || accounts.loadMasterKey(dir, env);
  const acct = accounts.create({ dir, now, masterKey });
  const snoozeToken = (devId, key) => crypto.createHmac('sha256', masterKey).update('snooze|' + devId + '|' + key).digest('base64url');
  const stats = { failures: 0, lastError: '', lastSentAt: 0 };
  let db = { devices: {} };
  try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); if (!db.devices) db.devices = {}; } catch (e) { /* new */ }
  let dirty = false;
  const save = () => {
    if (!dirty) return; dirty = false; fs.mkdirSync(dir, { recursive: true });
    const tmp = dbFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 }); fs.renameSync(tmp, dbFile);
  };
  const hits = new Map();
  const limited = (ip, bucket, max, windowMs) => {
    const k = bucket + '|' + ip, t = now(), a = (hits.get(k) || []).filter(x => x > t - windowMs); a.push(t); hits.set(k, a); return a.length > max;
  };

  function validSub(s) {
    return s && typeof s === 'object' && typeof s.endpoint === 'string' && s.endpoint.length < 1000 && /^https:\/\//.test(s.endpoint) && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string' && s.keys.p256dh.length < 200 && s.keys.auth.length < 100;
  }
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

  async function deliver(dev, payload) {
    try { await sender(dev.subscription, JSON.stringify(payload)); return { ok: true }; }
    catch (e) { return { ok: false, gone: e && (e.statusCode === 404 || e.statusCode === 410), error: e && (e.statusCode || e.message) }; }
  }
  // Sends every due reminder once. Gives up after MAX_ATTEMPTS or when more than an hour late.
  async function tick() {
    const t = now();
    for (const id of Object.keys(db.devices)) {
      const dev = db.devices[id]; if (!dev.subscription) continue;
      for (const it of dev.items) {
        if (it.at > t || dev.sent[it.key]) continue;
        if (t - it.at > LATE_LIMIT_MS) { dev.sent[it.key] = -1; dirty = true; continue; }
        const r = await deliver(dev, { title: it.title, body: it.body, key: it.key, deviceId: id, token: snoozeToken(id, it.key), api: dev.api || '', ev: it.ev || '' });
        if (r.ok) { dev.sent[it.key] = t; stats.lastSentAt = t; dirty = true; }
        else if (r.gone) { delete db.devices[id]; dirty = true; break; }
        else { stats.failures++; stats.lastError = String(r.error); dev.attempts[it.key] = (dev.attempts[it.key] || 0) + 1; if (dev.attempts[it.key] >= MAX_ATTEMPTS) dev.sent[it.key] = -1; dirty = true; }
      }
      if (db.devices[id]) {
        const before = dev.items.length; dev.items = dev.items.filter(i => i.at > t - 2 * LATE_LIMIT_MS || !dev.sent[i.key]);
        Object.keys(dev.sent).forEach(k => { if (!dev.items.some(i => i.key === k)) { delete dev.sent[k]; delete dev.attempts[k]; } });
        if (dev.items.length !== before) dirty = true;
      }
    }
    save();
  }

  function cors(req, res) {
    const o = req.headers.origin;
    if (o && origins.includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'); }
  }
  const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(obj)); };
  const readBody = (req, max) => new Promise((ok, bad) => {
    let n = 0; const ch = []; max = max || MAX_BODY;
    req.on('data', c => { n += c.length; if (n > max) { bad(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else ch.push(c); });
    req.on('end', () => { if (!ch.length) return ok({}); try { ok(JSON.parse(Buffer.concat(ch).toString('utf8'))); } catch (e) { bad(Object.assign(new Error('bad json'), { code: 400 })); } });
    req.on('error', bad);
  });
  function auth(req) {
    const id = req.headers['x-device-id'], m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const dev = typeof id === 'string' && db.devices[id]; if (!dev || !m) return null;
    return safeEq(dev.tokenHash, sha(m[1])) ? dev : null;
  }

  async function api(req, res, url) {
    const ip = req.socket.remoteAddress || '?', p = url.pathname, method = req.method;
    if (limited(ip, 'all', 240, 60000)) return send(res, 429, { error: 'Too many requests' });
    if (p === '/api/config' && method === 'GET') return send(res, 200, { publicKey: vapid.publicKey, accounts: true, version: 4 });
    if (p === '/api/register' && method === 'POST') {
      if (limited(ip, 'reg', 20, 3600000)) return send(res, 429, { error: 'Too many registrations' });
      if (Object.keys(db.devices).length >= MAX_DEVICES) return send(res, 503, { error: 'Server is full' });
      const deviceId = crypto.randomUUID(), token = crypto.randomBytes(32).toString('base64url');
      db.devices[deviceId] = { tokenHash: sha(token), subscription: null, items: [], sent: {}, attempts: {}, createdAt: now() }; dirty = true; save();
      return send(res, 200, { deviceId, token });
    }
    const bearer = () => { const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); return m ? m[1] : ''; };
    const label = r => clip(req.headers['user-agent'] || '', 60);
    /* ----- accounts and sync ----- */
    if (p === '/api/account/register' || p === '/api/account/login') {
      if (method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      const b = await readBody(req);
      if (limited(ip, 'auth', 20, 15 * 60000) || limited(String(b.email || '').toLowerCase(), 'authm', 10, 15 * 60000)) return send(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
      const r = p.endsWith('register') ? await acct.register(b.email, b.password, label()) : await acct.login(b.email, b.password, label());
      return r.error ? send(res, r.code, { error: r.error }) : send(res, 200, { token: r.token, email: r.email });
    }
    if (p.startsWith('/api/account') || p === '/api/sync' || p.startsWith('/api/backups')) {
      const user = acct.auth(bearer()); if (!user) return send(res, 401, { error: 'Please sign in again.' });
      if (p === '/api/account' && method === 'GET') return send(res, 200, { email: user.email });
      if (p === '/api/account/logout' && method === 'POST') { acct.logout(bearer()); return send(res, 200, { ok: true }); }
      if (p === '/api/account/password' && method === 'POST') {
        const b = await readBody(req); if (limited(ip, 'pw', 10, 15 * 60000)) return send(res, 429, { error: 'Too many attempts.' });
        const r = await acct.changePassword(user.id, b.oldPassword, b.newPassword); return r.error ? send(res, r.code, { error: r.error }) : send(res, 200, { token: r.token });
      }
      if (p === '/api/account' && method === 'DELETE') {
        const b = await readBody(req); if (limited(ip, 'pw', 10, 15 * 60000)) return send(res, 429, { error: 'Too many attempts.' });
        const r = await acct.deleteAccount(user.id, b.password); return r.error ? send(res, r.code, { error: r.error }) : send(res, 200, { ok: true });
      }
      if (p === '/api/sync' && method === 'GET') return send(res, 200, acct.getData(user.id));
      if (p === '/api/sync' && method === 'PUT') {
        const b = await readBody(req, MAX_SYNC_BODY);
        if (!b || typeof b.data !== 'object' || b.data === null || Array.isArray(b.data) || !Number.isInteger(b.baseRev) || b.baseRev < 0) return send(res, 400, { error: 'Invalid sync request' });
        const r = acct.putData(user.id, b.baseRev, b.data, b.force === true);
        return r.conflict ? send(res, 409, { error: 'The cloud copy changed on another device.', rev: r.rev, updatedAt: r.updatedAt, data: r.data }) : send(res, 200, r);
      }
      if (p === '/api/backups' && method === 'GET') return send(res, 200, { backups: acct.listBackups(user.id) });
      const bm = /^\/api\/backups\/([\w-]{1,64})$/.exec(p);
      if (bm && method === 'GET') { const b = acct.getBackup(user.id, bm[1]); return b ? send(res, 200, b) : send(res, 404, { error: 'Backup not found' }); }
      return send(res, 404, { error: 'Not found' });
    }
    /* ----- snooze: device token or a per-reminder signed token (used by the notification button while the app is closed) ----- */
    if (p === '/api/snooze' && method === 'POST') {
      const b = await readBody(req); let d = auth(req), id = req.headers['x-device-id'];
      if (!d && typeof b.deviceId === 'string' && db.devices[b.deviceId] && typeof b.key === 'string' && typeof b.token === 'string' && safeEq(b.token, snoozeToken(b.deviceId, b.key))) { d = db.devices[b.deviceId]; id = b.deviceId; }
      if (!d) return send(res, 401, { error: 'Unauthorised' });
      if (!d.subscription) return send(res, 409, { error: 'No push subscription for this device' });
      const mins = Math.round(+b.minutes), baseKey = clip(b.key, 200).replace(/(\|s\d+)+$/, ''), nk = clip(b.newKey || baseKey + '|s' + now(), 200);
      if (!(mins >= 1 && mins <= 1440) || typeof b.key !== 'string' || !nk.startsWith(baseKey)) return send(res, 400, { error: 'Invalid snooze' });
      const at = now() + mins * 60000;
      d.items = d.items.filter(i => i.key !== nk);
      if (d.items.filter(i => i.snooze).length >= MAX_SNOOZES) return send(res, 429, { error: 'Too many snoozed reminders' });
      d.items.push({ key: nk, at, title: clip(b.title, 100) || 'LifeBalance', body: clip(b.body, 200) || 'You have a reminder.', snooze: true, ev: clip(b.ev, 64) }); dirty = true; save();
      return send(res, 200, { at });
    }
    const dev = auth(req); if (!dev) return send(res, 401, { error: 'Unauthorised' });
    const id = req.headers['x-device-id'];
    if (p === '/api/subscription' && method === 'POST') {
      const b = await readBody(req); if (!validSub(b.subscription)) return send(res, 400, { error: 'Invalid push subscription' });
      dev.subscription = { endpoint: b.subscription.endpoint, keys: { p256dh: b.subscription.keys.p256dh, auth: b.subscription.keys.auth } };
      dev.api = typeof b.api === 'string' && /^https?:\/\/[^\s]{1,190}$/.test(b.api) ? b.api.replace(/\/+$/, '') : ''; dirty = true; save(); return send(res, 200, { ok: true });
    }
    if (p === '/api/schedule' && method === 'PUT') {
      if (!dev.subscription) return send(res, 409, { error: 'No push subscription registered for this device' });
      const b = await readBody(req); if (!Array.isArray(b.items)) return send(res, 400, { error: 'items must be a list' });
      if (b.items.length > MAX_ITEMS) return send(res, 400, { error: 'Too many reminders (max ' + MAX_ITEMS + ')' });
      const seen = new Set(), items = [];
      for (const x of b.items) {
        if (!x || typeof x.key !== 'string' || !x.key || x.key.length > 200 || !Number.isFinite(x.at)) return send(res, 400, { error: 'Invalid reminder' });
        if (seen.has(x.key)) continue; seen.add(x.key); // duplicates are ignored so an alert is never sent twice
        items.push({ key: x.key, at: Math.floor(x.at), title: clip(x.title, 100) || 'LifeBalance', body: clip(x.body, 200) || 'You have a reminder.', ev: clip(x.ev, 64) });
      }
      // Server-side snoozes survive a schedule update unless the device stopped receiving reminders or the appointment was cancelled/deleted.
      const active = Array.isArray(b.activeEvents) ? new Set(b.activeEvents.map(String)) : null;
      const keepSnoozes = b.receive === false ? [] : dev.items.filter(i => i.snooze && !seen.has(i.key) && (!active || !i.ev || active.has(i.ev)));
      keepSnoozes.forEach(i => items.push(i));
      const t = now(); const sent = {}, attempts = {};
      items.forEach(i => { if (dev.sent[i.key]) sent[i.key] = dev.sent[i.key]; if (dev.attempts[i.key]) attempts[i.key] = dev.attempts[i.key]; });
      dev.items = items; dev.sent = sent; dev.attempts = attempts; dirty = true; save();
      return send(res, 200, { scheduled: items.filter(i => !sent[i.key] && i.at > t - LATE_LIMIT_MS).length, snoozed: keepSnoozes.length });
    }
    if (p === '/api/test' && method === 'POST') {
      if (!dev.subscription) return send(res, 409, { error: 'No push subscription' });
      const r = await deliver(dev, { title: 'LifeBalance', body: 'This is a test alert.', key: 'test|' + now() });
      if (r.gone) { delete db.devices[id]; dirty = true; save(); return send(res, 410, { error: 'Subscription expired' }); }
      return r.ok ? send(res, 200, { ok: true }) : send(res, 502, { error: 'Push service error: ' + r.error });
    }
    if (p === '/api/status' && method === 'GET') return send(res, 200, { subscribed: !!dev.subscription, pending: dev.items.filter(i => !dev.sent[i.key]).length, failures: stats.failures, lastError: stats.lastError, lastSentAt: stats.lastSentAt });
    if (p === '/api/device' && method === 'DELETE') { delete db.devices[id]; dirty = true; save(); return send(res, 200, { ok: true }); }
    return send(res, 404, { error: 'Not found' });
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) {
        cors(req, res); if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
        return await api(req, res, url);
      }
      if (!staticDir || req.method !== 'GET') { res.writeHead(404); return res.end('Not found'); }
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const ok = STATIC[rel] || (/^js\/[\w-]+\.js$/.test(rel) && 'text/javascript');
      const f = path.join(staticDir, rel);
      if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': ok, 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
    } catch (e) { if (!res.headersSent) send(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.code === 413 ? 'Request too large' : e.code === 400 ? 'Invalid JSON' : 'Server error' }); }
  });
  return { server, tick, db: () => db, vapid, save };
}

module.exports = { createApp };

if (require.main === module) {
  const port = +process.env.PORT || 8787, app = createApp();
  setInterval(() => app.tick().catch(e => console.error('tick failed', e.message)), 10000);
  app.server.listen(port, () => console.log('LifeBalance reminder server on port ' + port));
}
