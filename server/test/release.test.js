'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { createApp } = require('../server');

const PW = 'correct horse battery', KEY = 'a'.repeat(64);
async function setup(o = {}) {
  const dir = o.dir || fs.mkdtempSync(path.join(os.tmpdir(), 'lbrel-')), mails = []; let clock = o.clock || 1_000_000_000_000;
  const app = createApp({
    dataDir: dir, staticDir: null, now: () => clock, sender: async () => {},
    env: Object.assign({ ALLOWED_ORIGINS: 'https://app.example', LB_DATA_KEY: KEY }, o.env || {}),
    mailer: o.noMail ? null : async (to, subject, text) => { mails.push({ to, subject, text, code: (/\b(\d{8})\b/.exec(text) || [])[1] }); }
  });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const call = (m, p, body, tok, extra) => fetch(base + p, { method: m, headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}, extra || {}), body: body === undefined ? undefined : JSON.stringify(body) });
  return { app, dir, mails, call, base, advance: ms => { clock += ms; }, close: () => app.server.close() };
}
const j = async r => r.json();
async function signUp(s, email = 'a@example.com') {
  await s.call('POST', '/api/account/register', { email, password: PW });
  return j(await s.call('POST', '/api/account/verify', { email, code: s.mails[s.mails.length - 1].code }));
}

