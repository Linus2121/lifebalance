'use strict';
/* LifeBalance accounts and sync storage.
   - Passwords: scrypt with a per-user salt (never stored in plain text).
   - Sessions: random tokens, only their SHA-256 hash is stored. Sessions can be listed and revoked.
   - Email verification and password recovery: short-lived 8-digit codes, stored only as hashes, limited attempts.
   - Data: one file per user, encrypted with AES-256-GCM using a key derived per user from a server master key.
   - Backups: automatic encrypted snapshots of previous versions (at most one per hour, newest 30 kept).
   - Key retention: a fingerprint of the master key is stored; the server refuses to start if the key changed. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const SESSION_MS = 90 * 864e5, BACKUP_EVERY_MS = 3600e3, MAX_BACKUPS = 30, MAX_USERS = 5000, MAX_SESSIONS = 20, CODE_MS = 15 * 60000, CODE_TRIES = 5, UNVERIFIED_MS = 7 * 864e5;
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const pwOk = p => typeof p === 'string' && p.length >= 10 && p.length <= 200;

function loadMasterKey(dir, env) {
  if (env.LB_DATA_KEY) { const k = Buffer.from(env.LB_DATA_KEY, /^[0-9a-f]{64}$/i.test(env.LB_DATA_KEY) ? 'hex' : 'base64'); if (k.length === 32) return k; throw new Error('LB_DATA_KEY must be 32 bytes (64 hex characters or base64)'); }
  const f = path.join(dir, 'datakey');
  try { const k = Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'hex'); if (k.length === 32) return k; } catch (e) { /* generate */ }
  fs.mkdirSync(dir, { recursive: true }); const k = crypto.randomBytes(32); fs.writeFileSync(f, k.toString('hex'), { mode: 0o600 }); return k;
}

