'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path'), webpush = require('web-push');
const { createApp } = require('../server');

const SUB = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'BPk', auth: 'auth' } };
async function setup(extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lbs-')), sent = []; let clock = 1_000_000_000_000, fail = null;
  const app = createApp(Object.assign({ dataDir: dir, staticDir: null, env: { ALLOWED_ORIGINS: 'https://ok.example' }, now: () => clock, sender: async (sub, payload) => { if (fail) throw fail; sent.push({ sub, payload: JSON.parse(payload) }); } }, extra));
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const call = (m, p, body, dev, headers) => fetch(base + p, { method: m, headers: Object.assign({ 'Content-Type': 'application/json' }, dev ? { Authorization: 'Bearer ' + dev.token, 'X-Device-Id': dev.deviceId } : {}, headers), body: body === undefined ? undefined : JSON.stringify(body) });
  return { app, dir, sent, call, base, advance: ms => { clock += ms; }, time: () => clock, setFail: e => { fail = e; }, close: () => app.server.close() };
}
async function device(s) { const dev = await (await s.call('POST', '/api/register')).json(); await s.call('POST', '/api/subscription', { subscription: SUB }, dev); return dev; }

test('rejects requests without valid credentials', async () => {
  const s = await setup(); const dev = await device(s);
  assert.equal((await s.call('PUT', '/api/schedule', { items: [] })).status, 401);
  assert.equal((await s.call('PUT', '/api/schedule', { items: [] }, { deviceId: dev.deviceId, token: 'wrong' })).status, 401);
  assert.equal((await s.call('PUT', '/api/schedule', { items: [] }, dev)).status, 200);
  s.close();
});
test('devices cannot see or change each other', async () => {
  const s = await setup(); const a = await device(s), b = await device(s);
  await s.call('PUT', '/api/schedule', { items: [{ key: 'k1', at: s.time() + 1000, title: 't', body: 'b' }] }, a);
  assert.equal((await (await s.call('GET', '/api/status', undefined, b)).json()).pending, 0);
  assert.equal((await s.call('GET', '/api/status', undefined, { deviceId: a.deviceId, token: b.token })).status, 401);
  s.close();
});
test('token is stored hashed', async () => {
  const s = await setup(); const dev = await device(s);
  assert.ok(!JSON.stringify(s.app.db()).includes(dev.token));
  s.close();
});
test('validates subscription and schedule input', async () => {
  const s = await setup(); const dev = await (await s.call('POST', '/api/register')).json();
  assert.equal((await s.call('POST', '/api/subscription', { subscription: { endpoint: 'http://insecure', keys: {} } }, dev)).status, 400);
  assert.equal((await s.call('PUT', '/api/schedule', { items: [] }, dev)).status, 409);
  await s.call('POST', '/api/subscription', { subscription: SUB }, dev);
  assert.equal((await s.call('PUT', '/api/schedule', { items: 'x' }, dev)).status, 400);
  assert.equal((await s.call('PUT', '/api/schedule', { items: [{ key: 'a', at: 'soon' }] }, dev)).status, 400);
  assert.equal((await s.call('PUT', '/api/schedule', { items: Array.from({ length: 501 }, (_, i) => ({ key: 'k' + i, at: 1 })) }, dev)).status, 400);
  s.close();
});
test('delivers due reminders once, ignores duplicates, and counts only real scheduling', async () => {
  const s = await setup(); const dev = await device(s), t = s.time();
  const r = await (await s.call('PUT', '/api/schedule', { items: [{ key: 'a', at: t + 5000, title: 'A', body: 'x' }, { key: 'a', at: t + 5000, title: 'A', body: 'x' }, { key: 'b', at: t + 90000, title: 'B', body: 'y' }] }, dev)).json();
  assert.equal(r.scheduled, 2);
  await s.app.tick(); assert.equal(s.sent.length, 0);
  s.advance(6000); await s.app.tick(); await s.app.tick(); assert.equal(s.sent.length, 1); assert.equal(s.sent[0].payload.key, 'a');
  await s.call('PUT', '/api/schedule', { items: [{ key: 'a', at: t + 5000, title: 'A', body: 'x' }, { key: 'b', at: t + 90000, title: 'B', body: 'y' }] }, dev);
  await s.app.tick(); assert.equal(s.sent.length, 1);
  s.advance(100000); await s.app.tick(); assert.equal(s.sent.length, 2);
  s.close();
});
test('replacing the schedule cancels removed reminders', async () => {
  const s = await setup(); const dev = await device(s), t = s.time();
  await s.call('PUT', '/api/schedule', { items: [{ key: 'a', at: t + 1000, title: 'A', body: '' }] }, dev);
  await s.call('PUT', '/api/schedule', { items: [] }, dev);
  s.advance(5000); await s.app.tick(); assert.equal(s.sent.length, 0);
  s.close();
});
test('drops reminders that are more than an hour late', async () => {
  const s = await setup(); const dev = await device(s), t = s.time();
  await s.call('PUT', '/api/schedule', { items: [{ key: 'a', at: t + 1000, title: 'A', body: '' }] }, dev);
  s.advance(2 * 3600000); await s.app.tick(); assert.equal(s.sent.length, 0);
  s.close();
});
test('retries failures, gives up after 5, and removes expired subscriptions', async () => {
  const s = await setup(); const dev = await device(s), t = s.time();
  await s.call('PUT', '/api/schedule', { items: [{ key: 'a', at: t + 1000, title: 'A', body: '' }] }, dev);
  s.advance(2000); s.setFail(Object.assign(new Error('boom'), { statusCode: 500 }));
  for (let i = 0; i < 7; i++) await s.app.tick();
  s.setFail(null); await s.app.tick(); assert.equal(s.sent.length, 0);
  const d2 = await device(s); await s.call('PUT', '/api/schedule', { items: [{ key: 'z', at: s.time() + 10, title: 'Z', body: '' }] }, d2);
  s.advance(100); s.setFail(Object.assign(new Error('gone'), { statusCode: 410 })); await s.app.tick();
  assert.equal((await s.call('GET', '/api/status', undefined, d2)).status, 401);
  s.close();
});
test('privacy: stores only the text the client supplies', async () => {
  const s = await setup(); const dev = await device(s);
  await s.call('PUT', '/api/schedule', { items: [{ key: 'a', at: s.time() + 1000, title: 'LifeBalance', body: 'You have a reminder.', secret: 'Dr Smith oncology' }] }, dev);
  assert.ok(!JSON.stringify(s.app.db()).includes('oncology'));
  s.close();
});
test('CORS only for allowed origins; unknown routes 404; DELETE removes device', async () => {
  const s = await setup();
  let r = await s.call('GET', '/api/config', undefined, null, { Origin: 'https://ok.example' }); assert.equal(r.headers.get('access-control-allow-origin'), 'https://ok.example');
  r = await s.call('GET', '/api/config', undefined, null, { Origin: 'https://evil.example' }); assert.equal(r.headers.get('access-control-allow-origin'), null);
  const dev = await device(s); assert.equal((await s.call('GET', '/api/nope', undefined, dev)).status, 404);
  assert.equal((await s.call('DELETE', '/api/device', undefined, dev)).status, 200); assert.equal((await s.call('GET', '/api/status', undefined, dev)).status, 401);
  s.close();
});
test('real web-push library can build a request for a generated subscription', () => {
  const v = webpush.generateVAPIDKeys(), ecdh = require('crypto').createECDH('prime256v1'); ecdh.generateKeys();
  const sub = { endpoint: 'https://push.example.com/x', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: require('crypto').randomBytes(16).toString('base64url') } };
  const d = webpush.generateRequestDetails(sub, JSON.stringify({ title: 't' }), { vapidDetails: { subject: 'mailto:a@example.com', publicKey: v.publicKey, privateKey: v.privateKey }, TTL: 60 });
  assert.equal(d.method, 'POST'); assert.ok(d.headers.Authorization.startsWith('vapid')); assert.ok(d.body.length > 0);
});