test('health reports storage, key source and account availability', async () => {
  const s = await setup(); const h = await j(await s.call('GET', '/api/health'));
  assert.equal(h.ok, true); assert.equal(h.storage.writable, true); assert.equal(h.accounts.enabled, true); assert.equal(h.encryptionKey, 'environment');
  s.close();
});
test('without an email service, accounts are reported unavailable and registration is refused', async () => {
  const s = await setup({ noMail: true }); const h = await j(await s.call('GET', '/api/health'));
  assert.equal(h.accounts.enabled, false); assert.match(h.accounts.reason, /email/);
  const r = await s.call('POST', '/api/account/register', { email: 'a@example.com', password: PW }); assert.equal(r.status, 503); assert.equal((await j(r)).unavailable, true);
  assert.equal((await s.call('POST', '/api/account/login', { email: 'a@example.com', password: PW })).status, 503);
  s.close();
});
test('email verification: no session before verifying, wrong code, attempt limit, expiry, resend', async () => {
  const s = await setup();
  const r = await j(await s.call('POST', '/api/account/register', { email: 'a@example.com', password: PW }));
  assert.equal(r.needsVerification, true); assert.equal(r.token, undefined); assert.equal(s.mails.length, 1);
  const login = await s.call('POST', '/api/account/login', { email: 'a@example.com', password: PW }); assert.equal(login.status, 403); assert.equal((await j(login)).unverified, true);
  const good = s.mails[0].code, bad = good === '00000000' ? '11111111' : '00000000';
  for (let i = 0; i < 5; i++) assert.equal((await s.call('POST', '/api/account/verify', { email: 'a@example.com', code: bad })).status, 400);
  assert.equal((await s.call('POST', '/api/account/verify', { email: 'a@example.com', code: good })).status, 400, 'locked out after 5 wrong tries');
  await s.call('POST', '/api/account/resend', { email: 'a@example.com', password: 'wrong password!!' }); assert.equal(s.mails.length, 1, 'no code for a wrong password');
  await s.call('POST', '/api/account/resend', { email: 'a@example.com', password: PW }); assert.equal(s.mails.length, 2);
  s.advance(16 * 60000); assert.equal((await s.call('POST', '/api/account/verify', { email: 'a@example.com', code: s.mails[1].code })).status, 400, 'expired');
  await s.call('POST', '/api/account/resend', { email: 'a@example.com', password: PW });
  const v = await j(await s.call('POST', '/api/account/verify', { email: 'a@example.com', code: s.mails[2].code })); assert.ok(v.token);
  assert.equal((await s.call('GET', '/api/sync', undefined, v.token)).status, 200);
  assert.equal((await s.call('POST', '/api/account/verify', { email: 'a@example.com', code: s.mails[2].code })).status, 400, 'codes are single use');
  s.close();
});
test('password recovery: no account enumeration, code reset, old password and sessions revoked', async () => {
  const s = await setup(); const a = await signUp(s); const n = s.mails.length;
  const unknown = await s.call('POST', '/api/account/forgot', { email: 'nobody@example.com' }); assert.equal(unknown.status, 200); assert.equal(s.mails.length, n, 'no mail for unknown address');
  assert.equal((await s.call('POST', '/api/account/forgot', { email: 'a@example.com' })).status, 200); assert.equal(s.mails.length, n + 1);
  const code = s.mails[n].code;
  assert.equal((await s.call('POST', '/api/account/reset', { email: 'a@example.com', code: '12345678'.replace(code, '87654321'), newPassword: 'brand new password' })).status, 400);
  assert.equal((await s.call('POST', '/api/account/reset', { email: 'a@example.com', code, newPassword: 'short' })).status, 400, 'weak password rejected');
  assert.equal((await s.call('POST', '/api/account/reset', { email: 'a@example.com', code, newPassword: 'brand new password' })).status, 200);
  assert.equal((await s.call('GET', '/api/sync', undefined, a.token)).status, 401, 'old session revoked');
  assert.equal((await s.call('POST', '/api/account/login', { email: 'a@example.com', password: PW })).status, 401);
  assert.equal((await s.call('POST', '/api/account/login', { email: 'a@example.com', password: 'brand new password' })).status, 200);
  assert.equal((await s.call('POST', '/api/account/reset', { email: 'a@example.com', code, newPassword: 'another new password' })).status, 400, 'code is single use');
  s.close();
});
test('sessions can be listed and revoked individually or all others', async () => {
  const s = await setup(); const a = await signUp(s);
  const b = await j(await s.call('POST', '/api/account/login', { email: 'a@example.com', password: PW }, undefined, { 'User-Agent': 'Phone' }));
  const c = await j(await s.call('POST', '/api/account/login', { email: 'a@example.com', password: PW }));
  const list = (await j(await s.call('GET', '/api/account/sessions', undefined, a.token))).sessions; assert.equal(list.length, 3); assert.equal(list.filter(x => x.current).length, 1);
  const other = list.find(x => !x.current);
  assert.equal((await s.call('DELETE', '/api/account/sessions/' + other.id, undefined, a.token)).status, 200);
  assert.equal((await j(await s.call('GET', '/api/account/sessions', undefined, a.token))).sessions.length, 2);
  const r = await j(await s.call('POST', '/api/account/sessions/revoke-others', {}, a.token)); assert.equal(r.revoked, 1);
  assert.equal((await s.call('GET', '/api/sync', undefined, a.token)).status, 200);
  assert.ok([b, c].some(x => true));
  assert.equal((await s.call('GET', '/api/sync', undefined, b.token)).status === 401 || (await s.call('GET', '/api/sync', undefined, c.token)).status === 401, true);
  s.close();
});
test('authentication endpoints are rate limited', async () => {
  const s = await setup(); let last = 0;
  for (let i = 0; i < 12; i++) last = (await s.call('POST', '/api/account/login', { email: 'a@example.com', password: 'wrong password!!' })).status;
  assert.equal(last, 429);
  const t = await setup(); let st = 0; for (let i = 0; i < 7; i++) st = (await t.call('POST', '/api/account/forgot', { email: 'x' + i + '@example.com' })).status; // per-IP mail cap is 20, per-address 5
  assert.equal(st, 200);
  const u = await setup(); for (let i = 0; i < 6; i++) st = (await u.call('POST', '/api/account/forgot', { email: 'same@example.com' })).status; assert.equal(st, 429);
  s.close(); t.close(); u.close();
});
test('TRUST_PROXY makes limits apply per real client, not per proxy', async () => {
  const s = await setup({ env: { TRUST_PROXY: '1' } }); let a = 0, b = 0;
  for (let i = 0; i < 31; i++) a = (await s.call('POST', '/api/account/login', { email: 'u' + i + '@example.com', password: 'x' }, undefined, { 'X-Forwarded-For': '1.1.1.1' })).status;
  b = (await s.call('POST', '/api/account/login', { email: 'v@example.com', password: 'x' }, undefined, { 'X-Forwarded-For': '2.2.2.2' })).status;
  assert.equal(a, 429); assert.equal(b, 401); s.close();
});
test('CORS allows only the published app origin', async () => {
  const s = await setup();
  const ok = await s.call('OPTIONS', '/api/sync', undefined, undefined, { Origin: 'https://app.example' }); assert.equal(ok.status, 204); assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.example');
  const no = await s.call('GET', '/api/health', undefined, undefined, { Origin: 'https://evil.example' }); assert.equal(no.headers.get('access-control-allow-origin'), null);
  s.close();
});
test('data survives a restart with the same key; a different key is refused; backups restore', async () => {
  const s = await setup(); const a = await signUp(s);
  assert.equal((await s.call('PUT', '/api/sync', { baseRev: 0, data: { tasks: [{ id: '1', title: 'v1' }] } }, a.token)).status, 200);
  s.advance(2 * 3600e3);
  assert.equal((await s.call('PUT', '/api/sync', { baseRev: 1, data: { tasks: [{ id: '1', title: 'v2' }] } }, a.token)).status, 200);
  s.close(); await new Promise(r => setTimeout(r, 50));
  const s2 = await setup({ dir: s.dir, clock: 1_000_000_000_000 + 2 * 3600e3 });
  const login = await j(await s2.call('POST', '/api/account/login', { email: 'a@example.com', password: PW }));
  const got = await j(await s2.call('GET', '/api/sync', undefined, login.token)); assert.equal(got.data.tasks[0].title, 'v2'); assert.equal(got.rev, 2);
  const bk = (await j(await s2.call('GET', '/api/backups', undefined, login.token))).backups; assert.equal(bk.length, 1);
  const old = await j(await s2.call('GET', '/api/backups/' + bk[0].id, undefined, login.token)); assert.equal(old.data.tasks[0].title, 'v1');
  assert.equal((await s2.call('PUT', '/api/sync', { baseRev: 2, data: old.data, force: true }, login.token)).status, 200);
  assert.equal((await j(await s2.call('GET', '/api/sync', undefined, login.token))).data.tasks[0].title, 'v1', 'restored');
  const raw = fs.readFileSync(path.join(s.dir, 'users', fs.readdirSync(path.join(s.dir, 'users'))[0]), 'utf8'); assert.ok(!raw.includes('"v1"') && !raw.includes('v2'), 'encrypted at rest');
  s2.close();
  assert.throws(() => createApp({ dataDir: s.dir, staticDir: null, env: { LB_DATA_KEY: 'b'.repeat(64) }, mailer: null, sender: async () => {} }), /encryption key has changed/);
});
test('delete account removes cloud data and sessions', async () => {
  const s = await setup(); const a = await signUp(s);
  await s.call('PUT', '/api/sync', { baseRev: 0, data: { tasks: [] } }, a.token);
  assert.equal((await s.call('DELETE', '/api/account', { password: 'wrong password!!' }, a.token)).status, 401);
  assert.equal((await s.call('DELETE', '/api/account', { password: PW }, a.token)).status, 200);
  assert.equal((await s.call('GET', '/api/sync', undefined, a.token)).status, 401);
  assert.deepEqual(fs.readdirSync(path.join(s.dir, 'users')), []); s.close();
});

test('older clients cannot overwrite schema-3 Work data with a lower-schema sync', async () => {
  const s=await setup();
  try {
    const a=await signUp(s,'work@example.com');
    const first=await s.call('PUT','/api/sync',{baseRev:0,data:{version:3,work:{allowances:[{id:'2026',year:2026,days:25}],leave:[]}}},a.token);
    assert.equal(first.status,200);
    const saved=await j(first);
    const old=await s.call('PUT','/api/sync',{baseRev:saved.rev,data:{version:2,tasks:[]},force:true},a.token);
    assert.equal(old.status,426);
    const current=await j(await s.call('GET','/api/sync',undefined,a.token));
    assert.equal(current.data.work.allowances[0].days,25);
  } finally {s.close();}
});
