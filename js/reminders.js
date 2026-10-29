/* Reminders: in-app checker, alerts tray, browser notifications, Web Push registration and schedule sync.
   Closed-app delivery is done by the server + service worker, never by browser timers. */
(function () {
  const LB = window.LB, C = LB.C, A = LB.actions, esc = LB.esc, D = LB.D;
  const R = LB.rem = {};
  const HORIZON_DAYS = 45, MAX_ITEMS = 300;
  let swReg = null, syncTimer = null, retryTimer = null, retryMs = 60000;

  R.supported = () => ({ secure: window.isSecureContext, notif: 'Notification' in window, sw: 'serviceWorker' in navigator, push: 'PushManager' in window, proto: location.protocol });
  R.perm = () => ('Notification' in window ? Notification.permission : 'unsupported');
  R.nativeOn = () => R.perm() === 'granted' && D.notifEnabled;
  R.swReady = () => !!swReg;

  R.init = async () => {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      try { swReg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); } catch (e) { swReg = null; R.swError = String(e.message || e); }
    }
    R.prune(); R.check(); renderAlerts();
    setInterval(R.check, 15000);
    setInterval(() => { if (D.push.enabled) R.sync(); }, 30 * 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { R.check(); if (D.push.enabled) R.syncSoon(); } });
    if (D.push.enabled) R.syncSoon();
  };

  /* ---------- in-app checking ---------- */
  function notify(title, body, tag) {
    if (!R.nativeOn()) return;
    const opts = { body, tag, icon: 'logo.png', badge: 'logo.png', data: { url: './' } };
    try { if (swReg && swReg.showNotification) swReg.showNotification(title, opts); else new Notification(title, opts); } catch (e) { /* ignore */ }
  }
  function addAlert(a, generic) {
    D.alerts = D.alerts.filter(x => x.id !== a.id); D.alerts.unshift(a); D.alerts = D.alerts.slice(0, 30); LB.saveD(); renderAlerts();
    notify(generic.title, generic.body, a.id);
  }
  R.check = () => {
    const now = Date.now();
    if (!LB.D.demo && D.receive !== false) {
      const lookback = D.push.status === 'ok' ? 2 * 60000 : 6 * 3600000, from = Math.max(D.lastCheck || 0, now - lookback);
      C.remindersBetween(LB.personal, from, now, LB.tz).forEach(r => {
        if (D.fired[r.key]) return; D.fired[r.key] = now;
        const t = C.fullReminderText(r, LB.tz);
        addAlert({ id: r.key, kind: r.kind, evId: r.occ ? r.occ.evId : '', occKey: r.occ ? r.occ.key : '', title: t.title, body: t.body, at: r.at, late: now - r.at > 120000 }, C.reminderText(r, LB.personal.settings.showDetails, LB.tz));
      });
      Object.keys(D.fired).forEach(k => { if (D.fired[k] < now - 14 * 864e5) delete D.fired[k]; });
    }
    Object.keys(D.snoozes).forEach(k => {
      const s = D.snoozes[k]; if (s.until > now) return; delete D.snoozes[k];
      addAlert(Object.assign({}, s.alert, { id: k, title: 'Snoozed: ' + s.alert.title, late: false }), { title: 'LifeBalance', body: 'You have a reminder.' });
    });
    D.lastCheck = now; LB.saveD();
  };
  // Drops alerts and snoozes whose appointment was cancelled or deleted.
  R.prune = () => {
    const ok = a => { if (!a.evId) return true; const e = LB.personal.events.find(x => x.id === a.evId); return !!e && !e.cancelled && !(e.exceptions[a.occKey] || {}).cancelled; };
    D.alerts = D.alerts.filter(ok);
    Object.keys(D.snoozes).forEach(k => { if (!ok(D.snoozes[k].alert)) delete D.snoozes[k]; });
    LB.saveD(); renderAlerts();
  };

  /* ---------- alerts tray ---------- */
  function renderAlerts() {
    const el = document.getElementById('alerts'); if (!el) return;
    const list = D.alerts.slice(0, 3);
    el.innerHTML = list.map(a => `<div class="alert" role="alert"><b>🔔 ${esc(a.title)}</b><span>${esc(a.body)}${a.late ? ' (earlier)' : ''}</span><div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-a="snooze" data-id="${esc(a.id)}" data-arg="10">Snooze 10 min</button><button type="button" class="btn alt sm" data-a="snooze" data-id="${esc(a.id)}" data-arg="60">1 hour</button><button type="button" class="btn danger sm" data-a="dismiss" data-id="${esc(a.id)}">Dismiss</button></div></div>`).join('') +
      (D.alerts.length > 3 ? `<div class="alert"><span>${D.alerts.length - 3} more alert${D.alerts.length - 3 > 1 ? 's' : ''}</span> <button type="button" class="btn alt sm" data-a="dismissAll">Dismiss all</button></div>` : '');
    const b = document.getElementById('bellCount'); if (b) { b.textContent = D.alerts.length; b.hidden = !D.alerts.length; }
  }
  A.dismiss = el => { D.alerts = D.alerts.filter(a => a.id !== el.dataset.id); LB.saveD(); renderAlerts(); return false; };
  A.dismissAll = () => { D.alerts = []; LB.saveD(); renderAlerts(); return false; };
  A.snooze = el => {
    const a = D.alerts.find(x => x.id === el.dataset.id); if (!a) return false;
    const mins = +el.dataset.arg; D.alerts = D.alerts.filter(x => x !== a);
    D.snoozes[a.id + '|s' + Date.now()] = { until: Date.now() + mins * 60000, alert: a }; LB.saveD(); renderAlerts();
    LB.toast('Snoozed for ' + (mins === 60 ? '1 hour' : mins + ' minutes') + '. Snooze works while the app is open.'); return false;
  };

  /* ---------- notification permission ---------- */
  R.enableNotifications = async () => {
    if (!('Notification' in window)) { LB.toast('This browser does not support notifications. In-app alerts still work.'); return; }
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    D.notifEnabled = p === 'granted'; LB.saveD();
    LB.toast(p === 'granted' ? 'Browser notifications enabled.' : p === 'denied' ? 'Notifications are blocked. Allow them in your browser’s site settings, then try again.' : 'Permission was not given.');
  };
  A.enableNotif = async () => { await R.enableNotifications(); };
  A.disableNotif = () => { D.notifEnabled = false; LB.saveD(); LB.toast('Browser notifications turned off. In-app alerts remain.'); };
  A.testAlert = async () => {
    const now = Date.now(), id = 'test|' + now;
    addAlert({ id, kind: 'test', evId: '', occKey: '', title: 'Test alert', body: 'This is a test alert from LifeBalance.', at: now }, { title: 'LifeBalance', body: 'This is a test alert.' });
    let msg = 'Test alert shown in the app' + (R.nativeOn() ? ' and as a browser notification.' : '. Browser notifications are off or blocked.');
    if (D.push.enabled && D.device) { try { const r = await api('/api/test', { method: 'POST' }); msg += r.ok ? ' A test push was sent by the server.' : ' The server test push failed (' + r.status + ').'; } catch (e) { msg += ' The server could not be reached for a test push.'; } }
    LB.toast(msg);
    return false;
  };

  /* ---------- server / Web Push ---------- */
  const base = () => (D.serverUrl || '').replace(/\/+$/, '');
  async function api(path, opts) {
    opts = opts || {}; const h = { 'Content-Type': 'application/json' };
    if (D.device) { h.Authorization = 'Bearer ' + D.device.token; h['X-Device-Id'] = D.device.id; }
    return fetch(base() + path, Object.assign({}, opts, { headers: h }));
  }
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  const setPush = (status, error, count) => { D.push = Object.assign({}, D.push, { status, error: error || '', count: count || 0, at: Date.now() }); LB.saveD(); if (LB.ui.view === 'settings') LB.render(); };

  R.enablePush = async () => {
    const sp = R.supported();
    if (!sp.secure || !sp.sw || !sp.push) return setPush('failed', 'This browser or page cannot use Web Push (needs HTTPS or localhost, a service worker and PushManager).');
    if (!swReg) return setPush('failed', 'The service worker is not registered' + (R.swError ? ': ' + R.swError : '. Open the app from http(s), not a file.'));
    if (LB.D.demo) return setPush('failed', 'Exit demo mode first. Push reminders are only for your own data.');
    if (Notification.permission === 'default') await R.enableNotifications();
    if (Notification.permission !== 'granted') return setPush('failed', 'Notification permission is not granted.');
    D.notifEnabled = true; setPush('syncing', '');
    try {
      let r = await fetch(base() + '/api/config'); if (!r.ok) throw new Error('config ' + r.status);
      const cfg = await r.json(); if (!cfg.publicKey) throw new Error('The server has no push keys configured.');
      if (!D.device || D.device.base !== base()) {
        r = await fetch(base() + '/api/register', { method: 'POST' }); if (!r.ok) throw new Error('register ' + r.status);
        const d = await r.json(); D.device = { id: d.deviceId, token: d.token, base: base() }; LB.saveD();
      }
      const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.publicKey) });
      r = await api('/api/subscription', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!r.ok) throw new Error('subscription ' + r.status);
      D.push.enabled = true; LB.saveD(); await R.sync();
    } catch (e) { D.push.enabled = false; setPush('failed', 'Could not set up push: ' + (e.message || e) + (D.serverUrl ? '' : ' (no reminder server address is set; same-origin was tried)')); }
  };
  R.disablePush = async () => {
    try { if (D.device) await api('/api/device', { method: 'DELETE' }); } catch (e) { /* best effort */ }
    try { if (swReg) { const s = await swReg.pushManager.getSubscription(); if (s) await s.unsubscribe(); } } catch (e) { /* ignore */ }
    D.device = null; D.push = { enabled: false, status: 'none', error: '', count: 0, at: 0 }; LB.saveD(); LB.toast('Closed-app delivery turned off and this device was removed from the server.');
  };
  R.syncSoon = () => { R.prune(); clearTimeout(syncTimer); if (D.push.enabled && !LB.D.demo) syncTimer = setTimeout(R.sync, 1500); };
  R.buildSchedule = () => {
    const now = Date.now(), S = LB.personal; if (D.receive === false) return [];
    return C.remindersBetween(S, now, now + HORIZON_DAYS * 864e5, LB.tz).slice(0, MAX_ITEMS).map(r => { const t = C.reminderText(r, S.settings.showDetails, LB.tz); return { key: r.key, at: r.at, title: t.title, body: t.body }; });
  };
  R.sync = async () => {
    if (!D.push.enabled || !D.device || LB.D.demo) return;
    clearTimeout(retryTimer); const items = R.buildSchedule();
    try {
      const r = await api('/api/schedule', { method: 'PUT', body: JSON.stringify({ items }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error || 'server replied ' + r.status), { status: r.status }); }
      const j = await r.json(); if (typeof j.scheduled !== 'number') throw new Error('unexpected server reply');
      retryMs = 60000; setPush('ok', '', j.scheduled);
    } catch (e) {
      if (e.status === 401 || e.status === 403) { D.push.enabled = false; setPush('failed', 'The server no longer recognises this device. Turn closed-app delivery off and on again.'); return; }
      setPush('failed', 'Scheduling failed: ' + (e.message || e) + '. Retrying automatically.'); retryTimer = setTimeout(R.sync, retryMs); retryMs = Math.min(retryMs * 2, 900000);
    }
  };
  A.enablePush = () => { R.enablePush(); return false; };
  A.disablePush = async () => { await R.disablePush(); };
  A.retryPush = () => { R.sync(); return false; };
  LB.inputs.serverUrl = el => { D.serverUrl = el.value.trim(); LB.saveD(); };

  R.deliveryNote = () => {
    if (D.push.status === 'ok') return `Closed-app delivery: ${D.push.count} upcoming reminder${D.push.count === 1 ? '' : 's'} confirmed by your reminder server.`;
    if (D.push.status === 'failed') return 'Closed-app delivery is not working (' + D.push.error + '). Alerts still appear while the app is open.';
    return 'Alerts appear while LifeBalance is open. Closed-app reminders need the optional reminder server (see Settings).';
  };
})();
