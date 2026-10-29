/* Settings: notifications, privacy, backup/import/clear, demo mode, about. */
(function () {
  const LB = window.LB, C = LB.C, V = LB.views, A = LB.actions, SB = LB.submits, esc = LB.esc, D = LB.D, K = LB.KEYS;

  A.openSettings = () => { LB.ui.view = 'settings'; LB.ui.focus = '#setH'; window.scrollTo(0, 0); };
  A.closeSettings = () => { LB.ui.view = null; };
  A.openAlerts = () => { LB.ui.view = 'settings'; LB.ui.focus = '#alertsCard'; };

  const permText = p => ({ granted: 'Allowed', denied: 'Blocked in your browser settings', default: 'Not asked yet', unsupported: 'Not supported in this browser' }[p] || p);
  const when = ms => ms ? new Date(ms).toLocaleString() : '';

  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (LB.ui.view === 'settings') LB.render(); });
  window.addEventListener('appinstalled', () => { installEvt = null; LB.toast('LifeBalance installed.'); });

  LB.platform = () => {
    const ua = navigator.userAgent || '', touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const os = /iPhone|iPad|iPod/.test(ua) || touchMac ? 'ios' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' : /Mac/.test(ua) ? 'mac' : /Linux|X11|CrOS/.test(ua) ? 'linux' : 'other';
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'your browser';
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    return { os, browser, standalone };
  };
  function installSteps(p) {
    if (p.standalone) return 'LifeBalance is running as an installed app.';
    if (p.os === 'ios') return 'In Safari, tap Share, then \u201cAdd to Home Screen\u201d. On iPhone and iPad, push reminders work only from the Home Screen app (iOS/iPadOS 16.4 or later). You can also keep using it in the browser.';
    if (p.os === 'android') return p.browser === 'Firefox' ? 'In Firefox, open the menu and choose \u201cInstall\u201d. You can also keep using the browser.' : 'In Chrome or Edge, open the menu and choose \u201cInstall app\u201d or \u201cAdd to Home screen\u201d.';
    if (p.browser === 'Safari') return 'In Safari on Mac, choose File \u2192 Add to Dock (macOS Sonoma or later). You can also keep using the browser.';
    if (p.browser === 'Firefox') return 'Desktop Firefox cannot install web apps. Keep using LifeBalance in a browser tab, or use Chrome or Edge to install it.';
    return 'Look for the install icon in the address bar, or open the browser menu and choose \u201cInstall LifeBalance\u201d. You can also keep using the browser.';
  }
  function installCard(sp, D) {
    const p = LB.platform(), yes = '\u2705', no = '\u26a0\ufe0f', recv = D.receive !== false;
    const feat = [['Works offline after first load', sp.sw && sp.secure], ['Browser notifications', sp.notif], ['Closed-app push (needs reminder server)', sp.push && sp.sw && sp.secure]];
    return `<section class="card" aria-labelledby="inH"><h2 id="inH">\ud83d\udcf2 Install &amp; this device</h2>
      <p class="small">${esc(installSteps(p))}</p>
      ${installEvt ? '<button type="button" class="btn" data-a="installApp">Install LifeBalance</button>' : ''}
      <ul class="small">${feat.map(f => `<li>${f[1] ? yes : no} ${esc(f[0])}: ${f[1] ? 'available' : 'not available here'}</li>`).join('')}</ul>
      ${!sp.secure ? '<p class="note">This page is not secure (HTTPS or localhost is required for install, offline use and push). Your data still works in the browser; use \u201cExport to calendar\u201d for appointments.</p>' : ''}
      <label class="check"><input type="checkbox" data-c="receive" ${recv ? 'checked' : ''}> This device receives reminders</label>
      <p class="muted small">Turn this off on devices where you do not want alerts. It only affects this device. If several devices alert you at once, each device shows one alert per reminder (repeat alerts for the same reminder replace each other).</p>
      <div class="row"><button type="button" class="btn alt" data-a="exportIcs">Export all upcoming events (.ics)</button></div>
      <p class="muted small">Opens in Google Calendar, Outlook or Apple Calendar. Recurring events are exported for the next 12 months, with your selected reminder alarms where your calendar app supports them. Exported events are copies: changes or cancellations later in LifeBalance do not update your external calendar (re-export and remove the old copy), and vice versa. The file contains your appointment details.</p></section>`;
  }
  A.installApp = async () => { if (!installEvt) return false; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { /* ignore */ } installEvt = null; LB.render(); return false; };
  LB.changes.receive = el => { LB.D.receive = el.checked; LB.saveD(); LB.rem.syncSoon(); LB.toast(el.checked ? 'This device will receive reminders.' : 'This device will not receive reminders.'); return 'none'; };
  LB.download = (name, type, text) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  A.exportIcs = () => {
    const t = LB.today(), occ = C.allOccurrences(LB.personal, t, C.addDays(t, 365)).filter(o => !o.cancelled);
    if (!occ.length) { LB.toast('No upcoming appointments to export.'); return false; }
    LB.download('lifebalance-events.ics', 'text/calendar', LBCal.build(C, occ, Date.now())); LB.toast(occ.length + ' event' + (occ.length === 1 ? '' : 's') + ' exported.'); return false;
  };
  A.calMenu = async el => {
    const o = C.allOccurrences(LB.S, C.addDays(LB.today(), -400), C.addDays(LB.today(), 800)).find(x => x.evId === el.dataset.id && x.key === el.dataset.key); if (!o) return false;
    const v = await LB.ask({ title: 'Add to calendar', body: '<p class="small muted">This shares the appointment details with the calendar you choose. It is a copy: later changes or cancellations in LifeBalance (or in that calendar) do not sync. Alarms are included in .ics files where your calendar app supports them; Google and Outlook web links do not carry alarms.</p>', buttons: [{ label: 'Download .ics with reminder alarms', value: 'ics' }, { label: 'Download .ics without alarms', value: 'ics0' }, { label: 'Google Calendar', value: 'g' }, { label: 'Outlook.com', value: 'o' }, { label: 'Cancel', value: null, cls: 'alt' }] });
    if (v === 'ics' || v === 'ics0') LB.download('appointment.ics', 'text/calendar', LBCal.build(C, [o], Date.now(), { alarms: v === 'ics' }));
    else if (v === 'g') window.open(LBCal.googleUrl(C, o), '_blank', 'noopener');
    else if (v === 'o') window.open(LBCal.outlookUrl(C, o), '_blank', 'noopener');
    return false;
  };

  V.settings = function () {
    const S = LB.personal, rem = LB.rem, sp = rem.supported(), perm = rem.perm(), P = D.push;
    let h = `<div class="row between"><h2 id="setH" tabindex="-1" style="margin:0">\u2699\ufe0f Settings</h2><button type="button" class="btn alt sm" data-a="closeSettings">\u2190 Back</button></div>`;
    if (LB.D.demo) h += '<div class="note" role="note">Demo mode is on. Settings below that change your data affect your own data, not the demo.</div>';

    h += `<section class="card" id="alertsCard" tabindex="-1" aria-labelledby="alH"><h2 id="alH">\ud83d\udd14 Alerts</h2>`;
    h += D.alerts.length ? D.alerts.map(a => `<div class="alert"><b>${esc(a.title)}</b><span>${esc(a.body)}</span><div class="row"><button type="button" class="btn sm" data-a="snooze" data-id="${esc(a.id)}" data-arg="10">Snooze 10 min</button><button type="button" class="btn danger sm" data-a="dismiss" data-id="${esc(a.id)}">Dismiss</button></div></div>`).join('') + '<button type="button" class="btn alt sm" data-a="dismissAll">Dismiss all</button>' : '<p class="muted">No active alerts.</p>';
    h += '</section>';

    const st = rem.statuses(), mark = o => o === true ? '\u2705' : o === false ? '\u26a0\ufe0f' : '\u2022';
    h += `<section class="card" aria-labelledby="ntH"><h2 id="ntH">\ud83d\udd14 Reminders</h2>
      <p class="small">Reminders always appear inside the app while it is open. \u201cEnable reminders\u201d also sets up alerts for when the app is closed, if a reminder service is connected.</p>
      <dl class="kv"><dt>Device support</dt><dd>${mark(st.device.ok)} ${esc(st.device.text)}</dd><dt>Permission</dt><dd>${mark(st.permission.ok)} ${esc(st.permission.text)}</dd><dt>Server connection</dt><dd>${mark(st.server.ok)} ${esc(st.server.text)}</dd><dt>Scheduling</dt><dd>${mark(st.scheduling.ok)} ${esc(st.scheduling.text)}</dd><dt>Delivery</dt><dd>${mark(st.delivery.ok)} ${esc(st.delivery.text)}</dd></dl>`;
    if (P.error) h += `<p class="err" role="alert">${esc(P.error)}</p>`;
    h += '<div class="row">' + (P.enabled ? '<button type="button" class="btn" data-a="testPush">Send test to this device</button><button type="button" class="btn alt" data-a="retryPush">Retry sync</button><button type="button" class="btn danger" data-a="disablePush">Turn off closed-app reminders</button>' : '<button type="button" class="btn" data-a="enableReminders">Enable reminders</button>') + '<button type="button" class="btn alt" data-a="testAlert">Test in-app alert</button></div>';
    if (perm === 'denied') h += '<p class="note">Notifications are blocked. Allow them for this site in your browser settings, then reload.</p>';
    h += `<p class="muted small">Limits: closed-app reminders need HTTPS, notification permission and a connected reminder service that is always on. \u201cVerified\u201d appears only after a real test message reaches this device. The service stores reminder times and short text (generic by default) against a random device token. Snooze from a notification works while the app is closed when the service is connected. iPhone and iPad need the app added to the Home Screen. Reminders more than 45 days ahead are sent when you next open the app.</p>
      <details><summary>Advanced: self-hosted server</summary><p class="small">The server address is set by whoever deploys the app (<code>config.js</code>). Use this only if you run your own server.</p>
      <label for="srv">Server address (blank = same site)</label><input type="url" id="srv" value="${esc(D.serverUrl)}" data-i="serverUrl" placeholder="https://your-server.example.com" inputmode="url"></details></section>`;
    h += LB.sync ? LB.sync.card() : '';

    h += installCard(sp, D);

    h += `<section class="card" aria-labelledby="pvH"><h2 id="pvH">\ud83d\udd12 Privacy</h2><form data-s="savePrivacy">
      <label class="check"><input type="checkbox" name="sd" ${S.settings.showDetails ? 'checked' : ''}> Show appointment, workout and meal details in notification previews</label>
      <p class="muted small">Off by default. When off, notifications only say \u201cYou have a reminder.\u201d so details are not shown on a lock screen. The in-app alert tray always shows details because you are looking at the app. Turning this on sends detailed text to your reminder server if you use one.</p>
      <fieldset><legend>Default reminders for new appointments</legend>${C.PRESET_OFFSETS.map(o => `<label class="check inline"><input type="checkbox" name="o${o.min}" ${S.settings.defaultOffsets.includes(o.min) ? 'checked' : ''}> ${esc(o.label)}</label>`).join(' ')}</fieldset>
      <p><button class="btn">Save</button></p></form>
      <p class="small"><b>Where is my data?</b> Everything (tasks, habits, journal, appointments, fitness and food) is stored in this browser on this device (localStorage). Nothing is uploaded unless you (a) sign in to sync, which stores an encrypted copy on the sync server, or (b) enable closed-app reminders, which sends reminder times and short text. Clearing browser data erases the local copy, so export a backup regularly.</p></section>`;

    const bi = LB.getBackup(K.BK_IMPORT), bc = LB.getBackup(K.BK_CLEAR);
    h += `<section class="card" aria-labelledby="dtH"><h2 id="dtH">\ud83d\udcbe Your data</h2>
      <div class="row"><button type="button" class="btn" data-a="exportData">Export backup (JSON)</button><button type="button" class="btn alt" data-a="pickImport">Import backup\u2026</button><input type="file" id="impFile" accept="application/json,.json" data-c="importFile" class="sr" tabindex="-1" aria-label="Choose backup file"></div>
      <p class="muted small">Backups contain private health and journal information. Keep the file somewhere safe. Importing replaces your current data after you confirm, and a copy of what you had is kept so you can restore it.</p>
      ${bi ? `<p class="small">Before your last import: backup from ${esc(when(bi.at))} <button type="button" class="btn alt sm" data-a="restoreBk" data-arg="import">Restore it</button></p>` : ''}
      ${bc ? `<p class="small">Before you last cleared data: backup from ${esc(when(bc.at))} <button type="button" class="btn alt sm" data-a="restoreBk" data-arg="clear">Restore it</button></p>` : ''}
      <div class="row"><button type="button" class="btn danger" data-a="clearAll">Clear all my data\u2026</button></div></section>`;

    h += `<section class="card" aria-labelledby="dmH"><h2 id="dmH">\ud83e\uddea Demo mode</h2><p class="small">Try the app with sample data. Demo data is kept separately and never changes or overwrites your own data.</p>
      <div class="row">${LB.D.demo ? '<button type="button" class="btn" data-a="exitDemo">Exit demo</button><button type="button" class="btn alt" data-a="resetDemo">Reset demo data</button>' : '<button type="button" class="btn" data-a="enterDemoA">Start demo mode</button>'}</div></section>`;

    h += `<section class="card" aria-labelledby="abH"><h2 id="abH">About</h2><p class="small">LifeBalance \u00b7 last updated ${C.APP_UPDATED}. LifeBalance gives general wellbeing information and is not medical advice. Steps, wearables and food photos are not supported; all fitness and food logging is manual.</p></section>`;
    return h;
  };

  SB.savePrivacy = f => {
    const S = LB.personal; S.settings.showDetails = f.sd.checked;
    S.settings.defaultOffsets = C.PRESET_OFFSETS.map(o => o.min).filter(m => f['o' + m].checked);
    try { localStorage.setItem(K.KEY, JSON.stringify(S)); } catch (e) { LB.toast('Could not save: browser storage is full or blocked.'); return false; }
    LB.rem.syncSoon(); LB.toast('Saved.');
  };
  A.enterDemoA = () => { LB.enterDemo(); return false; };
  A.resetDemo = async () => { if (await LB.confirm('Reset demo data?', '<p>Demo changes will be replaced by fresh sample data. Your own data is not affected.</p>', 'Reset')) LB.resetDemo(); return false; };

  A.exportData = () => {
    const blob = new Blob([C.exportData(LB.personal)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'lifebalance-backup-' + LB.today() + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    LB.toast('Backup downloaded. It contains private information, so keep it safe.'); return false;
  };
  A.pickImport = () => { document.getElementById('impFile').click(); return false; };

  LB.changes.importFile = async el => {
    const file = el.files[0]; el.value = ''; if (!file) return 'none';
    if (file.size > 8e6) { LB.toast('That file is too large (limit 8 MB).'); return 'none'; }
    const res = C.validateImport(await file.text(), LB.today());
    if (!res.ok) { LB.toast('Import failed: ' + res.error); return 'none'; }
    const s = res.summary;
    const ok = await LB.confirm('Replace your data with this backup?', `<p>This backup contains: ${s.tasks} tasks, ${s.habits} habits, ${s.journal} journal entries, ${s.events} appointments, ${s.workouts} workouts, ${s.meals} meal entries and ${s.recipes} recipes.</p>${res.dropped ? `<p>${res.dropped} invalid item${res.dropped === 1 ? ' was' : 's were'} skipped.</p>` : ''}<p><b>Your current data will be replaced.</b> A copy is kept so you can restore it.</p>`, 'Replace my data', true);
    if (!ok) return 'none';
    if (!LB.replacePersonal(res.state, K.BK_IMPORT)) { LB.toast('Import cancelled: a safety copy of your current data could not be saved (storage may be full).'); return 'none'; }
    LB.rem.prune(); LB.toast('Backup imported. Your previous data can be restored from Settings.'); return true;
  };
  A.restoreBk = async el => {
    const key = el.dataset.arg === 'clear' ? K.BK_CLEAR : K.BK_IMPORT;
    if (!(await LB.confirm('Restore this backup?', '<p>Your current data will be replaced by the backup.</p>', 'Restore', true))) return false;
    LB.stashBackup(key === K.BK_CLEAR ? K.BK_IMPORT : K.BK_CLEAR); // keep what we are replacing, using the other slot
    LB.restoreBackup(key); LB.rem.prune(); LB.toast('Backup restored.');
  };
  A.clearAll = async () => {
    const n = C.summarize(LB.personal);
    const ok = await LB.confirm('Clear all your data?', `<p>This will erase ${n.tasks} tasks, ${n.habits} habits, ${n.journal} journal entries, ${n.events} appointments, ${n.workouts} workouts and ${n.meals} meal entries from this browser.</p><p>Tip: export a backup first. A safety copy is also kept so you can undo.</p>`, 'Clear everything', true);
    if (!ok) return false;
    if (!LB.replacePersonal(C.freshState(LB.today()), K.BK_CLEAR)) { LB.toast('Not cleared: a safety copy could not be saved. Export a backup first.'); return false; }
    LB.rem.prune(); LB.toast('All data cleared.', () => { LB.restoreBackup(K.BK_CLEAR); LB.rem.prune(); });
  };
})();
