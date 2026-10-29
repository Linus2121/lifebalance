'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { createApp } = require('../server');

const SUB = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'BPk', auth: 'auth' } };
async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lbv4-')), sent = [], mails = [], fail = { on: false }; let clock = 1_000_000_000_000;
  const app = createApp({ dataDir: dir, staticDir: null, env: {}, now: () => clock, mailer: async (to, subject, text) => { mails.push({ to, subject, text, code: (/\b(\d{8})\b/.exec(text) || [])[1] }); }, sender: async (sub, payload) => { if (fail.on) throw new Error('boom'); sent.push(JSON.parse(payload)); } });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const call = (m, p, body, tok, dev) => fetch(base + p, { method: m, headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}, dev ? { 'X-Device-Id': dev } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
  return { app, dir, sent, mails, fail, call, base, advance: ms => { clock += ms; }, close: () => app.server.close() };
}
const PW = 'correct horse battery';
const signUp = async (s, email = 'a@example.com') => {
  const r = await (await s.call('POST', '/api/account/register', { email, password: PW })).json(); assert.ok(r.needsVerification, 'expected verification step');
  const code = s.mails[s.mails.length - 1].code;
  return await (await s.call('POST', '/api/account/verify', { email, code })).json();
};

test('accounts: register, login, wrong password, duplicate email, weak password', async () => {
  const s = await setup();
  assert.equal((await s.call('POST', '/api/account/register', { email: 'bad', password: 'correct horse battery' })).status, 400);
  assert.equal((await s.call('POST', '/api/account/register', { email: 'a@example.com', password: 'short' })).status, 400);
  const a = await signUp(s); assert.ok(a.token);
  assert.equal((await s.call('POST', '/api/account/register', { email: 'A@Example.com', password: 'correct horse battery' })).status, 409);
  assert.equal((await s.call('POST', '/api/account/login', { email: 'a@example.com', password: 'wrong password!!' })).status, 401);
  const l = await (await s.call('POST', '/api/account/login', { email: 'a@example.com', password: 'correct horse battery' })).json(); assert.ok(l.token);
  assert.equal((await (await s.call('GET', '/api/account', undefined, l.token)).json()).email, 'a@example.com');
  assert.equal((await s.call('GET', '/api/account', undefined, 'nope')).status, 401);
  s.close();
});
test('accounts: passwords and tokens are not stored in plain text; data is encrypted at rest', async () => {
  const s = await setup(); const a = await signUp(s);
  await s.call('PUT', '/api/sync', { baseRev: 0, data: { tasks: [{ id: '1', title: 'SECRET-DIAGNOSIS' }] } }, a.token);
  const all = fs.readFileSync(path.join(s.dir, 'accounts.json'), 'utf8') + fs.readdirSync(path.join(s.dir, 'users')).map(f => fs.readFileSync(path.join(s.dir, 'users', f), 'utf8')).join('');
  assert.ok(!all.includes('correct horse battery')); assert.ok(!all.includes(a.token)); assert.ok(!all.includes('SECRET-DIAGNOSIS'));
  s.close();
});
test('sync: per-user isolation, revisions and conflict detection', async () => {
  const s = await setup(); const a = await signUp(s), b = await signUp(s, 'b@example.com');
  assert.equal((await s.call('GET', '/api/sync')).status, 401);
  let r = await (await s.call('PUT', '/api/sync', { baseRev: 0, data: { tasks: [{ id: 'x' }] } }, a.token)).json(); assert.equal(r.rev, 1);
  assert.equal((await (await s.call('GET', '/api/sync', undefined, b.token)).json()).data, null);
  assert.equal((await (await s.call('GET', '/api/sync', undefined, a.token)).json()).data.tasks[0].id, 'x');
  const stale = await s.call('PUT', '/api/sync', { baseRev: 0, data: { tasks: [] } }, a.token);
  assert.equal(stale.status, 409); const sj = await stale.json(); assert.equal(sj.rev, 1); assert.equal(sj.data.tasks[0].id, 'x');
  assert.equal((await s.call('PUT', '/api/sync', { baseRev: 'x', data: {} }, a.token)).status, 400);
  assert.equal((await s.call('PUT', '/api/sync', { baseRev: 1, data: [] }, a.token)).status, 400);
  s.close();
});
test('backups: previous versions are kept (at most hourly) and restorable', async () => {
  const s = await setup(); const a = await signUp(s);
  await s.call('PUT', '/api/sync', { baseRev: 0, data: { v: 1 } }, a.token);
  await s.call('PUT', '/api/sync', { baseRev: 1, data: { v: 2 } }, a.token);
  let list = (await (await s.call('GET', '/api/backups', undefined, a.token)).json()).backups; assert.equal(list.length, 1);
  s.advance(2 * 3600e3); await s.call('PUT', '/api/sync', { baseRev: 2, data: { v: 3 } }, a.token);
  list = (await (await s.call('GET', '/api/backups', undefined, a.token)).json()).backups; assert.equal(list.length, 2);
  const old = await (await s.call('GET', '/api/backups/' + list[1].id, undefined, a.token)).json(); assert.equal(old.data.v, 1);
  const b = await signUp(s, 'b@example.com'); assert.equal((await s.call('GET', '/api/backups/' + list[0].id, undefined, b.token)).status, 404);
  s.close();
});
test('accounts: password change signs out other sessions; delete removes data', async () => {
  const s = await setup(); const a = await signUp(s), l = await (await s.call('POST', '/api/account/login', { email: 'a@example.com', password: 'correct horse battery' })).json();
  const c = await (await s.call('POST', '/api/account/password', { oldPassword: 'correct horse battery', newPassword: 'another long passphrase' }, a.token)).json();
  assert.equal((await s.call('GET', '/api/account', undefined, l.token)).status, 401); assert.equal((await s.call('GET', '/api/account', undefined, c.token)).status, 200);
  assert.equal((await s.call('DELETE', '/api/account', { password: 'nope nope nope' }, c.token)).status, 401);
  assert.equal((await s.call('DELETE', '/api/account', { password: 'another long passphrase' }, c.token)).status, 200);
  assert.equal((await s.call('GET', '/api/account', undefined, c.token)).status, 401);
  s.close();
});
test('login attempts are rate limited', async () => {
  const s = await setup(); await signUp(s); let last = 0;
  for (let i = 0; i < 12; i++) last = (await s.call('POST', '/api/account/login', { email: 'a@example.com', password: 'wrong wrong wrong' })).status;
  assert.equal(last, 429); s.close();
});
async function pushDevice(s) {
  const dev = await (await s.call('POST', '/api/register')).json();
  const h = { Authorization: 'Bearer ' + dev.token, 'X-Device-Id': dev.deviceId };
  await fetch(s.base + '/api/subscription', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h), body: JSON.stringify({ subscription: SUB, api: 'https://lb.example' }) });
  const put = (items, extra) => fetch(s.base + '/api/schedule', { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, h), body: JSON.stringify(Object.assign({ items }, extra)) }).then(r => r.json());
  return { dev, h, put };
}
test('closed-app snooze: signed token from the push payload re-schedules, survives updates, and is dropped on cancellation', async () => {
  const s = await setup(); const { dev, put } = await pushDevice(s); const t0 = 1_000_000_000_000;
  await put([{ key: 'ev|e1|d|30|1', at: t0 + 1000, title: 'LifeBalance', body: 'You have a reminder.', ev: 'e1' }], { activeEvents: ['e1'] });
  s.advance(2000); await s.app.tick(); assert.equal(s.sent.length, 1);
  const p = s.sent[0]; assert.ok(p.token && p.deviceId === dev.deviceId && p.api === 'https://lb.example');
  assert.equal((await s.call('POST', '/api/snooze', { deviceId: p.deviceId, key: p.key, token: 'forged', minutes: 10 })).status, 401);
  const r = await s.call('POST', '/api/snooze', { deviceId: p.deviceId, key: p.key, token: p.token, minutes: 10, title: p.title, body: p.body, ev: p.ev }); assert.equal(r.status, 200);
  const rs = await put([], { activeEvents: ['e1'] }); assert.equal(rs.snoozed, 1);
  s.advance(5 * 60000); await s.app.tick(); assert.equal(s.sent.length, 1);
  s.advance(6 * 60000); await s.app.tick(); assert.equal(s.sent.length, 2); assert.ok(s.sent[1].key.startsWith(p.key + '|s'));
  s.advance(1000); await s.app.tick(); assert.equal(s.sent.length, 2, 'sent only once');
  await s.call('POST', '/api/snooze', { deviceId: p.deviceId, key: s.sent[1].key, token: s.sent[1].token, minutes: 10, ev: 'e1' });
  const rc = await put([], { activeEvents: [] }); assert.equal(rc.snoozed, 0);
  s.advance(11 * 60000); await s.app.tick(); assert.equal(s.sent.length, 2, 'cancelled event is not alerted');
  s.close();
});
test('turning off "this device receives reminders" clears server snoozes', async () => {
  const s = await setup(); const { dev, put } = await pushDevice(s);
  await put([{ key: 'k', at: 1_000_000_000_000 + 10, title: 't', body: 'b', ev: 'e' }]);
  s.advance(1000); await s.app.tick(); const p = s.sent[0];
  await s.call('POST', '/api/snooze', { deviceId: dev.deviceId, key: p.key, token: p.token, minutes: 5, ev: 'e' });
  assert.equal((await put([], { receive: false })).scheduled, 0);
  s.advance(6 * 60000); await s.app.tick(); assert.equal(s.sent.length, 1);
  s.close();
});
test('delivery failures are counted and reported', async () => {
  const s = await setup(); const { h, put } = await pushDevice(s);
  await put([{ key: 'z', at: 1_000_000_000_000 + 10, title: 't', body: 'b' }]);
  s.fail.on = true; s.advance(1000); await s.app.tick();
  let st = await (await fetch(s.base + '/api/status', { headers: h })).json(); assert.equal(st.failures, 1); assert.match(st.lastError, /boom/); assert.equal(st.lastSentAt, 0);
  s.fail.on = false; await s.app.tick();
  st = await (await fetch(s.base + '/api/status', { headers: h })).json(); assert.ok(st.lastSentAt > 0);
  s.close();
});
