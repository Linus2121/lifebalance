/* Accounts, cloud sync, backups and conflict handling (client). Local data always works offline; syncing is optional. */
(function () {
  const LB = window.LB, C = LB.C, A = LB.actions, SB = LB.submits, esc = LB.esc, D = LB.D, K = LB.KEYS, M = window.LBMerge;
  const BASE_KEY = 'lifebalance.syncbase';
  D.account = D.account || null; D.sync = Object.assign({ rev: 0, lastAt: 0, status: 'off', error: '' }, D.sync || {}); D.syncConflicts = D.syncConflicts || [];
  const S = LB.sync = {};
  let busy = false, timer = null, again = false;
  const base = () => (((window.LB_CONFIG && window.LB_CONFIG.serverUrl) || D.serverUrl || '')).replace(/\/+$/, '');
  const json = v => JSON.parse(JSON.stringify(v));
  const getBase = () => { try { return JSON.parse(localStorage.getItem(BASE_KEY)) || {}; } catch (e) { return {}; } };
  const setBase = v => { try { localStorage.setItem(BASE_KEY, JSON.stringify(v)); } catch (e) { /* base is best effort */ } };
  const status = (st, err) => { D.sync.status = st; D.sync.error = err || ''; if (st === 'ok') D.sync.lastAt = Date.now(); LB.saveD(); footer(); if (LB.ui.view === 'settings' && !document.activeElement.matches('input')) LB.render(); };
  const footer = () => { const el = document.querySelector('footer .small'); if (el) el.textContent = 'Last updated ' + C.APP_UPDATED + (D.account ? ' \u00b7 Signed in: your data is also stored, encrypted, on the sync server' : ' \u00b7 Your data stays on this device'); };

  async function call(path, method, body) {
    const h = { 'Content-Type': 'application/json' }; if (D.account) h.Authorization = 'Bearer ' + D.account.token;
    const r = await fetch(base() + path, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j };
  }
  S.available = async () => { try { const r = await fetch(base() + '/api/config', { cache: 'no-store' }); const j = r.ok ? await r.json() : null; return !!(j && j.accounts); } catch (e) { return false; } };

  function applyLocal(state) {
    LB.personal = state; if (!LB.D.demo) LB.S = state;
    try { localStorage.setItem(K.KEY, JSON.stringify(state)); } catch (e) { LB.toast('Could not save synced data: browser storage is full.'); }
    LB.rem && LB.rem.syncSoon(); LB.render();
  }
  const norm = d => C.normalize(d, LB.today()).state;

  S.run = async () => {
    if (!D.account || LB.D.demo) return;
    if (busy) { again = true; return; }
    if (!navigator.onLine) { status('offline', 'You are offline. Your changes are saved on this device and will sync when you reconnect.'); return; }
    busy = true; status('syncing');
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const g = await call('/api/sync'); if (g.status === 401) throw Object.assign(new Error('signed-out'), { signedOut: true }); if (!g.ok) throw new Error(g.j.error || 'server replied ' + g.status);
        const local = json(LB.personal), localStr = JSON.stringify(local), baseS = getBase();
        let merged, rev = g.j.rev;
        if (!g.j.data) merged = local;
        else if (g.j.rev === D.sync.rev) { if (localStr === JSON.stringify(baseS)) { status('ok'); return; } merged = local; }
        else {
          const r = M.merge3(baseS, local, norm(g.j.data), { ignore: ['draft'] });
          merged = norm(r.merged);
          if (r.conflicts.length) { D.syncConflicts = D.syncConflicts.concat(r.conflicts.map(c => Object.assign({ at: Date.now() }, c))).slice(-50); LB.saveD(); }
          else if (JSON.stringify(merged) === JSON.stringify(norm(g.j.data)) && localStr === JSON.stringify(norm(local))) { /* identical */ }
        }
        const p = await call('/api/sync', 'PUT', { baseRev: rev, data: merged });
        if (p.status === 409) continue;
        if (p.status === 401) throw Object.assign(new Error('signed-out'), { signedOut: true });
        if (!p.ok) throw new Error(p.j.error || 'server replied ' + p.status);
        // Edits made while syncing are merged onto the result rather than overwritten.
        const now = json(LB.personal), final = JSON.stringify(now) === localStr ? merged : norm(M.merge3(local, now, merged, { ignore: ['draft'] }).merged);
        if (JSON.stringify(final) !== JSON.stringify(now)) applyLocal(final);
        D.sync.rev = p.j.rev; setBase(merged); status('ok');
        if (JSON.stringify(final) !== JSON.stringify(merged)) again = true;
        return;
      }
      throw new Error('The cloud copy kept changing. Try again.');
    } catch (e) {
      if (e.signedOut) { D.account = null; D.sync = { rev: 0, lastAt: 0, status: 'off', error: '' }; LB.saveD(); status('off', ''); LB.toast('You were signed out. Sign in again to keep syncing. Your data on this device is unchanged.'); }
      else status('failed', (e.message === 'Failed to fetch' ? 'Could not reach the sync server. Your changes are saved on this device and will sync later.' : 'Sync failed: ' + e.message));
    } finally { busy = false; if (again) { again = false; S.soon(); } }
  };
  S.soon = () => { if (!D.account || LB.D.demo) return; clearTimeout(timer); timer = setTimeout(S.run, 2500); };

  const saveOrig = LB.save; LB.save = function () { const r = saveOrig.apply(this, arguments); S.soon(); return r; };
  const repOrig = LB.replacePersonal; LB.replacePersonal = function () { const r = repOrig.apply(this, arguments); if (r) S.soon(); return r; };
  const resOrig = LB.restoreBackup; LB.restoreBackup = function () { const r = resOrig.apply(this, arguments); if (r) S.soon(); return r; };
  window.addEventListener('online', S.run); document.addEventListener('visibilitychange', () => { if (!document.hidden) S.run(); });
  setInterval(() => { if (!document.hidden) S.run(); }, 120000);

  // First connection of this browser: never overwrite either side without asking.
  async function connect(email, token) {
    D.account = { email, token }; D.sync = { rev: 0, lastAt: 0, status: 'syncing', error: '' }; LB.saveD();
    const g = await call('/api/sync'); if (!g.ok) { D.account = null; LB.saveD(); return 'Signed in, but the cloud copy could not be read: ' + (g.j.error || g.status); }
    const hasLocal = !isEmpty(LB.personal), cloud = g.j.data;
    D.sync.rev = g.j.rev;
    if (!cloud) {
      if (hasLocal) {
        const ok = await LB.ask({ title: 'Upload this browser\u2019s data?', body: '<p>Your cloud account is empty. Upload the data on this device so it is available on your other devices? It is stored encrypted on the sync server. This browser\u2019s copy is not changed.</p>', buttons: [{ label: 'Upload my data', value: true }, { label: 'Not now (sign out)', value: false, cls: 'alt' }] });
        if (!ok) { await call('/api/account/logout', 'POST'); D.account = null; D.sync = { rev: 0, lastAt: 0, status: 'off', error: '' }; LB.saveD(); return ''; }
      }
      setBase({}); S.run(); return '';
    }
    if (!hasLocal) { LB.stashBackup(K.BK_IMPORT); setBase(cloud); applyLocal(norm(cloud)); status('ok'); return ''; }
    const v = await LB.ask({ title: 'Combine your data?', body: '<p>This browser and your cloud account both contain data. Nothing is replaced until you choose.</p>', buttons: [{ label: 'Combine both (recommended)', value: 'merge' }, { label: 'Use the cloud copy (a backup of this browser is kept)', value: 'cloud', cls: 'alt' }, { label: 'Cancel and sign out', value: null, cls: 'alt' }] });
    if (!v) { await call('/api/account/logout', 'POST'); D.account = null; D.sync = { rev: 0, lastAt: 0, status: 'off', error: '' }; LB.saveD(); return ''; }
    LB.stashBackup(K.BK_IMPORT);
    if (v === 'cloud') { setBase(cloud); applyLocal(norm(cloud)); status('ok'); } else { setBase({}); await S.run(); }
    return '';
  }
  const isEmpty = s => !(s.tasks.length || s.habits.some(h => !h.builtin) || Object.keys(s.logs || {}).length || (s.journal || []).length || s.events.length || s.fitness.workouts.length || s.fitness.weights.length || Object.keys(s.food.diary || {}).length || Object.keys(s.food.plan || {}).length || s.food.custom.length);

  async function auth(kind, f) {
    const email = f.email.value.trim(), pw = f.password.value; if (!email || !pw) { LB.toast('Enter your email and password.'); return false; }
    LB.toast(kind === 'register' ? 'Creating account\u2026' : 'Signing in\u2026');
    let r; try { r = await call('/api/account/' + kind, 'POST', { email, password: pw }); } catch (e) { LB.toast('Could not reach the sync server.'); return false; }
    if (!r.ok) { LB.toast(r.j.error || 'Sign-in failed (' + r.status + ').'); return false; }
    f.password.value = '';
    const err = await connect(r.j.email, r.j.token); if (err) LB.toast(err); else LB.toast('Signed in.');
    LB.render(); return false;
  }
  SB.acctLogin = f => auth('login', f);
  A.acctRegister = async el => { const f = el.closest('form'); return auth('register', f); };
  A.syncNow = async () => { LB.toast('Syncing\u2026'); await S.run(); LB.toast(D.sync.status === 'ok' ? 'Synced.' : D.sync.error || 'Not synced.'); return false; };
  A.signOut = async () => { try { await call('/api/account/logout', 'POST'); } catch (e) { /* signed out locally anyway */ } D.account = null; D.sync = { rev: 0, lastAt: 0, status: 'off', error: '' }; D.syncConflicts = []; setBase({}); LB.saveD(); footer(); LB.toast('Signed out. Your data stays on this device.'); };
  SB.changePw = async f => {
    const r = await call('/api/account/password', 'POST', { oldPassword: f.oldp.value, newPassword: f.newp.value });
    if (!r.ok) { LB.toast(r.j.error || 'Could not change password.'); return false; }
    D.account.token = r.j.token; LB.saveD(); f.reset(); LB.toast('Password changed. Other devices were signed out.'); return false;
  };
  SB.delAcct = async f => {
    if (!(await LB.confirm('Delete your account?', '<p>This permanently deletes your cloud copy and all cloud backups. Data on this device is kept.</p>', 'Delete account', true))) return false;
    const r = await call('/api/account', 'DELETE', { password: f.pw.value });
    if (!r.ok) { LB.toast(r.j.error || 'Could not delete the account.'); return false; }
    D.account = null; D.sync = { rev: 0, lastAt: 0, status: 'off', error: '' }; setBase({}); LB.saveD(); footer(); LB.toast('Account deleted.'); return true;
  };
  S.backups = [];
  A.loadBackups = async () => { const r = await call('/api/backups'); S.backups = r.ok ? r.j.backups : []; if (!r.ok) LB.toast(r.j.error || 'Could not load backups.'); else if (!S.backups.length) LB.toast('No cloud backups yet. They are created automatically as you sync.'); return true; };
  A.restoreCloud = async el => {
    const r = await call('/api/backups/' + encodeURIComponent(el.dataset.id)); if (!r.ok) { LB.toast('Could not load that backup.'); return false; }
    if (!(await LB.confirm('Restore this cloud backup?', '<p>Your current data on this device and in the cloud will be replaced by the backup. A copy of what you have now is kept on this device.</p>', 'Restore', true))) return false;
    if (!LB.stashBackup(K.BK_IMPORT)) { LB.toast('Not restored: a safety copy could not be saved.'); return false; }
    const st = norm(r.j.data); applyLocal(st);
    const p = await call('/api/sync', 'PUT', { baseRev: D.sync.rev, data: st, force: true });
    if (p.ok) { D.sync.rev = p.j.rev; setBase(st); status('ok'); LB.toast('Backup restored.'); } else LB.toast('Restored on this device, but the cloud copy was not updated: ' + (p.j.error || p.status));
    return true;
  };
  const labelOf = p => p.split('/').map(x => x.replace(/^#/, '')).join(' \u203a ');
  A.keepMine = el => { D.syncConflicts.splice(+el.dataset.i, 1); LB.saveD(); return true; };
  A.useTheirs = el => {
    const c = D.syncConflicts[+el.dataset.i]; if (!c) return false;
    const st = json(LB.personal); M.setAt(st, c.path, c.theirs); LB.personal = norm(st); if (!LB.D.demo) LB.S = LB.personal; LB.save();
    D.syncConflicts.splice(+el.dataset.i, 1); LB.saveD(); return true;
  };
  const show = v => esc(typeof v === 'object' ? JSON.stringify(v) : String(v));

  S.card = () => {
    const st = D.sync.status, when = D.sync.lastAt ? new Date(D.sync.lastAt).toLocaleString() : '';
    let h = '<section class="card" aria-labelledby="acH"><h2 id="acH">\u2601\ufe0f Account &amp; sync</h2>';
    if (!D.account) {
      h += `<p class="small">Optional. Sign in to use LifeBalance on several phones and computers. Without an account your data stays only in this browser. Needs a sync server (see the README); there is no email recovery, so keep your password safe.</p>
      <form data-s="acctLogin"><label for="acE">Email</label><input type="email" id="acE" name="email" autocomplete="email" required><label for="acP">Password (10+ characters)</label><input type="password" id="acP" name="password" autocomplete="current-password" required minlength="10">
      <div class="row"><button class="btn">Sign in</button><button type="button" class="btn alt" data-a="acctRegister">Create account</button></div></form>
      <p class="muted small">When you first connect, you choose whether to upload or combine existing data; nothing is replaced without asking.</p></section>`;
      return h;
    }
    h += `<p class="small">Signed in as <b>${esc(D.account.email)}</b>. Status: <b>${{ ok: '\u2705 Up to date', syncing: '\u23f3 Syncing\u2026', offline: '\ud83d\udcf4 Offline, changes will sync later', failed: '\u274c Not synced', off: 'Off' }[st] || st}</b>${when ? ' (last sync ' + esc(when) + ')' : ''}.</p>`;
    if (D.sync.error) h += `<p class="err" role="alert">${esc(D.sync.error)}</p>`;
    h += `<div class="row"><button type="button" class="btn" data-a="syncNow">Sync now</button><button type="button" class="btn alt" data-a="signOut">Sign out</button></div>
    <p class="muted small">Your data is stored encrypted at rest on the sync server, separately for each account, with automatic backups (at most hourly, newest 30 kept). Sync merges changes from different devices. If two devices edit the same item, your version is kept and the other is listed below so nothing is silently lost.</p>`;
    if (D.syncConflicts.length) {
      h += '<h3>Changes to review</h3><ul class="plain">' + D.syncConflicts.map((c, i) => `<li class="alert"><b>${esc(c.label || labelOf(c.path))}</b><span>${esc(c.why || 'Changed on two devices')}. Mine: ${show(c.mine)} \u00b7 Other device: ${show(c.theirs)}</span><div class="row"><button type="button" class="btn sm" data-a="keepMine" data-i="${i}">Keep mine</button><button type="button" class="btn alt sm" data-a="useTheirs" data-i="${i}">Use the other</button></div></li>`).join('') + '</ul>';
    }
    h += `<details><summary>Cloud backups</summary><div class="row"><button type="button" class="btn alt sm" data-a="loadBackups">Show backups</button></div>${S.backups.length ? '<ul class="plain">' + S.backups.map(b => `<li>${esc(new Date(b.at).toLocaleString())} <button type="button" class="btn alt sm" data-a="restoreCloud" data-id="${esc(b.id)}">Restore</button></li>`).join('') + '</ul>' : ''}</details>
    <details><summary>Password and account</summary><form data-s="changePw"><label for="opw">Current password</label><input type="password" id="opw" name="oldp" autocomplete="current-password" required><label for="npw">New password (10+ characters)</label><input type="password" id="npw" name="newp" autocomplete="new-password" required minlength="10"><p><button class="btn alt">Change password</button></p></form>
    <form data-s="delAcct"><label for="dpw">Password to confirm deletion</label><input type="password" id="dpw" name="pw" autocomplete="current-password" required><p><button class="btn danger">Delete account and cloud data</button></p></form></details></section>`;
    return h;
  };
  footer(); if (D.account) setTimeout(S.run, 1500);
})();