function create(opts) {
  const dir = opts.dir, now = opts.now || Date.now, master = opts.masterKey, udir = path.join(dir, 'users');
  const accFile = path.join(dir, 'accounts.json');
  let acc = { users: {}, sessions: {} };
  try { acc = JSON.parse(fs.readFileSync(accFile, 'utf8')); acc.users = acc.users || {}; acc.sessions = acc.sessions || {}; } catch (e) { /* new */ }
  const saveAcc = () => { fs.mkdirSync(dir, { recursive: true }); const t = accFile + '.tmp'; fs.writeFileSync(t, JSON.stringify(acc), { mode: 0o600 }); fs.renameSync(t, accFile); };
  const keyCheck = crypto.createHmac('sha256', master).update('lifebalance-key-check').digest('hex');
  if (acc.keyCheck && acc.keyCheck !== keyCheck) throw new Error('The data encryption key has changed. Existing account data cannot be decrypted. Restore the original LB_DATA_KEY (or datakey file) before starting.');
  if (!acc.keyCheck) { acc.keyCheck = keyCheck; saveAcc(); }
  const userKey = id => Buffer.from(crypto.hkdfSync('sha256', master, Buffer.alloc(0), 'lifebalance-user|' + id, 32));
  const enc = (id, obj) => {
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', userKey(id), iv), ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
    return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64') };
  };
  const dec = (id, e) => {
    const d = crypto.createDecipheriv('aes-256-gcm', userKey(id), Buffer.from(e.iv, 'base64')); d.setAuthTag(Buffer.from(e.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(e.ct, 'base64')), d.final()]).toString('utf8'));
  };
  const file = id => path.join(udir, id + '.json');
  const readUser = id => { try { return JSON.parse(fs.readFileSync(file(id), 'utf8')); } catch (e) { return { rev: 0, updatedAt: 0, enc: null, backups: [] }; } };
  const writeUser = (id, u) => { fs.mkdirSync(udir, { recursive: true }); const t = file(id) + '.tmp'; fs.writeFileSync(t, JSON.stringify(u), { mode: 0o600 }); fs.renameSync(t, file(id)); };

  const cleanEmail = e => String(e || '').trim().toLowerCase();
  const findByEmail = email => Object.keys(acc.users).find(id => acc.users[id].email === email);
  const hashPw = async (pw, salt) => (await scrypt(pw, salt, 32)).toString('hex');
  const isVerified = u => u.verified !== false;
  const revokeAll = (userId, except) => Object.keys(acc.sessions).forEach(h => { if (acc.sessions[h].userId === userId && h !== except) delete acc.sessions[h]; });
  function newSession(userId, label) {
    const token = crypto.randomBytes(32).toString('base64url'), t = now();
    acc.sessions[sha(token)] = { userId, createdAt: t, lastUsed: t, label: String(label || '').slice(0, 60) };
    const mine = Object.keys(acc.sessions).filter(h => acc.sessions[h].userId === userId).sort((a, b) => acc.sessions[a].createdAt - acc.sessions[b].createdAt);
    while (mine.length > MAX_SESSIONS) delete acc.sessions[mine.shift()];
    return token;
  }
  // Issues a one-time code for 'verify' or 'reset'. Only a hash is stored; any previous code of that kind is replaced.
  function issueCode(userId, kind) {
    const code = String(crypto.randomInt(0, 1e8)).padStart(8, '0');
    acc.users[userId][kind] = { hash: sha(code + '|' + userId), exp: now() + CODE_MS, tries: 0 }; saveAcc(); return code;
  }
  function checkCode(userId, kind, code) {
    const u = acc.users[userId], c = u && u[kind];
    if (!c || now() > c.exp || c.tries >= CODE_TRIES) return false;
    c.tries++;
    if (!safeEq(sha(String(code || '').trim() + '|' + userId), c.hash)) { saveAcc(); return false; }
    delete u[kind]; saveAcc(); return true;
  }
  const BAD_CODE = { error: 'That code is wrong or has expired. Request a new one.', code: 400 };

  return {
    async register(email, password, label, opts2) {
      email = cleanEmail(email); const needVerify = !!(opts2 && opts2.requireVerification);
      if (!EMAIL.test(email)) return { error: 'Enter a valid email address.', code: 400 };
      if (!pwOk(password)) return { error: 'Use a password of at least 10 characters.', code: 400 };
      const old = findByEmail(email);
      if (old && (isVerified(acc.users[old]) || now() - acc.users[old].createdAt < UNVERIFIED_MS)) {
        if (!isVerified(acc.users[old])) return { error: 'This email is waiting for verification. Check your inbox, or use “Resend code”.', code: 409 };
        return { error: 'An account with this email already exists. Try signing in.', code: 409 };
      }
      if (old) delete acc.users[old]; // stale unverified registration
      if (Object.keys(acc.users).length >= MAX_USERS) return { error: 'This server is not accepting new accounts.', code: 503 };
      const id = crypto.randomUUID(), salt = crypto.randomBytes(16).toString('hex');
      acc.users[id] = { email, salt, hash: await hashPw(password, salt), createdAt: now(), verified: !needVerify };
      if (needVerify) { const verifyCode = issueCode(id, 'verify'); return { userId: id, email, verifyCode }; }
      const token = newSession(id, label); saveAcc(); return { userId: id, token, email };
    },
    async login(email, password, label) {
      email = cleanEmail(email); const id = findByEmail(email);
      const u = id ? acc.users[id] : { salt: '00'.repeat(16), hash: '' }; // constant work for unknown emails
      const h = await hashPw(typeof password === 'string' ? password.slice(0, 200) : '', u.salt);
      if (!id || !safeEq(h, u.hash)) return { error: 'Email or password is incorrect.', code: 401 };
      if (!isVerified(u)) return { error: 'Verify your email address first. Check your inbox for the code.', code: 403, unverified: true };
      const token = newSession(id, label); saveAcc(); return { userId: id, token, email };
    },
    // A fresh verification code, only for an unverified account whose password is correct (so it cannot be used to spam others).
    async resendVerification(email, password) {
      email = cleanEmail(email); const id = findByEmail(email);
      if (!id || isVerified(acc.users[id]) || !safeEq(await hashPw(String(password || '').slice(0, 200), acc.users[id].salt), acc.users[id].hash)) return { ok: true };
      return { ok: true, verifyCode: issueCode(id, 'verify'), email };
    },
    verifyEmail(email, code, label) {
      const id = findByEmail(cleanEmail(email)); if (!id || isVerified(acc.users[id])) return BAD_CODE;
      if (!checkCode(id, 'verify', code)) return BAD_CODE;
      acc.users[id].verified = true; const token = newSession(id, label); saveAcc(); return { token, email: acc.users[id].email };
    },
    // Always looks successful to the caller; a code exists only for real, verified accounts.
    forgotPassword(email) {
      email = cleanEmail(email); const id = findByEmail(email);
      if (!id || !isVerified(acc.users[id])) return { ok: true };
      return { ok: true, resetCode: issueCode(id, 'reset'), email };
    },
    async resetPassword(email, code, newPw) {
      const id = findByEmail(cleanEmail(email)); if (!id) return BAD_CODE;
      if (!pwOk(newPw)) return { error: 'Use a new password of at least 10 characters.', code: 400 };
      if (!checkCode(id, 'reset', code)) return BAD_CODE;
      const u = acc.users[id]; u.salt = crypto.randomBytes(16).toString('hex'); u.hash = await hashPw(newPw, u.salt); u.verified = true;
      revokeAll(id); saveAcc(); return { ok: true };
    },
    auth(token) {
      if (typeof token !== 'string' || !token) return null;
      const s = acc.sessions[sha(token)]; if (!s) return null;
      if (now() - s.createdAt > SESSION_MS) { delete acc.sessions[sha(token)]; saveAcc(); return null; }
      return acc.users[s.userId] && isVerified(acc.users[s.userId]) ? { id: s.userId, email: acc.users[s.userId].email } : null;
    },
    logout(token) { if (acc.sessions[sha(token)]) { delete acc.sessions[sha(token)]; saveAcc(); } },
    listSessions(userId, token) {
      const cur = sha(token || '');
      return Object.keys(acc.sessions).filter(h => acc.sessions[h].userId === userId).map(h => ({ id: h.slice(0, 16), label: acc.sessions[h].label, createdAt: acc.sessions[h].createdAt, current: h === cur })).sort((a, b) => b.createdAt - a.createdAt);
    },
    revokeSession(userId, id) {
      const h = Object.keys(acc.sessions).find(k => acc.sessions[k].userId === userId && k.slice(0, 16) === id); if (!h) return false;
      delete acc.sessions[h]; saveAcc(); return true;
    },
    revokeOthers(userId, token) { const n = Object.keys(acc.sessions).filter(h => acc.sessions[h].userId === userId && h !== sha(token)).length; revokeAll(userId, sha(token)); saveAcc(); return n; },
    async changePassword(userId, oldPw, newPw) {
      const u = acc.users[userId]; if (!u) return { error: 'Unknown account', code: 404 };
      if (!safeEq(await hashPw(String(oldPw || ''), u.salt), u.hash)) return { error: 'Current password is incorrect.', code: 401 };
      if (!pwOk(newPw)) return { error: 'Use a new password of at least 10 characters.', code: 400 };
      u.salt = crypto.randomBytes(16).toString('hex'); u.hash = await hashPw(newPw, u.salt);
      revokeAll(userId); // sign out everywhere
      const token = newSession(userId, 'after password change'); saveAcc(); return { token };
    },
    async deleteAccount(userId, password) {
      const u = acc.users[userId]; if (!u) return { error: 'Unknown account', code: 404 };
      if (!safeEq(await hashPw(String(password || ''), u.salt), u.hash)) return { error: 'Password is incorrect.', code: 401 };
      delete acc.users[userId]; revokeAll(userId); saveAcc();
      try { fs.unlinkSync(file(userId)); } catch (e) { /* none */ } return { ok: true };
    },
    getData(userId) {
      const u = readUser(userId); if (!u.enc) return { rev: u.rev, updatedAt: u.updatedAt, data: null };
      return { rev: u.rev, updatedAt: u.updatedAt, data: dec(userId, u.enc) };
    },
    // Optimistic concurrency: the client must say which revision it based its changes on.
    putData(userId, baseRev, data, force) {
      const u = readUser(userId), t = now();
      if (!force && baseRev !== u.rev) return { conflict: true, rev: u.rev, updatedAt: u.updatedAt, data: u.enc ? dec(userId, u.enc) : null };
      if (u.enc) {
        const last = u.backups.length ? u.backups[u.backups.length - 1].at : 0;
        if (t - last >= BACKUP_EVERY_MS || force) { u.backups.push({ id: crypto.randomUUID(), at: u.updatedAt || t, rev: u.rev, enc: u.enc }); while (u.backups.length > MAX_BACKUPS) u.backups.shift(); }
      }
      u.rev += 1; u.updatedAt = t; u.enc = enc(userId, data); writeUser(userId, u);
      return { ok: true, rev: u.rev, updatedAt: u.updatedAt };
    },
    listBackups(userId) { return readUser(userId).backups.map(b => ({ id: b.id, at: b.at, rev: b.rev })).reverse(); },
    getBackup(userId, id) { const b = readUser(userId).backups.find(x => x.id === id); return b ? { id: b.id, at: b.at, rev: b.rev, data: dec(userId, b.enc) } : null; },
    prune() {
      let ch = false; const t = now();
      Object.keys(acc.sessions).forEach(h => { if (t - acc.sessions[h].createdAt > SESSION_MS) { delete acc.sessions[h]; ch = true; } });
      Object.keys(acc.users).forEach(id => { if (acc.users[id].verified === false && t - acc.users[id].createdAt > UNVERIFIED_MS) { delete acc.users[id]; ch = true; } });
      if (ch) saveAcc();
    },
    stats() { return { users: Object.keys(acc.users).length }; }
  };
}

module.exports = { create, loadMasterKey };
