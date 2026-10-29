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

  S.serviceState = 'unchecked';
  S.checkService = async () => {
    S.serviceState = 'checking';
    S.serviceState = await S.available() ? 'ready' : 'unavailable';
    if (LB.ui.view === 'settings' && !document.activeElement.matches('input,textarea,select')) LB.render();
  };
  A.checkAccountService = () => { S.checkService(); return false; };
  S.card = () => {
    const st = D.sync.status, when = D.sync.lastAt ? new Date(D.sync.lastAt).toLocaleString() : '';
    let h = '<section class="card" aria-labelledby="acH"><h2 id="acH">\u2601\ufe0f Account &amp; sync</h2>';
    if (!D.account && S.serviceState !== 'ready') {
      if (S.serviceState === 'unchecked') S.checkService();
      return h + '<p class="small">' + (S.serviceState === 'checking' ? 'Checking account service...' : 'Account service is unavailable. Keep using LifeBalance on this device; your local records remain available.') + '</p><button type="button" class="btn alt" data-a="checkAccountService">Check connection</button><p class="muted small">Use Export backup in Your data to keep a portable copy. Online sync and automatic cloud backups require a connected account service.</p></section>';
    }
    if (!D.account) {
      h += `<p class="small">Optional. Sign in to use LifeBalance on several phones and computers. Without an account your data stays only in this browser. Needs a sync server (see the README); there is no email recovery, so keep your password safe.</p>
      <form data-s="acctLogin"><label for="acE">Email</label><input type="email" id="acE" name="email" autocomplete="email" required><label for="acP">Password (10+ characters)</label><input type="password" id="acP" name="password" autocomplete="current-password" required minlength="10">
      <div class="row"><button class="btn">Sign …10339 tokens truncated…div class="task"><span class="t">${TYPE_ICON[w.type]} <b>${esc(w.name || WT[w.type])}</b> <span class="muted small">${LB.fmtDate(w.date, true)}</span><br><span class="small">${w.minutes ? w.minutes + ' min' : ''}${w.distanceKm ? ' \u00b7 ' + LB.measure(w.distanceKm, 'distance') : ''}</span>` +
      (w.exercises.length ? '<br><span class="small">' + w.exercises.map(e => esc(e.name) + (e.sets || e.reps ? ' ' + (e.sets || '?') + '\u00d7' + (e.reps || '?') : '') + (e.weightKg ? ' @ ' + LB.measure(e.weightKg, 'weight') : '')).join('; ') + '</span>' : '') + (w.notes ? `<br><span class="small muted">${esc(w.notes)}</span>` : '') +
      `</span><span class="acts"><button type="button" class="btn danger sm" data-a="delWorkout" data-id="${w.id}" aria-label="Delete workout ${esc(w.name || WT[w.type])} on ${w.date}">Delete</button></span></div>`).join('') +
      (F.workouts.length > 10 && !LB.ui.allHist ? '<button type="button" class="btn alt sm" data-a="allHist">Show all</button>' : '') : LB.empty('\ud83c\udfc3', 'No workouts yet', 'Log your first walk, run, ride or gym session above.');
    h += '</section>';

    // plan
    h += `<section class="card" aria-labelledby="fpH"><h2 id="fpH">Weekly workout plan</h2>`;
    h += F.plan.length ? DAYS.map((n, i) => { const a = F.plan.filter(p => p.day === dowOfRow(i)); return a.length ? `<div class="dayhead">${n}</div>` + a.map(p => `<div class="task"><span class="t">${TYPE_ICON[p.type]} ${esc(p.name || WT[p.type])}${p.minutes ? ' \u00b7 ' + p.minutes + ' min' : ''}${p.time ? ' \u00b7 ' + p.time : ''}</span><span class="acts"><button type="button" class="btn danger sm" data-a="delPlan" data-id="${p.id}" aria-label="Remove ${esc(p.name || WT[p.type])} on ${n}">Remove</button></span></div>`).join('') : ''; }).join('') : LB.empty('\ud83d\uddd3\ufe0f', 'No plan yet', 'Add the workouts you would like to do each week.');
    h += !LB.ui.showPlan ? `<p><button type="button" class="btn alt" data-a="reveal" data-arg="showPlan" data-focus="#pl-day">\u2795 Add to plan</button></p></section>` : `<form data-s="addPlan" class="grid2"><div><label for="pl-day">Day</label><select id="pl-day" name="day">${DAYS.map((n, i) => opt(dowOfRow(i), n, dowOfRow(i) === planDay(t))).join('')}</select></div>
      <div><label for="pl-type">Activity</label><select id="pl-type" name="type">${Object.keys(WT).map(k => opt(k, WT[k])).join('')}</select></div>
      <div><label for="pl-name">Name (optional)</label><input type="text" id="pl-name" name="name" maxlength="60"></div>
      <div><label for="pl-min">Minutes</label><input type="number" id="pl-min" name="minutes" min="0" max="1440" inputmode="numeric" placeholder="30"></div>
      <div><label for="pl-time">Time (optional, for reminders)</label><input type="time" id="pl-time" name="time"></div><div class="row"><button class="btn">Add to plan</button><button type="button" class="btn alt" data-a="hide" data-arg="showPlan">Cancel</button></div></form></section>`;

    // goals + reminders
    const R = S.settings.fitnessReminders;
    h += `<section class="card" aria-labelledby="fgH"><h2 id="fgH">Goals and reminders</h2>${LB.ui.showGoals ? '' : `<p class="small">Goal: ${F.goals.weeklyWorkouts} workouts and ${F.goals.weeklyMinutes} active minutes a week \u00b7 workout reminders ${R.enabled ? "on" : "off"}.</p><button type="button" class="btn alt" data-a="reveal" data-arg="showGoals" data-focus="#g-w">Edit goals and reminders</button>`}<form data-s="saveFitGoals" class="grid2" ${LB.ui.showGoals ? '' : "hidden"}>
      <div><label for="g-w">Workouts per week</label><input type="number" id="g-w" name="w" min="0" max="21" value="${F.goals.weeklyWorkouts}" inputmode="numeric"></div>
      <div><label for="g-m">Active minutes per week</label><input type="number" id="g-m" name="m" min="0" max="10080" value="${F.goals.weeklyMinutes}" inputmode="numeric"></div>
      <div class="full"><label class="check"><input type="checkbox" name="fr" ${R.enabled ? 'checked' : ''}> Remind me before planned workouts that have a time</label></div>
      <div><label for="g-lead">Reminder lead time</label><select id="g-lead" name="lead">${[0, 15, 30, 60, 120].map(m => opt(m, m ? m + ' minutes before' : 'At the start time', R.lead === m)).join('')}</select></div>
      <div class="full"><label class="check"><input type="checkbox" name="tw" ${F.goals.trackWeight ? 'checked' : ''}> Track my weight (optional)</label></div>
      <div class="full"><button class="btn">Save goals</button></div></form>
      <p class="muted small">${R.enabled ? esc(LB.rem ? LB.rem.deliveryNote() : '') : 'Reminders use the same system as appointments. Details are hidden in notification previews unless you change that in Settings.'}</p></section>`;

    if (F.goals.trackWeight) {
      const ws2 = F.weights.slice().sort((a, b) => b.date.localeCompare(a.date));
      h += `<section class="card" aria-labelledby="fwtH"><h2 id="fwtH">\u2696\ufe0f Weight (optional)</h2><p class="muted small">Weight is private to you. A target is optional; there is no required goal.</p>`;
      if (ws2.length > 1) { const dlt = ws2[0].kg - ws2[ws2.length - 1].kg; h += `<p>Latest <b>${LB.measure(ws2[0].kg, 'weight')}</b> \u00b7 change since first entry: ${dlt > 0 ? '+' : ''}${LB.measure(dlt, 'weight')}</p>`; }
      h += ws2.length ? ws2.slice(0, 8).map(x => `<div class="task"><span class="t">${LB.fmtDate(x.date, true)} \u00b7 <b>${LB.measure(x.kg, 'weight')}</b></span><span class="acts"><button type="button" class="btn danger sm" data-a="delWeight" data-id="${x.id}" aria-label="Delete weight on ${x.date}">Delete</button></span></div>`).join('') : LB.empty('\u2696\ufe0f', 'No weight entries', 'Add one when you like. You can switch tracking off in Goals.');
      h += `<form data-s="addWeight" class="grid2"><div><label for="wt-d">Date</label><input type="date" id="wt-d" name="date" value="${t}" max="${t}" required></div><div><label for="wt-k">Weight (${LB.unit('weight')})</label><input type="number" id="wt-k" name="kg" min="${LB.displayValue(20, 'weight')}" max="${LB.displayValue(500, 'weight')}" step="any" inputmode="decimal" required></div>
        <div><label for="wt-t">Target weight (${LB.unit('weight')}, optional)</label><input type="number" id="wt-t" name="target" min="${LB.displayValue(20, 'weight')}" max="${LB.displayValue(500, 'weight')}" step="any" inputmode="decimal" value="${F.goals.targetWeightKg ? LB.num(LB.displayValue(F.goals.targetWeightKg, 'weight')) : ''}"></div><div><button class="btn">Save</button></div></form></section>`;
    }
    return h;
  }
  LB.changes.wkType = el => {
    LB.ui.wkType = el.value;
    const g = document.getElementById('wk-gym'), d = document.getElementById('wk-dist');
    if (g) g.hidden = !(el.value === 'gym' || el.value === 'custom'); if (d) d.hidden = el.value === 'gym';
    return 'none';
  };
  A.allHist = () => { LB.ui.allHist = true; };
  SB.addWorkout = f => {
    const d = f.date.value; if (!C.isDate(d) || d > LB.today()) { LB.toast('Choose a date that is not in the future.'); return false; }
    const type = f.type.value, minutes = Math.round(numOrNull(f.minutes.value) || 0), km = LB.metricValue(numOrNull(f.km.value), 'distance'), ex = [];
    for (let i = 0; i < 4; i++) { const n = f['exn' + i].value.trim(); if (n) ex.push({ name: n.slice(0, 60), sets: numOrNull(f['exs' + i].value), reps: numOrNull(f['exr' + i].value), weightKg: LB.metricValue(numOrNull(f['exw' + i].value), 'weight') }); }
    if (!minutes && !km && !ex.length) { LB.toast('Add a duration, distance or exercise.'); return false; }
    LB.S.fitness.workouts.push({ id: C.uid(), date: d, type, name: f.name.value.trim().slice(0, 60), minutes, distanceKm: type === 'gym' ? null : km, notes: f.notes.value.trim().slice(0, 500), exercises: ex });
    LB.ui.showWk = false; LB.save(); LB.toast('Workout saved.');
  };
  A.logPlanned = el => {
    const p = LB.S.fitness.plan.find(x => x.id === el.dataset.id); if (!p) return;
    LB.S.fitness.workouts.push({ id: C.uid(), planId: p.id, date: LB.today(), type: p.type, name: p.name, minutes: p.minutes, distanceKm: null, notes: '', exercises: [] }); LB.save(); LB.toast('Logged from your plan.');
  };
  A.delWorkout = el => LB.remove(() => LB.S.fitness.workouts, el.dataset.id, 'Workout');
  A.delPlan = el => LB.remove(() => LB.S.fitness.plan, el.dataset.id, 'Plan item');
  A.delWeight = el => LB.remove(() => LB.S.fitness.weights, el.dataset.id, 'Weight entry');
  SB.addPlan = f => {
    LB.S.fitness.plan.push({ id: C.uid(), day: +f.day.value, type: f.type.value, name: f.name.value.trim().slice(0, 60), minutes: Math.round(numOrNull(f.minutes.value) || 0), time: f.time.value || '' });
    LB.ui.showPlan = false; LB.save(); LB.toast('Added to your weekly plan.');
  };
  SB.saveFitGoals = f => {
    const S = LB.S; S.fitness.goals.weeklyWorkouts = Math.min(21, Math.round(numOrNull(f.w.value) || 0)); S.fitness.goals.weeklyMinutes = Math.min(10080, Math.round(numOrNull(f.m.value) || 0));
    S.fitness.goals.trackWeight = f.tw.checked; S.settings.fitnessReminders = { enabled: f.fr.checked, lead: +f.lead.value };
    LB.ui.showGoals = false; LB.save(); LB.toast('Goals saved.');
  };
  SB.addWeight = f => {
    const kg = LB.metricValue(numOrNull(f.kg.value), 'weight'); if (!(kg >= 20 && kg <= 500) || !C.isDate(f.date.value)) { LB.toast('Enter a weight between 20 and 500 kg.'); return false; }
    const tg = LB.metricValue(numOrNull(f.target.value), 'weight'); LB.S.fitness.goals.targetWeightKg = tg >= 20 && tg <= 500 ? tg : null;
    LB.S.fitness.weights.push({ id: C.uid(), date: f.date.value, kg }); LB.save(); LB.toast('Weight saved.');
  };

  /* =================== FOOD =================== */
  const allMeals = () => M.LIB.concat(LB.S.food.custom);
  const mealById = id => allMeals().find(m => m.id === id);
  const warn = m => M.conflicts(m, LB.S.food.prefs);
  const FT = [['diary', 'Diary'], ['plan', 'Meal plan'], ['shop', 'Shopping'], ['meals', 'Meals'], ['prefs', 'Preferences']];

  function food() {
    const tab = LB.ui.ftab || 'diary';
    return `<div class="seg sub" role="group" aria-label="Food section">${FT.map(x => `<button type="button" data-a="fTab" data-arg="${x[0]}" aria-pressed="${tab === x[0]}">${x[1]}</button>`).join('')}</div>` + ({ diary, plan, shop, meals, prefs }[tab] || diary)();
  }
  A.fTab = el => { LB.ui.ftab = el.dataset.arg; };
  // Detailed forms stay hidden until the matching button is pressed.
  A.reveal = el => { LB.ui[el.dataset.arg] = true; if (el.dataset.focus) LB.ui.focus = el.dataset.focus; };
  A.hide = el => { LB.ui[el.dataset.arg] = false; };

  function diary() {
    const S = LB.S, P = S.food.prefs, t = LB.today(), d = LB.ui.fdate || t, list = S.food.diary[d] || [], w = water();
    let h = `<section class="card"><label for="fd-date">Day</label><input type="date" id="fd-date" value="${d}" max="${t}" data-c="fdate" style="max-width:200px"> ${d !== t ? '<button type="button" class="btn alt sm" data-a="fToday">Today</button>' : ''}</section>`;
    h += `<section class="card" aria-labelledby="fdH"><h2 id="fdH">Food diary \u00b7 ${LB.fmtDate(d)}</h2>`;
    let total = 0, counted = 0;
    SLOTS.forEach(s => {
      const e = list.filter(x => x.meal === s);
      h += `<div class="dayhead">${SLOT_ICON[s]} ${cap(s)}</div>` + (e.length ? e.map(x => { if (x.kcal != null) { total += x.kcal * x.servings; counted++; } return `<div class="task"><span class="t">${esc(x.name)} <span class="muted small">\u00d7 ${LB.num(x.servings)} serving${x.servings === 1 ? '' : 's'}${P.trackCalories && x.kcal != null ? ' \u00b7 ~' + Math.round(x.kcal * x.servings) + ' kcal (your estimate)' : ''}</span></span><span class="acts"><button type="button" class="btn danger sm" data-a="delDiary" data-id="${x.id}" data-arg="${d}" aria-label="Delete ${esc(x.name)}">Delete</button></span></div>`; }).join('') : '<p class="muted small">Nothing logged.</p>');
    });
    if (!list.length) h += LB.empty('\ud83c\udf7d\ufe0f', 'No meals logged', 'Add what you ate below. This diary is private and optional.');
    if (P.trackCalories) h += `<p class="note"><b>Calories (your own estimates):</b> ~${Math.round(total)} kcal from ${counted} item${counted === 1 ? '' : 's'} with an estimate${P.calorieTarget ? ' \u00b7 your optional target: ' + P.calorieTarget + ' kcal' : ''}. Built-in meals have no nutrition data; values shown are only what you entered. They are not exact.</p>`;
    h += !LB.ui.showMeal ? `<p><button type="button" class="btn big" data-a="reveal" data-arg="showMeal" data-focus="#fd-name">\u2795 Add meal</button></p></section>` : `<form data-s="addDiary" class="grid2"><div><label for="fd-slot">Meal</label><select id="fd-slot" name="slot">${SLOTS.map(s => opt(s, cap(s))).join('')}</select></div>
      <div><label for="fd-name">Food or meal</label><input type="text" id="fd-name" name="name" list="mealNames" maxlength="100" required autocomplete="off"><datalist id="mealNames">${allMeals().map(m => `<option value="${esc(m.name)}">`).join('')}</datalist></div>
      <div><label for="fd-srv">Portion (servings)</label><input type="number" id="fd-srv" name="srv" min="0.1" max="20" step="0.25" value="1" inputmode="decimal"></div>` +
      (P.trackCalories ? `<div><label for="fd-kcal">Calories per serving (optional estimate)</label><input type="number" id="fd-kcal" name="kcal" min="0" max="20000" inputmode="numeric"></div>` : '') +
      `<div class="full row"><button class="btn">Add to diary</button><button type="button" class="btn alt" data-a="hide" data-arg="showMeal">Cancel</button></div></form></section>`;
    if (w) {
      const v = C.habitValue(S, d, w), g = C.goalOn(w, d);
      h += `<section class="card" aria-labelledby="fwaH"><h2 id="fwaH">\ud83d\udca7 Water</h2>${bar(v, g, 'Water (' + w.unit + ')')}<div class="row"><button type="button" class="btn alt" data-a="waterStep" data-arg="-1" data-key="${d}" aria-label="Remove one step of water">\u2212</button><button type="button" class="btn" data-a="waterStep" data-arg="1" data-key="${d}" aria-label="Add one step of water">+ ${LB.num(w.step)} ${esc(w.unit)}</button></div>
        <p class="muted small">This is the same water count as on the Habits tab, so it is never counted twice.</p>`;
      const H = S.settings.hydrationReminders;
      h += `<form data-s="saveHydration"><label class="check"><input type="checkbox" name="on" ${H.enabled ? 'checked' : ''}> Hydration reminders</label><label for="hy-t">Times (comma separated, 24h, e.g. 10:00, 15:00)</label><input type="text" id="hy-t" name="times" value="${esc(H.times.join(', '))}"><p><button class="btn sm">Save</button></p></form></section>`;
    }
    const MR = S.settings.mealReminders;
    h += `<section class="card"><h2>Meal reminders</h2><form data-s="saveMealRem" class="grid2"><div class="full"><label class="check"><input type="checkbox" name="on" ${MR.enabled ? 'checked' : ''}> Remind me to log meals</label></div>` +
      ['breakfast', 'lunch', 'dinner'].map(s => `<div><label for="mr-${s}">${cap(s)}</label><input type="time" id="mr-${s}" name="${s}" value="${MR[s]}"></div>`).join('') + `<div class="full"><button class="btn sm">Save</button></div></form>
      <p class="muted small">${MR.enabled || S.settings.hydrationReminders.enabled ? esc(LB.rem ? LB.rem.deliveryNote() : '') : 'Reminders are optional and appear generically in notifications.'}</p></section>`;
    return h;
  }
  LB.changes.fdate = el => { LB.ui.fdate = C.isDate(el.value) && el.value <= LB.today() ? el.value : null; };
  A.fToday = () => { LB.ui.fdate = null; };
  A.waterStep = el => {
    const S = LB.S, h = water(), d = el.dataset.key; if (!h) return;
    const nv = Math.max(0, Math.round((C.habitManual(S, d, h) + (+el.dataset.arg) * h.step) * 100) / 100);
    (S.logs[d] = S.logs[d] || {})[h.id] = nv; LB.save();
  };
  SB.addDiary = f => {
    const S = LB.S, name = f.name.value.trim(), d = LB.ui.fdate || LB.today(), m = allMeals().find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!name) return false;
    let kcal = f.kcal ? numOrNull(f.kcal.value) : null; if (kcal == null && m && m.nutrition) kcal = m.nutrition.kcal;
    (S.food.diary[d] = S.food.diary[d] || []).push({ id: C.uid(), meal: f.slot.value, name: name.slice(0, 100), mealId: m ? m.id : '', servings: Math.min(20, Math.max(0.1, parseFloat(f.srv.value) || 1)), kcal });
    LB.save();
    LB.ui.showMeal = false; const w = m ? warn(m) : []; LB.toast(w.length ? 'Added. Note: ' + w.join('; ') + '.' : 'Added to your diary.');
  };
  A.delDiary = el => LB.remove(() => LB.S.food.diary[el.dataset.arg] || [], el.dataset.id, 'Entry');
  SB.saveHydration = f => {
    const times = f.times.value.split(/[,\s]+/).filter(x => /^([01]\d|2[0-3]):[0-5]\d$/.test(x));
    if (f.on.checked && !times.length) { LB.toast('Enter at least one time like 10:00.'); return false; }
    LB.S.settings.hydrationReminders = { enabled: f.on.checked, times: [...new Set(times)].sort().slice(0, 12) }; LB.save(); LB.toast('Hydration reminders saved.');
  };
  SB.saveMealRem = f => { LB.S.settings.mealReminders = { enabled: f.on.checked, breakfast: f.breakfast.value || '08:00', lunch: f.lunch.value || '13:00', dinner: f.dinner.value || '19:00' }; LB.save(); LB.toast('Meal reminders saved.'); };

  /* ---- meal plan + shopping ---- */
  function plan() {
    const S = LB.S, ws = LB.ui.pwk || C.weekStart(LB.today());
    let h = `<section class="card"><div class="row between"><button type="button" class="btn alt sm" data-a="pWeek" data-arg="-7" aria-label="Previous week">\u2039 Prev</button><b>Week of ${LB.fmtDate(ws)}</b><button type="button" class="btn alt sm" data-a="pWeek" data-arg="7" aria-label="Next week">Next \u203a</button></div></section>`;
    for (let i = 0; i < 7; i++) {
      const d = C.addDays(ws, i), p = S.food.plan[d] || {};
      h += `<section class="card"><h2>${DAYS[i]} <span class="muted small">${LB.fmtDate(d)}</span></h2><div class="grid2">` + ['breakfast', 'lunch', 'dinner', 'snack'].map(s => {
        const cands = allMeals().filter(m => m.slots.includes(s) || m.id === p[s]).sort((a, b) => (S.food.favourites.includes(b.id) - S.food.favourites.includes(a.id)) || a.name.localeCompare(b.name));
        return `<div><label for="pm-${d}-${s}">${SLOT_ICON[s]} ${cap(s)}</label><select id="pm-${d}-${s}" data-c="planMeal" data-id="${d}" data-arg="${s}"><option value="">\u2014 none \u2014</option>${cands.map(m => opt(m.id, (S.food.favourites.includes(m.id) ? '\u2605 ' : '') + m.name + (warn(m).length ? ' \u26a0' : ''), m.id === p[s])).join('')}</select><label class="sr" for="pp-${d}-${s}">Portions for ${s}</label><input type="number" id="pp-${d}-${s}" class="portion" min="0.5" max="20" step="0.5" value="${S.food.planServings[d + '|' + s] || 1}" data-c="planPortions" data-id="${d}" data-arg="${s}" aria-label="Portions for ${cap(s)} on ${DAYS[i]}" title="Portions"></div>`;
      }).join('') + '</div>';
      const ws2 = Object.keys(p).map(s => { const m = mealById(p[s]); return m && warn(m).length ? esc(m.name) + ': ' + esc(warn(m).join('; ')) : ''; }).filter(Boolean);
      if (ws2.length) h += `<p class="note" role="note">\u26a0 ${ws2.join('<br>\u26a0 ')}<br><span class="small">Tags are best-effort. Always check labels and ingredients yourself.</span></p>`;
      h += '</section>';
    }
    return h + '<p class="muted small">Planning a meal updates your shopping list automatically.</p>';
  }
  A.pWeek = el => { LB.ui.pwk = C.addDays(LB.ui.pwk || C.weekStart(LB.today()), +el.dataset.arg); };
  LB.changes.planMeal = el => {
    const S = LB.S, d = el.dataset.id, s = el.dataset.arg; S.food.plan[d] = S.food.plan[d] || {};
    if (el.value) S.food.plan[d][s] = el.value; else { delete S.food.plan[d][s]; delete S.food.planServings[d + '|' + s]; }
    if (!Object.keys(S.food.plan[d]).length) delete S.food.plan[d];
    rebuildShopping(); LB.save(); LB.ui.focus = '#' + el.id;
  };
  // Rebuilds the auto-generated part of the shopping list from meals planned from today onwards. Manual and edited items and ticks are kept.
  LB.changes.planPortions = el => {
    const S = LB.S, k = el.dataset.id + '|' + el.dataset.arg, v = Math.min(20, Math.max(0.5, parseFloat(el.value) || 1));
    if (!(S.food.plan[el.dataset.id] || {})[el.dataset.arg]) return false;
    if (v === 1) delete S.food.planServings[k]; else S.food.planServings[k] = v;
    rebuildShopping(); LB.save(); LB.ui.focus = '#' + el.id;
  };
  function rebuildShopping() {
    const F = LB.S.food, t = LB.today(), entries = [], old = new Map(F.shopping.filter(x => x.auto).map(x => [x.key || x.name.toLowerCase(), x]));
    Object.keys(F.plan).filter(d => d >= t).sort().forEach(d => SLOTS.forEach(s => {
      const m = mealById(F.plan[d][s]); if (m) entries.push({ meal: m, portions: F.planServings[d + '|' + s] || 1 });
    }));
    const manual = F.shopping.filter(x => !x.auto), have = new Set(manual.map(x => x.name.toLowerCase()));
    F.shopping = manual.concat(M.aggregate(entries).filter(e => !have.has(e.text.toLowerCase())).map(e => {
      const o = old.get(e.key) || old.get(e.text.toLowerCase());
      return { id: o ? o.id : C.uid(), name: e.text.slice(0, 80), key: e.key, auto: true, checked: o ? o.checked : false, sources: e.sources.slice(0, 20) };
    }));
  }
  function shop() {
    const L = LB.S.food.shopping, open = L.filter(x => !x.checked), done = L.filter(x => x.checked);
    let h = `<section class="card" aria-labelledby="shH"><h2 id="shH">\ud83d\uded2 Shopping list</h2>`;
    h += L.length ? open.concat(done).map(x => LB.ui.editShop === x.id ? `<form class="task" data-s="saveShop" data-id="${x.id}"><label class="sr" for="es">Item</label><input type="text" id="es" name="name" value="${esc(x.name)}" maxlength="80" required><button class="btn sm">Save</button><button type="button" class="btn alt sm" data-a="cancelShop">Cancel</button></form>` :
      `<div class="task ${x.checked ? 'done' : ''}"><button type="button" class="chk" data-a="toggleShop" data-id="${x.id}" aria-pressed="${x.checked}" aria-label="${x.checked ? 'Untick' : 'Tick'} ${esc(x.name)}">${x.checked ? '\u2713' : ''}</button><span class="t">${esc(x.name)}${x.sources.length ? `<br><span class="muted small">for ${esc(x.sources.join(', '))}</span>` : ''}</span><span class="acts"><button type="button" class="btn alt sm" data-a="editShop" data-id="${x.id}" aria-label="Edit ${esc(x.name)}">Edit</button><button type="button" class="btn danger sm" data-a="delShop" data-id="${x.id}" aria-label="Delete ${esc(x.name)}">Delete</button></span></div>`).join('') :
      LB.empty('\ud83d\uded2', 'Shopping list is empty', 'Plan meals for today or later and ingredients appear here automatically. You can also add your own items.');
    h += `<form class="task" data-s="addShop"><label class="sr" for="shN">New item</label><input type="text" id="shN" name="name" placeholder="Add an item" maxlength="80" required><button class="btn">Add</button></form>
      <div class="row"><button type="button" class="btn alt sm" data-a="refreshShop">Refresh from meal plan</button>${done.length ? '<button type="button" class="btn alt sm" data-a="clearTicked">Remove ticked items</button>' : ''}</div>
      <p class="muted small">Quantities are scaled by the portions you set in the plan and matching ingredients are combined (estimates from per-serving amounts; check pack sizes). Items you delete may return when the plan changes or you refresh. Editing an item makes it yours, so it stays.</p></section>`;
    return h;
  }
  A.toggleShop = el => { const x = LB.S.food.shopping.find(i => i.id === el.dataset.id); if (x) { x.checked = !x.checked; LB.save(); } };
  A.editShop = el => { LB.ui.editShop = el.dataset.id; LB.ui.focus = '#es'; };
  A.cancelShop = () => { LB.ui.editShop = null; };
  A.delShop = el => LB.remove(() => LB.S.food.shopping, el.dataset.id, 'Item');
  A.refreshShop = () => { rebuildShopping(); LB.save(); LB.toast('Shopping list refreshed from your meal plan.'); };
  A.clearTicked = () => { LB.S.food.shopping = LB.S.food.shopping.filter(x => !x.checked); LB.save(); };
  SB.addShop = f => { const n = f.name.value.trim(); if (!n) return false; LB.S.food.shopping.push({ id: C.uid(), name: n.slice(0, 80), auto: false, checked: false, sources: [] }); LB.save(); LB.ui.focus = '#shN'; };
  SB.saveShop = f => { const x = LB.S.food.shopping.find(i => i.id === f.dataset.id), n = f.name.value.trim(); if (x && n) { x.name = n.slice(0, 80); x.auto = false; x.sources = []; } LB.ui.editShop = null; LB.save(); };

  /* ---- meals, favourites, recipes ---- */
  function meals() {
    const S = LB.S, q = (LB.ui.mq || '').toLowerCase(), slot = LB.ui.mslot || '', cu = LB.ui.mcu || '', favOnly = !!LB.ui.mfav;
    const cuisines = [...new Set(allMeals().map(m => m.cuisine))].sort();
    let list = allMeals().filter(m => (!slot || m.slots.includes(slot)) && (!cu || m.cuisine === cu) && (!favOnly || S.food.favourites.includes(m.id)) && (!q || (m.name + ' ' + m.ingredients.join(' ')).toLowerCase().includes(q)));
    let h = `<section class="card"><h2>Meal ideas</h2><p class="muted small">Explore meals from around the world, including African, Asian, Mediterranean and other international favourites. Built-in meals have no nutrition values. Diet tags are best-effort suggestions, not guarantees.</p>
      <div class="grid2"><div><label for="m-q">Search</label><input type="search" id="m-q" value="${esc(LB.ui.mq || '')}" data-i="mealSearch" placeholder="Name or ingredient"></div>
      <div><label for="m-slot">Meal</label><select id="m-slot" data-c="mealFilter" data-arg="mslot"><option value="">Any</option>${SLOTS.map(s => opt(s, cap(s), s === slot)).join('')}</select></div>
      <div><label for="m-cu">Cuisine</label><select id="m-cu" data-c="mealFilter" data-arg="mcu"><option value="">Any</option>${cuisines.map(c => opt(c, c, c === cu)).join('')}</select></div>
      <div><label class="check"><input type="checkbox" data-c="mealFilter" data-arg="mfav" ${favOnly ? 'checked' : ''}> Favourites only</label></div></div></section><div id="mealList">${mealCards(list)}</div>`;
    h += `<section class="card" aria-labelledby="rcH"><h2 id="rcH">Add my own recipe</h2><form data-s="addRecipe" class="grid2">
      <div><label for="rc-n">Name</label><input type="text" id="rc-n" name="name" maxlength="80" required></div><div><label for="rc-c">Cuisine (optional)</label><input type="text" id="rc-c" name="cuisine" maxlength="30" placeholder="e.g. Family favourite"></div>
      <div class="full"><label for="rc-i">Ingredients (one per line or comma separated)</label><textarea id="rc-i" name="ing" rows="3"></textarea></div>
      <div class="full"><span class="small">Suitable for:</span> ${SLOTS.map(s => `<label class="check inline"><input type="checkbox" name="s-${s}" checked> ${cap(s)}</label>`).join(' ')}</div>
      <div><label for="rc-s">Servings the recipe makes</label><input type="number" id="rc-s" name="srv" min="0.5" max="50" step="0.5" value="1"></div>
      <div class="full"><details><summary>Optional nutrition per serving (your own estimate)</summary><p class="small muted">Only enter values you know, for example from a food label. LifeBalance never invents nutrition numbers. Source recorded: "entered by you".</p>
        <div class="grid2"><div><label for="rc-k">Calories (kcal)</label><input type="number" id="rc-k" name="kcal" min="0" inputmode="numeric"></div><div><label for="rc-p">Protein (g)</label><input type="number" id="rc-p" name="protein" min="0" inputmode="decimal"></div><div><label for="rc-cb">Carbs (g)</label><input type="number" id="rc-cb" name="carbs" min="0" inputmode="decimal"></div><div><label for="rc-f">Fat (g)</label><input type="number" id="rc-f" name="fat" min="0" inputmode="decimal"></div></div></details></div>
      <div class="full"><button class="btn">Save recipe</button></div></form></section>`;
    return h;
  }
  function mealCards(list) {
    const S = LB.S;
    if (!list.length) return LB.empty('\ud83d\udd0e', 'No meals match', 'Try a different search or filter.');
    return list.map(m => {
      const w = warn(m), fav = S.food.favourites.includes(m.id), n = m.nutrition && Object.values(m.nutrition).some(v => v != null) ? m.nutrition : null;
      return `<section class="card meal"><div class="row between"><b>${esc(m.name)}</b><button type="button" class="btn alt sm" data-a="toggleFav" data-id="${esc(m.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from favourites' : 'Add to favourites'}: ${esc(m.name)}">${fav ? '\u2605' : '\u2606'}</button></div>
        <p class="small muted">${esc(m.cuisine)} \u00b7 ${m.slots.map(cap).join(', ') || 'any meal'}${m.servings ? ' \u00b7 makes ' + m.servings + ' serving' + (m.servings === 1 ? '' : 's') : ''}</p><p class="small">${esc(m.ingredients.join(', '))}</p>
        ${n && S.food.prefs.trackCalories ? `<p class="small">Your estimate per serving: ${n.kcal != null ? n.kcal + ' kcal ' : ''}${n.protein != null ? '\u00b7 protein ' + n.protein + ' g ' : ''}${n.carbs != null ? '\u00b7 carbs ' + n.carbs + ' g ' : ''}${n.fat != null ? '\u00b7 fat ' + n.fat + ' g' : ''} <span class="badge">entered by you</span></p>` : ''}
        ${w.length ? `<p class="note" role="note">\u26a0 ${esc(w.join('; '))}</p>` : ''}
        <div class="row"><button type="button" class="btn sm" data-a="quickLog" data-id="${esc(m.id)}">Add to today's diary</button>${m.builtin ? '' : `<button type="button" class="btn danger sm" data-a="delRecipe" data-id="${esc(m.id)}" aria-label="Delete recipe ${esc(m.name)}">Delete</button>`}</div></section>`;
    }).join('');
  }
  LB.inputs.mealSearch = el => { LB.ui.mq = el.value; const l = document.getElementById('mealList'); if (l) l.innerHTML = mealCards(allMeals().filter(m => (!LB.ui.mslot || m.slots.includes(LB.ui.mslot)) && (!LB.ui.mcu || m.cuisine === LB.ui.mcu) && (!LB.ui.mfav || LB.S.food.favourites.includes(m.id)) && (!el.value || (m.name + ' ' + m.ingredients.join(' ')).toLowerCase().includes(el.value.toLowerCase())))); };
  LB.changes.mealFilter = el => { LB.ui[el.dataset.arg] = el.type === 'checkbox' ? el.checked : el.value; LB.ui.focus = '#' + el.id; if (el.type === 'checkbox') LB.ui.focus = '[data-arg=mfav]'; };
  A.toggleFav = el => { const f = LB.S.food.favourites, i = f.indexOf(el.dataset.id); if (i >= 0) f.splice(i, 1); else f.push(el.dataset.id); LB.save(); LB.ui.focus = `[data-a=toggleFav][data-id="${el.dataset.id}"]`; };
  A.quickLog = el => {
    const m = mealById(el.dataset.id), d = LB.today(); if (!m) return;
    const slot = SLOTS.find(s => m.slots.includes(s)) || 'snack';
    (LB.S.food.diary[d] = LB.S.food.diary[d] || []).push({ id: C.uid(), meal: slot, name: m.name, mealId: m.id, servings: 1, kcal: m.nutrition ? m.nutrition.kcal : null }); LB.save();
    LB.toast('Added to today\'s ' + slot + '.' + (warn(m).length ? ' Note: ' + warn(m).join('; ') + '.' : '')); LB.ui.focus = `[data-a=quickLog][data-id="${m.id}"]`;
  };
  SB.addRecipe = f => {
    const name = f.name.value.trim(); if (!name) return false;
    const ing = f.ing.value.split(/[\n,]+/).map(x => x.trim()).filter(Boolean).slice(0, 60), slots = SLOTS.filter(s => f['s-' + s].checked);
    LB.S.food.custom.push({ id: 'c' + C.uid(), name: name.slice(0, 80), cuisine: f.cuisine.value.trim().slice(0, 30) || 'Custom', slots, diets: [], allergens: [], ingredients: ing, servings: Math.max(0.5, parseFloat(f.srv.value) || 1), notes: '', nutrition: { kcal: numOrNull(f.kcal.value), protein: numOrNull(f.protein.value), carbs: numOrNull(f.carbs.value), fat: numOrNull(f.fat.value) }, builtin: false });
    LB.save(); LB.toast('Recipe saved. Diet and allergy tags are not set for your own recipes, but your excluded ingredients are still checked.');
  };
  A.delRecipe = el => { LB.remove(() => LB.S.food.custom, el.dataset.id, 'Recipe'); };

  /* ---- preferences ---- */
  function prefs() {
    const P = LB.S.food.prefs;
    return `<section class="card" aria-labelledby="pfH"><h2 id="pfH">Dietary preferences</h2><p class="muted small">Used only to warn you about meal ideas and plans. Matching is best-effort from ingredient names. It is not a guarantee, so always read labels, especially for allergies.</p>
      <form data-s="savePrefs"><fieldset><legend>Diet</legend>${M.DIETS.map(d => `<label class="check inline"><input type="checkbox" name="d-${d}" ${P.diets.includes(d) ? 'checked' : ''}> ${cap(d)}</label>`).join(' ')}</fieldset>
      <label for="pf-a">Allergies (comma separated, e.g. peanut, egg, dairy)</label><input type="text" id="pf-a" name="allergies" value="${esc(P.allergies.join(', '))}">
      <label for="pf-e">Ingredients to exclude (comma separated)</label><input type="text" id="pf-e" name="exclusions" value="${esc(P.exclusions.join(', '))}">
      <label class="check"><input type="checkbox" name="track" ${P.trackCalories ? 'checked' : ''}> Show calorie estimates in my diary (optional)</label>
      <label for="pf-k">Daily calorie target (optional; leave blank for none)</label><input type="number" id="pf-k" name="target" min="500" max="10000" inputmode="numeric" value="${P.calorieTarget || ''}">
      <p class="small muted">Calorie and weight-loss targets are optional and are not medical advice. Nutrition values come only from numbers you enter yourself; no food database is connected and no photo analysis is available. For medical diets, ask a qualified professional.</p>
      <p><button class="btn">Save preferences</button></p></form></section>`;
  }
  SB.savePrefs = f => {
    const split = v => [...new Set(v.split(',').map(x => x.trim().toLowerCase()).filter(Boolean))].slice(0, 40);
    LB.S.food.prefs = { diets: M.DIETS.filter(d => f['d-' + d].checked), allergies: split(f.allergies.value), exclusions: split(f.exclusions.value), trackCalories: f.track.checked, calorieTarget: numOrNull(f.target.value) >= 500 ? numOrNull(f.target.value) : null };
    LB.save(); LB.toast('Preferences saved.');
  };
})();
