/* LifeBalance app shell: storage, demo mode, undo, toasts, dialogs, rendering. */
(function () {
  const C = window.LBCore;
  const KEY = 'lifebalance.v2', V1 = 'lifebalance.v1', DEMO = 'lifebalance.demo', DEV = 'lifebalance.device';
  const BK_WORK = 'lifebalance.backup.beforeWork';
  const BK_IMPORT = 'lifebalance.backup.import', BK_CLEAR = 'lifebalance.backup.clear';
  const LB = window.LB = { C, views: {}, actions: {}, submits: {}, inputs: {}, changes: {}, hooks: [], ui: { tab: 'today', view: null }, KEYS: { KEY, V1, DEMO, DEV, BK_IMPORT, BK_CLEAR, BK_WORK } };

  LB.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  LB.today = () => C.localDateKey();
  LB.tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } })();
  LB.fmtDate = (k, long) => C.parseDate(k).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', ...(long ? { year: 'numeric' } : {}) });
  LB.fmtInstant = (ms, tz) => new Date(ms).toLocaleString(undefined, { timeZone: tz || LB.tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  LB.pct = v => Math.round(v * 100);
  LB.num = v => (Math.round(v * 100) / 100).toString();

  const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  LB.D = Object.assign({ demo: false, serverUrl: '', device: null, notifEnabled: false, fired: {}, snoozes: {}, alerts: [], lastCheck: 0, push: { status: 'none', error: '', count: 0, at: 0 } }, readJSON(DEV) || {});
  LB.saveD = () => { try { localStorage.setItem(DEV, JSON.stringify(LB.D)); } catch (e) { /* ignore */ } };

  /* ---------- load ---------- */
  LB.loadNotice = '';
  function load() {
    const today = LB.today();
    let personal = null, raw = localStorage.getItem(KEY);
    if (raw) {
      let parsed = null; try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      if (parsed) {
        if ((parsed.version || 1) < 3 && !localStorage.getItem(BK_WORK)) { try { localStorage.setItem(BK_WORK, JSON.stringify({at:Date.now(),state:parsed})); } catch(e) { LB.loadNotice='Could not create an upgrade backup. Export your records from Settings.'; } }
        personal = C.normalize(parsed, today).state;
      }
      else { try { localStorage.setItem('lifebalance.corrupt.' + Date.now(), raw); } catch (e) { /* ignore */ } LB.loadNotice = 'Your saved data could not be read. A copy was kept in this browser and a fresh start was created.'; }
    } else {
      const v1 = localStorage.getItem(V1);
      if (v1) {
        let p = null; try { p = JSON.parse(v1); } catch (e) { p = null; }
        if (p) {
          const n = C.normalize(p, today);
          if (n.legacySample) { if (!localStorage.getItem(DEMO)) localStorage.setItem(DEMO, JSON.stringify(n.state)); LB.loadNotice = 'Sample data from the earlier version was moved to Demo mode. Your own data was not touched.'; }
          else { personal = n.state; LB.loadNotice = 'Your data from the earlier version was upgraded and kept.'; }
        }
      }
    }
    LB.personal = personal || C.freshState(today);
    try { localStorage.setItem(KEY, JSON.stringify(LB.personal)); } catch (e) { /* ignore */ }
    if (LB.D.demo) enterDemo(true); else LB.S = LB.personal;
  }
  function enterDemo(quiet) {
    const today = LB.today(); let d = null, raw = readJSON(DEMO);
    if (raw) d = C.normalize(raw, today).state;
    if (!d) { d = C.demoState(today); localStorage.setItem(DEMO, JSON.stringify(d)); }
    LB.demoS = d; LB.S = d; LB.D.demo = true; LB.saveD();
    if (!quiet) { LB.ui.tab = 'today'; LB.ui.view = null; }
  }
  LB.enterDemo = () => { enterDemo(); LB.render(); };
  LB.exitDemo = () => { LB.D.demo = false; LB.saveD(); LB.S = LB.personal; LB.ui.view = null; LB.render(); LB.rem && LB.rem.syncSoon(); };
  LB.resetDemo = () => { localStorage.removeItem(DEMO); enterDemo(); LB.render(); };

  /* ---------- saving ---------- */
  LB.persist = () => {
    try { localStorage.setItem(LB.D.demo ? DEMO : KEY, JSON.stringify(LB.S)); LB.saveError = ''; }
    catch (e) { LB.saveError = 'Could not save: browser storage is full or blocked. Export a backup from Settings.'; LB.toast(LB.saveError); }
  };
  LB.save = () => {
    const fresh = C.updateAchievements(LB.S, LB.today());
    LB.persist();
    if (fresh.length) LB.toast('\ud83c\udfc6 Achievement unlocked: ' + fresh.map(a => a.name).join(', '));
    if (!LB.D.demo && LB.rem) LB.rem.syncSoon();
  };

  /* ---------- toast & dialogs ---------- */
  let toastTimer = null;
  LB.toast = (msg, undo) => {
    const el = document.getElementById('toast'); clearTimeout(toastTimer);
    el.innerHTML = '<span>' + LB.esc(msg) + '</span>' + (undo ? '<button type="button" id="undoBtn">Undo</button>' : '');
    el.hidden = false;
    if (undo) document.getElementById('undoBtn').onclick = () => { el.hidden = true; undo(); LB.render(); };
    toastTimer = setTimeout(() => { el.hidden = true; }, undo ? 9000 : 4500);
  };
  // buttons: [{label, value, cls}]. Resolves with the chosen value, or null if dismissed.
  LB.ask = ({ title, body, buttons }) => new Promise(res => {
    const prev = document.activeElement, bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mdT"><h2 id="mdT">' + LB.esc(title) + '</h2><div>' + (body || '') + '</div><div class="row">' +
      buttons.map((b, i) => '<button type="button" class="btn ' + (b.cls || '') + '" data-v="' + i + '">' + LB.esc(b.label) + '</button>').join('') + '</div></div>';
    const done = v => { bg.remove(); document.removeEventListener('keydown', key, true); if (prev && prev.focus) prev.focus(); res(v); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); done(null); }
      if (e.key === 'Tab') { const f = [...bg.querySelectorAll('button,input,select')]; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    };
    bg.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) done(buttons[+b.dataset.v].value); else if (e.target === bg) done(null); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(bg);
    const f = bg.querySelector('input,select') || bg.querySelector('.btn:not(.danger)') || bg.querySelector('.btn'); f.focus();
  });
  LB.confirm = (title, body, okLabel, danger) => LB.ask({ title, body, buttons: [{ label: 'Cancel', value: false, cls: 'alt' }, { label: okLabel || 'OK', value: true, cls: danger ? 'danger' : '' }] }).then(v => v === true);

  /* ---------- undoable delete ---------- */
  LB.remove = (getArr, id, label) => {
    const arr = getArr(), idx = arr.findIndex(x => x.id === id); if (idx < 0) return;
    const [item] = arr.splice(idx, 1); LB.save();
    LB.toast(label + ' deleted.', () => { const a = getArr(); a.splice(Math.min(idx, a.length), 0, item); LB.save(); });
  };

  /* ---------- backups: import / clear ---------- */
  LB.stashBackup = key => { try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), state: LB.personal })); return true; } catch (e) { return false; } };
  LB.restoreBackup = key => {
    const b = readJSON(key); if (!b || !b.state) return false;
    LB.personal = C.normalize(b.state, LB.today()).state; if (!LB.D.demo) LB.S = LB.personal;
    localStorage.setItem(KEY, JSON.stringify(LB.personal)); LB.rem && LB.rem.syncSoon(); return true;
  };
  LB.getBackup = key => { const b = readJSON(key); return b && b.state ? b : null; };
  LB.replacePersonal = (state, backupKey) => {
    if (!LB.stashBackup(backupKey)) return false;
    LB.personal = state; if (!LB.D.demo) LB.S = state;
    localStorage.setItem(KEY, JSON.stringify(state)); LB.rem && LB.rem.syncSoon(); return true;
  };

  /* ---------- rendering ---------- */
  const TABS = [['today', '\ud83c\udfe0', 'Today'], ['habits', '\u2705', 'Habits'], ['journal', '\ud83d\udcd4', 'Journal'], ['events', '\ud83d\udcc5', 'Events'], ['wellness', '\ud83d\udcaa', 'Wellness'], ['work', '\ud83d\udcbc', 'Work'], ['progress', '\ud83d\udcca', 'Progress']];
  LB.go = tab => { LB.ui.tab = tab; LB.ui.view = null; LB.render(true); };
  LB.render = top => {
    const app = document.getElementById('app'), y = window.scrollY;
    const view = LB.ui.view || LB.ui.tab;
    try { app.innerHTML = LB.views[view](); }
    catch (e) { console.error(e); app.innerHTML = '<div class="card err" role="alert">Something went wrong showing this page. Your data is safe. <button class="btn sm" data-a="go" data-arg="today">Go to Today</button></div>'; }
    document.getElementById('tabs').innerHTML = TABS.map(t => '<button type="button" data-a="go" data-arg="' + t[0] + '"' + (LB.ui.tab === t[0] ? ' aria-current="page"' : '') + '><span class="ic" aria-hidden="true">' + t[1] + '</span>' + t[2] + '</button>').join('');
    document.getElementById('demoBar').hidden = !LB.D.demo;
    document.getElementById('demoBar').innerHTML = LB.D.demo ? '\ud83e\uddea <b>Demo mode</b> \u2013 sample data only. Your own data is untouched. <button type="button" class="btn sm" data-a="exitDemo">Exit demo</button>' : '';
    LB.hooks.forEach(h => h());
    window.scrollTo(0, top ? 0 : y);
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
    const fn = LB.actions[el.dataset.a]; if (!fn) return;
    e.preventDefault();
    Promise.resolve(fn(el, e)).then(r => { if (r !== false) LB.render(); });
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-s]'); if (!f) return; e.preventDefault();
    const fn = LB.submits[f.dataset.s]; if (fn) Promise.resolve(fn(f, e)).then(r => { if (r !== false) LB.render(); });
  });
  document.addEventListener('change', e => { const el = e.target.closest('[data-c]'); if (el && LB.changes[el.dataset.c]) Promise.resolve(LB.changes[el.dataset.c](el, e)).then(r => { if (r !== false && r !== 'none') LB.render(); }); });
  document.addEventListener('input', e => { const el = e.target.closest('[data-i]'); if (el && LB.inputs[el.dataset.i]) LB.inputs[el.dataset.i](el, e); });

  LB.actions.go = el => { LB.go(el.dataset.arg); return false; };
  LB.actions.exitDemo = () => { LB.exitDemo(); return false; };

  LB.start = () => { load(); LB.render(true); if (LB.loadNotice) LB.toast(LB.loadNotice); };
})();
