/* Settings: notifications, privacy, backup/import/clear, demo mode, about. */
(function () {
  const LB = window.LB, C = LB.C, V = LB.views, A = LB.actions, SB = LB.submits, esc = LB.esc, D = LB.D, K = LB.KEYS;

  A.openSettings = () => { LB.ui.view = 'settings'; LB.ui.focus = '#setH'; window.scrollTo(0, 0); };
  A.closeSettings = () => { LB.ui.view = null; };
  A.openAlerts = () => { LB.ui.view = 'settings'; LB.ui.focus = '#alertsCard'; };

  const permText = p => ({ granted: 'Allowed', denied: 'Blocked in your browser settings', default: 'Not asked yet', unsupported: 'Not supported in this browser' }[p] || p);
  const when = ms => ms ? new Date(ms).toLocaleString() : '';

  V.settings = function () {
    const S = LB.personal, rem = LB.rem, sp = rem.supported(), perm = rem.perm(), P = D.push;
    let h = `<div class="row between"><h2 id="setH" tabindex="-1" style="margin:0">⚙️ Settings</h2><button type="button" class="btn alt sm" data-a="closeSettings">← Back</button></div>`;
    if (LB.D.demo) h += '<div class="note" role="note">Demo mode is on. Settings below that change your data affect your own data, not the demo.</div>';

    h += `<section class="card" id="alertsCard" tabindex="-1" aria-labelledby="alH"><h2 id="alH">🔔 Alerts</h2>`;
    h += D.alerts.length ? D.alerts.map(a => `<div class="alert"><b>${esc(a.title)}</b><span>${esc(a.body)}</span><div class="row"><button type="button" class="btn sm" data-a="snooze" data-id="${esc(a.id)}" data-arg="10">Snooze 10 min</button><button type="button" class="btn danger sm" data-a="dismiss" data-id="${esc(a.id)}">Dismiss</button></div></div>`).join('') + '<button type="button" class="btn alt sm" data-a="dismissAll">Dismiss all</button>' : '<p class="muted">No active alerts.</p>';
    h += '</section>';

    h += `<section class="card" aria-labelledby="ntH"><h2 id="ntH">Notifications</h2>
      <dl class="kv"><dt>Browser permission</dt><dd>${permText(perm)}</dd><dt>Browser notifications</dt><dd>${rem.nativeOn() ? 'On' : 'Off'}</dd><dt>Service worker</dt><dd>${rem.swReady() ? 'Registered' : 'Not registered' + (sp.proto === 'file:' ? ' (open the app over http/https, not as a file)' : '')}</dd>
      <dt>Closed-app delivery</dt><dd>${P.status === 'ok' ? '✅ Confirmed by server (' + P.count + ' reminders, ' + esc(when(P.at)) + ')' : P.status === 'syncing' ? '⏳ Setting up…' : P.status === 'failed' ? '❌ Not working' : 'Off'}</dd></dl>`;
    if (P.error) h += `<p class="err" role="alert">${esc(P.error)}</p>`;
    h += '<div class="row">' + (rem.nativeOn() ? '<button type="button" class="btn alt" data-a="disableNotif">Turn off browser notifications</button>' : perm === 'denied' || perm === 'unsupported' ? '' : '<button type="button" class="btn" data-a="enableNotif">Enable browser notifications</button>') + '<button type="button" class="btn alt" data-a="testAlert">Send test alert</button></div>';
    if (perm === 'denied') h += '<p class="note">Notifications are blocked. Allow them for this site in your browser settings, then reload.</p>';
    h += `<details><summary>Closed-app reminders (optional server)</summary>
      <p class="small">When LifeBalance is closed, a browser cannot run your reminders itself. This needs a small reminder server (included in the <code>server</code> folder; see the README) that sends Web Push messages through your browser's push service. A reminder is only described as scheduled after the server confirms it.</p>
      <label for="srv">Reminder server address (leave blank if the server hosts this app)</label><input type="url" id="srv" value="${esc(D.serverUrl)}" data-i="serverUrl" placeholder="https://your-server.example.com" inputmode="url">
      <div class="row">${P.enabled ? '<button type="button" class="btn alt" data-a="retryPush">Retry sync</button><button type="button" class="btn danger" data-a="disablePush">Turn off closed-app delivery</button>' : '<button type="button" class="btn" data-a="enablePush">Turn on closed-app delivery</button>'}</div>
      <p class="muted small">Limitations: needs HTTPS (or localhost), a notification permission and an always-on server. The server stores only reminder times and short text (generic by default) tied to a random device token. Snoozing works only while the app is open. iPhone and iPad need the app added to the Home Screen. Reminders more than 45 days ahead are sent to the server when you next open the app.</p></details></section>`;

    h += `<section class="card" aria-labelledby="pvH"><h2 id="pvH">🔒 Privacy</h2><form data-s="savePrivacy">
      <label class="check"><input type="checkbox" name="sd" ${S.settings.showDetails ? 'checked' : ''}> Show appointment, workout and meal details in notification previews</label>
      <p class="muted small">Off by default. When off, notifications only say “You have a reminder.” so details are not shown on a lock screen. The in-app alert tray always shows details because you are looking at the app. Turning this on sends detailed text to your reminder server if you use one.</p>
      <fieldset><legend>Default reminders for new appointments</legend>${C.PRESET_OFFSETS.map(o => `<label class="check inline"><input type="checkbox" name="o${o.min}" ${S.settings.defaultOffsets.includes(o.min) ? 'checked' : ''}> ${esc(o.label)}</label>`).join(' ')}</fieldset>
      <p><button class="btn">Save</button></p></form>
      <p class="small"><b>Where is my data?</b> Everything (tasks, habits, journal, appointments, fitness and food) is stored only in this browser on this device (localStorage). There are no accounts and nothing is uploaded, except reminder times and short text if you turn on closed-app delivery. Clearing browser data erases it, so export a backup regularly.</p></section>`;

    const bi = LB.getBackup(K.BK_IMPORT), bc = LB.getBackup(K.BK_CLEAR);
    h += `<section class="card" aria-labelledby="dtH"><h2 id="dtH">💾 Your data</h2>
      <div class="row"><button type="button" class="btn" data-a="exportData">Export backup (JSON)</button><button type="button" class="btn alt" data-a="pickImport">Import backup…</button><input type="file" id="impFile" accept="application/json,.json" data-c="importFile" class="sr" tabindex="-1" aria-label="Choose backup file"></div>
      <p class="muted small">Backups contain private health and journal information. Keep the file somewhere safe. Importing replaces your current data after you confirm, and a copy of what you had is kept so you can restore it.</p>
      ${bi ? `<p class="small">Before your last import: backup from ${esc(when(bi.at))} <button type="button" class="btn alt sm" data-a="restoreBk" data-arg="import">Restore it</button></p>` : ''}
      ${bc ? `<p class="small">Before you last cleared data: backup from ${esc(when(bc.at))} <button type="button" class="btn alt sm" data-a="restoreBk" data-arg="clear">Restore it</button></p>` : ''}
      <div class="row"><button type="button" class="btn danger" data-a="clearAll">Clear all my data…</button></div></section>`;

    h += `<section class="card" aria-labelledby="dmH"><h2 id="dmH">🧪 Demo mode</h2><p class="small">Try the app with sample data. Demo data is kept separately and never changes or overwrites your own data.</p>
      <div class="row">${LB.D.demo ? '<button type="button" class="btn" data-a="exitDemo">Exit demo</button><button type="button" class="btn alt" data-a="resetDemo">Reset demo data</button>' : '<button type="button" class="btn" data-a="enterDemoA">Start demo mode</button>'}</div></section>`;

    h += `<section class="card" aria-labelledby="abH"><h2 id="abH">About</h2><p class="small">LifeBalance · last updated ${C.APP_UPDATED}. LifeBalance gives general wellbeing information and is not medical advice. Steps, wearables and food photos are not supported; all fitness and food logging is manual.</p></section>`;
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
