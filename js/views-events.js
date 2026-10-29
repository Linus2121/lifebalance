/* Events: list, calendar, search/filter, event form with recurrence, travel and reminders. */
(function () {
  const LB = window.LB, C = LB.C, V = LB.views, A = LB.actions, SB = LB.submits, esc = LB.esc;
  const ui = LB.ui; ui.evView = 'upcoming'; ui.q = ''; ui.cat = '';
  const ev = id => LB.S.events.find(e => e.id === id);
  const icon = c => C.CAT_ICONS[c] || '\ud83d\udccc';

  function occWhen(o) {
    const multi = o.endDate !== o.date, f = LB.fmtDate;
    if (o.category === 'Travel' && multi) return `Departs ${f(o.date)}${o.allDay ? '' : ' ' + o.startTime} (${o.tz}) \u2192 Returns ${f(o.endDate)}${o.endTime ? ' ' + o.endTime : ''} (${o.endTz})`;
    let s = f(o.date) + (multi ? ' \u2013 ' + f(o.endDate) : '') + (o.allDay ? ' \u00b7 All day' : ' \u00b7 ' + o.startTime + (o.endTime && !multi ? '\u2013' + o.endTime : ''));
    if (!o.allDay && o.tz !== LB.tz) {
      s += ` (${o.tz})`;
      try { s += ' \u00b7 your time ' + new Date(C.startInstant(o)).toLocaleTimeString(undefined, { timeZone: LB.tz, hour: '2-digit', minute: '2-digit' }); } catch (e) { /* ignore */ }
    }
    return s;
  }
  LB.occRow = (o, opt) => {
    opt = opt || {};
    const a = `data-id="${o.evId}" data-key="${o.key}"`, t = esc(o.title);
    return `<div class="ev ${o.cancelled ? 'cancelled' : ''}"><div class="ico" role="img" aria-label="${esc(o.category)}">${icon(o.category)}</div><div class="body">
      <div class="ttl2"><b>${t}</b> ${o.cancelled ? '<span class="badge warn">Cancelled</span>' : ''}${o.recurring ? '<span class="badge">\ud83d\udd01 Repeats</span>' : ''}${o.modified ? '<span class="badge">Changed</span>' : ''}${o.hasReminders ? '<span class="badge" title="Reminders set">\ud83d\udd14</span>' : ''}</div>
      <div class="small">${esc(o.category)} \u00b7 ${esc(occWhen(o))}</div>${o.location ? `<div class="small">\ud83d\udccd ${esc(o.location)}</div>` : ''}${o.bookingRef ? `<div class="small">\ud83c\udfab Booking ref: ${esc(o.bookingRef)}</div>` : ''}
      ${!opt.compact && o.notes ? `<div class="small muted">${esc(o.notes)}</div>` : ''}
      ${!opt.compact && o.contact && (o.contact.name || o.contact.phone || o.contact.email) ? `<div class="small">\ud83d\udc64 ${esc([o.contact.name, o.contact.phone, o.contact.email].filter(Boolean).join(' \u00b7 '))}</div>` : ''}
      <div class="row" style="margin-top:6px"><button type="button" class="btn alt sm" data-a="editOcc" ${a} aria-label="Edit ${t}">Edit</button>
      ${opt.compact ? '' : `<button type="button" class="btn alt sm" data-a="calMenu" ${a} aria-label="Add ${t} to calendar">\ud83d\udcc6 Calendar</button><button type="button" class="btn alt sm" data-a="cancelOcc" ${a} aria-label="${o.cancelled ? 'Restore' : 'Cancel'} ${t}">${o.cancelled ? 'Restore' : 'Cancel'}</button><button type="button" class="btn danger sm" data-a="delEvent" ${a} aria-label="Delete ${t}">Delete</button>`}</div></div></div>`;
  };

  /* ---------- list / calendar ---------- */
  const match = o => (!ui.cat || o.category === ui.cat) && (!ui.q || [o.title, o.location, o.notes, o.category, o.bookingRef].join(' ').toLowerCase().includes(ui.q.toLowerCase()));
  function listHtml() {
    const t = LB.today(), S = LB.S;
    if (ui.evView === 'cal') return calHtml();
    const past = ui.evView === 'past';
    let occ = past ? C.allOccurrences(S, C.addDays(t, -90), C.addDays(t, -1)).reverse() : C.allOccurrences(S, t, C.addDays(t, 365));
    occ = occ.filter(match).slice(0, 150);
    if (!S.events.length) return LB.empty('\ud83d\udcc5', 'No appointments yet', 'Add a GP visit, school event, wedding or trip and set reminders.', '<button type="button" class="btn" data-a="newEvent">Add appointment</button>');
    if (!occ.length) return LB.empty('\ud83d\udd0d', past ? 'No past events found' : 'No upcoming events found', ui.q || ui.cat ? 'Try a different search or category.' : 'Nothing in the next year. Add an appointment to get started.');
    let h = '', last = '';
    occ.forEach(o => { if (o.date !== last) { last = o.date; h += `<div class="dayhead">${LB.fmtDate(o.date, true)}</div>`; } h += LB.occRow(o); });
    return h;
  }
  function calHtml() {
    const t = LB.today(), m = ui.calMonth || t.slice(0, 8) + '01', first = C.weekStart(m), mEnd = C.addMonths(m, 1, 1), gridEnd = C.addDays(C.weekStart(C.addDays(mEnd, -1)), 6);
    const occ = C.allOccurrences(LB.S, first, gridEnd).filter(match), sel = ui.calSel || t;
    const on = d => occ.filter(o => o.date <= d && o.endDate >= d);
    let h = `<div class="row sp"><button type="button" class="btn alt" data-a="calMove" data-arg="-1" aria-label="Previous month">\u25c0</button><b aria-live="polite">${C.parseDate(m).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'long', year: 'numeric' })}</b><button type="button" class="btn alt" data-a="calMove" data-arg="1" aria-label="Next month">\u25b6</button></div><div class="cal" role="group" aria-label="Calendar" style="margin-top:8px">`;
    ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach(d => { h += `<div class="dh" aria-hidden="true">${d}</div>`; });
    for (let d = first; d <= gridEnd; d = C.addDays(d, 1)) {
      const a = on(d), ic = [...new Set(a.map(o => icon(o.category)))].slice(0, 3).join('');
      h += `<button type="button" data-a="calSel" data-arg="${d}" aria-pressed="${d === sel}" class="${d.slice(0, 7) !== m.slice(0, 7) ? 'out' : ''} ${d === t ? 'today' : ''}" aria-label="${LB.fmtDate(d, true)}, ${a.length} event${a.length === 1 ? '' : 's'}"><span>${+d.slice(8)}</span><span class="ic" aria-hidden="true">${ic}</span></button>`;
    }
    h += `</div><div class="dayhead">${LB.fmtDate(sel, true)}</div>`;
    const sd = on(sel); h += sd.length ? sd.map(o => LB.occRow(o)).join('') : '<p class="muted">No events on this day.</p>';
    return h;
  }
  A.calMove = el => { const m = ui.calMonth || LB.today().slice(0, 8) + '01'; ui.calMonth = C.addMonths(m, +el.dataset.arg, 1); };
  A.calSel = el => { ui.calSel = el.dataset.arg; };
  A.evView = el => { ui.evView = el.dataset.arg; };
  A.evCat = el => { ui.cat = ui.cat === el.dataset.arg ? '' : el.dataset.arg; };
  LB.inputs.evSearch = el => { ui.q = el.value; const r = document.getElementById('evResults'); if (r) r.innerHTML = listHtml(); };
  V.events = function () {
    return `<h2>Events &amp; appointments</h2><button type="button" class="btn big" data-a="newEvent" style="margin-bottom:14px">\u2795 Add appointment</button>
      <section class="card"><div class="seg" role="group" aria-label="View">${[['upcoming', 'Upcoming'], ['past', 'Past'], ['cal', 'Calendar']].map(v => `<button type="button" data-a="evView" data-arg="${v[0]}" aria-pressed="${ui.evView === v[0]}">${v[1]}</button>`).join('')}</div>
      <div class="field"><label for="evq">Search events</label><input type="search" id="evq" value="${esc(ui.q)}" data-i="evSearch" placeholder="Title, place or notes" autocomplete="off"></div>
      <div class="seg" role="group" aria-label="Filter by category">${C.CATS.map(c => `<button type="button" data-a="evCat" data-arg="${c}" aria-pressed="${ui.cat === c}">${icon(c)} ${c}</button>`).join('')}</div>
      <div id="evResults">${listHtml()}</div></section>`;
  };

  /* ---------- scope dialogs and row actions ---------- */
  const scopeAsk = (title, verb) => LB.ask({ title, body: `<p>This appointment repeats. What would you like to ${verb}?</p>`, buttons: [{ label: 'This occurrence only', value: 'one' }, { label: 'Whole series', value: 'all' }, { label: 'Back', value: null, cls: 'alt' }] });
  A.editOcc = async el => {
    const e = ev(el.dataset.id); if (!e) return;
    let scope = 'all';
    if (e.recurrence.freq !== 'none') { scope = await scopeAsk('Edit recurring appointment', 'edit'); if (!scope) return false; }
    openForm(e, scope, el.dataset.key);
  };
  A.cancelOcc = async el => {
    const e = ev(el.dataset.id), key = el.dataset.key; if (!e) return;
    const ex = e.exceptions[key] || {}, rec = e.recurrence.freq !== 'none';
    if (e.cancelled || ex.cancelled) {
      let scope = 'one';
      if (rec && e.cancelled) { scope = await scopeAsk('Restore appointment', 'restore'); if (!scope) return false; }
      if (scope === 'all' || (!rec && e.cancelled)) e.cancelled = false; else { delete ex.cancelled; if (Object.keys(ex).length) e.exceptions[key] = ex; else delete e.exceptions[key]; }
      LB.save(); LB.toast('Appointment restored. Reminders are active again.'); return;
    }
    let scope = 'all';
    if (rec) { scope = await scopeAsk('Cancel recurring appointment', 'cancel'); if (!scope) return false; }
    else { const ok = await LB.ask({ title: 'Cancel \u201c' + e.title + '\u201d?', body: '<p>It stays in your list marked as cancelled and its reminders stop. You can restore it later.</p>', buttons: [{ label: 'Keep it', value: false, cls: 'alt' }, { label: 'Cancel appointment', value: true, cls: 'danger' }] }); if (!ok) return false; }
    if (scope === 'one') e.exceptions[key] = Object.assign(ex, { cancelled: true }); else e.cancelled = true;
    LB.save(); LB.toast(scope === 'one' ? 'That occurrence was cancelled. The rest of the series is unchanged.' : 'Appointment cancelled. Its reminders were removed.', () => { if (scope === 'one') { delete e.exceptions[key].cancelled; if (!Object.keys(e.exceptions[key]).length) delete e.exceptions[key]; } else e.cancelled = false; LB.save(); });
  };
  A.delEvent = async el => {
    const e = ev(el.dataset.id); if (!e) return;
    const rec = e.recurrence.freq !== 'none';
    const ok = await LB.ask({ title: 'Delete \u201c' + e.title + '\u201d?', body: rec ? '<p>This deletes the <b>whole series</b>. To skip just one date, choose Cancel on that occurrence instead.</p>' : '<p>This removes the appointment and its reminders.</p>', buttons: [{ label: 'Keep it', value: false, cls: 'alt' }, { label: rec ? 'Delete series' : 'Delete', value: true, cls: 'danger' }] });
    if (!ok) return false;
    LB.remove(() => LB.S.events, e.id, 'Appointment');
  };

  /* ---------- form model ---------- */
  function blank() {
    const t = ui.cat ? '' : '', d = ui.calSel || LB.today();
    return { mode: 'new', scope: 'all', id: '', origKey: '', title: '', category: ui.cat || 'General', allDay: false, date: d < LB.today() ? LB.today() : d, startTime: '09:00', endTime: '10:00', endDate: '', tz: LB.tz, endTz: LB.tz, location: '', notes: '', bookingRef: '', cName: '', cPhone: '', cEmail: '', freq: 'none', interval: 1, until: '', offsets: LB.S.settings.defaultOffsets.slice(), custom: t };
  }
  function openForm(e, scope, key) {
    if (!e) { ui.form = blank(); } else {
      const occ = scope === 'one' ? C.occurrences(e, key, key).find(o => o.key === key) || null : null, s = occ || e;
      ui.form = { mode: 'edit', scope, id: e.id, origKey: key || e.date, title: s.title, category: e.category, allDay: e.allDay, date: s.date, startTime: s.startTime || '09:00', endTime: s.endTime || '', endDate: e.endDate, tz: e.tz, endTz: e.endTz, location: s.location, notes: s.notes, bookingRef: e.bookingRef,
        cName: e.contact.name, cPhone: e.contact.phone, cEmail: e.contact.email, freq: e.recurrence.freq, interval: e.recurrence.interval, until: e.recurrence.until, offsets: e.reminders.offsets.slice(), count: e.recurrence.count };
    }
    ui.formErr = []; ui.view = 'eventForm'; window.scrollTo(0, 0); ui.focus = '#f-title';
  }
  A.newEvent = () => { openForm(null); };
  A.closeForm = () => { ui.view = null; ui.form = null; };
  function collect(f) {
    const F = Object.assign({}, ui.form), g = n => f.elements[n], v = n => (g(n) ? g(n).value : F[n]);
    ['title', 'category', 'date', 'startTime', 'endTime', 'endDate', 'tz', 'endTz', 'location', 'notes', 'bookingRef', 'freq', 'until'].forEach(n => { F[n] = (v(n) == null ? '' : String(v(n))).trim(); });
    F.cName = v('cName') || ''; F.cPhone = v('cPhone') || ''; F.cEmail = v('cEmail') || ''; F.interval = Math.max(1, parseInt(v('interval'), 10) || 1);
    if (g('allDay')) F.allDay = g('allDay').checked;
    F.offsets = [...f.querySelectorAll('input[name=off]:checked')].map(i => +i.value);
    if (F.scope === 'all' && F.category !== 'Travel') F.endTz = F.tz;
    return F;
  }
  function toRaw(F, old) {
    const trav = F.category === 'Travel';
    return { id: F.id || 'tmp', title: F.title, category: F.category, allDay: F.allDay, date: F.date, startTime: F.startTime, endTime: F.endTime, endDate: F.endDate, tz: F.tz, endTz: trav ? F.endTz || F.tz : F.tz, location: F.location, notes: F.notes, bookingRef: trav ? F.bookingRef : '',
      contact: { name: F.cName, phone: F.cPhone, email: F.cEmail }, recurrence: { freq: F.freq, interval: F.interval, until: F.until, count: F.count || 0 }, reminders: { offsets: F.offsets }, exceptions: old ? old.exceptions : {}, cancelled: old ? old.cancelled : false };
  }
  function validate(F) {
    const e = [];
    if (!F.title) e.push('Enter a title.');
    if (!C.isDate(F.date)) e.push('Choose a valid date.');
    if (!C.isTz(F.tz)) e.push('The time zone \u201c' + F.tz + '\u201d is not recognised. Pick one from the list, e.g. Europe/London.');
    if (F.category === 'Travel' && F.endTz && !C.isTz(F.endTz)) e.push('The return time zone is not recognised.');
    if (!F.allDay && !C.isTime(F.startTime)) e.push('Choose a start time, or tick \u201cAll day\u201d.');
    if (F.endDate && C.isDate(F.date) && F.endDate < F.date) e.push('The end/return date cannot be before the start date.');
    if (!F.allDay && F.endTime && !C.isTime(F.endTime)) e.push('The end time is not valid.');
    if (!F.allDay && C.isTime(F.endTime) && C.isTime(F.startTime) && (!F.endDate || F.endDate === F.date) && F.endTime <= F.startTime && F.tz === (F.category === 'Travel' ? F.endTz : F.tz)) e.push('The end time must be after the start time.');
    if (F.scope === 'all' && F.freq !== 'none' && F.until && C.isDate(F.date) && F.until < F.date) e.push('\u201cRepeat until\u201d cannot be before the start date.');
    if (F.cEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(F.cEmail)) e.push('The contact email does not look right.');
    return e;
  }

  /* ---------- reminder preview ---------- */
  function previewHtml(F) {
    const now = Date.now(), offs = C.cleanOffsets(F.offsets);
    if (!offs.length) return '<p class="muted">No reminders selected for this appointment.</p>';
    if (!F.title || !C.isDate(F.date) || !C.isTz(F.tz) || (!F.allDay && !C.isTime(F.startTime))) return '<p class="muted">Enter a title, date, time and valid time zone to see exact reminder times.</p>';
    let occ, items;
    if (F.scope === 'one') { occ = { date: F.date, startTime: F.startTime, allDay: F.allDay, tz: F.tz }; items = offs.map(m => { const at = C.fireInstant(occ, m); return { offset: m, label: C.offsetLabel(m), at, past: at <= now }; }); }
    else {
      const p = C.reminderPreview(C.cleanEvent(toRaw(F, ui.form && ui.form.id ? ev(ui.form.id) : null)) || {}, now);
      if (!p) return '<p class="muted">Enter valid details to see reminder times.</p>';
      if (!p.occ) return '<p class="muted">There is no upcoming occurrence, so no reminders will fire.</p>';
      occ = p.occ; items = p.items;
    }
    const local = (at) => F.tz !== LB.tz ? ` <span class="muted small">(your time: ${esc(LB.fmtInstant(at, LB.tz))})</span>` : '';
    return `<p class="small">For the occurrence on <b>${esc(LB.fmtDate(occ.date, true))}</b>${F.freq !== 'none' && F.scope === 'all' ? '; later occurrences get the same reminders' : ''}. Times in <b>${esc(F.tz)}</b>:</p><ul class="pv plain">` +
      items.map(i => `<li class="${i.past ? 'past' : ''}"><b>${esc(i.label)}</b>: ${esc(LB.fmtInstant(i.at, F.tz))}${local(i.at)} ${i.past ? '<span class="badge warn">Skipped: already past</span>' : ''}</li>`).join('') + '</ul>';
  }
  LB.changes.evForm = (f, e) => {
    ui.form = collect(f); const tg = e.target;
    if (tg.dataset.struct) { ui.focus = '#' + tg.id; return; }
    const p = document.getElementById('evPreview'); if (p) p.innerHTML = previewHtml(ui.form); return 'none';
  };
  A.addCustomOff = () => {
    const f = document.getElementById('evForm'); ui.form = collect(f);
    const n = parseFloat(document.getElementById('cuN').value), u = +document.getElementById('cuU').value, m = Math.round(n * u);
    if (!(n > 0) || !Number.isFinite(m) || m > 525600) { ui.formErr = ['Enter a custom reminder time greater than zero (up to 1 year).']; return; }
    ui.formErr = []; if (!ui.form.offsets.includes(m)) ui.form.offsets.push(m); ui.focus = '#cuN';
  };

  /* ---------- form view ---------- */
  const tzList = () => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return ['UTC', 'Europe/London', 'Europe/Paris', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney']; } };
  V.eventForm = function () {
    const F = ui.form; if (!F) { ui.view = null; return V[ui.tab](); }
    const one = F.scope === 'one', trav = F.category === 'Travel', rec = F.freq !== 'none';
    const presets = C.PRESET_OFFSETS.map(p => p.min), customs = F.offsets.filter(m => !presets.includes(m));
    const chk = (m, label) => `<label class="inline"><input type="checkbox" name="off" value="${m}" ${F.offsets.includes(m) ? 'checked' : ''}> ${esc(label)}</label>`;
    const inp = (id, name, label, val, type, extra) => `<div class="field"><label for="${id}">${label}</label><input type="${type || 'text'}" id="${id}" name="${name}" value="${esc(val)}" ${extra || ''}></div>`;
    return `<h2>${F.mode === 'new' ? 'Add appointment' : one ? 'Edit this occurrence' : 'Edit appointment'}</h2>
      ${one ? `<p class="note">You are editing only the occurrence on <b>${esc(LB.fmtDate(F.origKey, true))}</b>. The rest of the series is unchanged.</p>` : ''}
      ${ui.formErr && ui.formErr.length ? `<div class="err" role="alert"><b>Please fix:</b><ul>${ui.formErr.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></div>` : ''}
      <form class="card" id="evForm" data-s="saveEvent" data-c="evForm" novalidate>
      ${inp('f-title', 'title', 'Title', F.title, 'text', 'maxlength="120" required')}
      ${one ? '' : `<div class="field"><label for="f-cat">Category</label><select id="f-cat" name="category" data-struct="1">${C.CATS.map(c => `<option value="${c}" ${F.category === c ? 'selected' : ''}>${icon(c)} ${c}</option>`).join('')}</select></div>
      <label class="inline"><input type="checkbox" id="f-allday" name="allDay" data-struct="1" ${F.allDay ? 'checked' : ''}> All-day event</label>`}
      <div class="row"><div class="grow">${inp('f-date', 'date', trav && !one ? 'Departure date' : 'Date', F.date, 'date', 'required')}</div>
      ${F.allDay ? '' : `<div class="grow">${inp('f-st', 'startTime', trav && !one ? 'Departure time' : 'Start time', F.startTime, 'time')}</div><div class="grow">${inp('f-et', 'endTime', trav && !one ? 'Arrival / return time' : 'End time (optional)', F.endTime, 'time')}</div>`}</div>
      ${one ? '' : `${inp('f-ed', 'endDate', trav ? 'Return date (optional)' : 'End date (optional, for multi-day)', F.endDate, 'date')}
      <div class="row"><div class="grow">${inp('f-tz', 'tz', trav ? 'Departure time zone' : 'Time zone', F.tz, 'text', 'list="tzl" autocomplete="off" data-struct="1"')}</div>${trav ? `<div class="grow">${inp('f-etz', 'endTz', 'Return time zone', F.endTz, 'text', 'list="tzl" autocomplete="off"')}</div>` : ''}</div>
      <datalist id="tzl">${tzList().map(z => `<option value="${z}">`).join('')}</datalist>
      <p class="muted small" style="margin-top:-6px">Times are saved in the time zone you choose, and reminders follow daylight-saving changes there.</p>`}
      ${inp('f-loc', 'location', 'Location', F.location, 'text', 'maxlength="200"')}
      ${trav && !one ? inp('f-bk', 'bookingRef', 'Booking reference', F.bookingRef, 'text', 'maxlength="60"') : ''}
      <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" name="notes" maxlength="2000">${esc(F.notes)}</textarea></div>
      ${one ? '' : `<details ${F.cName || F.cPhone || F.cEmail ? 'open' : ''}><summary>Contact details (optional)</summary>${inp('f-cn', 'cName', 'Contact name', F.cName, 'text', 'maxlength="100"')}${inp('f-cp', 'cPhone', 'Phone', F.cPhone, 'tel', 'maxlength="40"')}${inp('f-ce', 'cEmail', 'Email', F.cEmail, 'email', 'maxlength="120"')}</details>
      <fieldset style="margin-top:12px"><legend>Repeat</legend><div class="row"><div class="grow"><label for="f-fr" class="sr">Repeats</label><select id="f-fr" name="freq" data-struct="1">${[['none', 'Does not repeat'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']].map(o => `<option value="${o[0]}" ${F.freq === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
      ${rec ? `<div class="grow"><label for="f-iv">Every (number of ${{ daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }[F.freq]})</label><input type="number" id="f-iv" name="interval" min="1" max="365" value="${F.interval}"></div><div class="grow"><label for="f-un">Repeat until (optional)</label><input type="date" id="f-un" name="until" value="${F.until}"></div>` : ''}</div></fieldset>`}
      <fieldset><legend>Reminders</legend>${one ? '<p class="muted small">This occurrence uses the reminders set for the series. Edit the whole series to change them.</p>' : ''}
      <div ${one ? 'hidden' : ''}>${C.PRESET_OFFSETS.map(p => chk(p.min, p.label)).join('')}${customs.map(m => chk(m, C.offsetLabel(m) + ' (custom)')).join('')}
      <div class="row" style="margin-top:8px"><div><label for="cuN">Custom reminder</label><input type="number" id="cuN" min="1" step="any" placeholder="e.g. 45" style="width:110px"></div><div><label for="cuU">Unit</label><select id="cuU"><option value="1">minutes before</option><option value="60">hours before</option><option value="1440">days before</option></select></div><button type="button" class="btn alt" data-a="addCustomOff">Add</button></div></div>
      <h3 style="margin-top:12px">Exact reminder times</h3><div id="evPreview" aria-live="polite">${previewHtml(F)}</div><p class="muted small">${esc(LB.rem ? LB.rem.deliveryNote() : '')}</p></fieldset>
      <div class="row"><button class="btn">Save appointment</button><button type="button" class="btn alt" data-a="closeForm">Cancel</button></div></form>`;
  };
  SB.saveEvent = async f => {
    const F = collect(f); ui.form = F; const errs = validate(F);
    if (errs.length) { ui.formErr = errs; window.scrollTo(0, 0); return; }
    const S = LB.S, old = F.id ? ev(F.id) : null;
    if (F.mode === 'edit' && !old) { ui.view = null; return; }
    if (F.scope === 'one') {
      const ex = Object.assign({}, old.exceptions[F.origKey] || {}); delete ex.cancelled; const wasC = (old.exceptions[F.origKey] || {}).cancelled;
      ex.title = F.title !== old.title ? F.title : undefined; ex.date = F.date !== F.origKey ? F.date : undefined;
      ex.startTime = !old.allDay && F.startTime !== old.startTime ? F.startTime : undefined; ex.endTime = !old.allDay && F.endTime !== old.endTime ? F.endTime : undefined;
      ex.location = F.location !== old.location ? F.location : undefined; ex.notes = F.notes !== old.notes ? F.notes : undefined;
      Object.keys(ex).forEach(k => ex[k] === undefined && delete ex[k]); if (wasC) ex.cancelled = true;
      if (Object.keys(ex).length) old.exceptions[F.origKey] = ex; else delete old.exceptions[F.origKey];
      S.events[S.events.indexOf(old)] = C.cleanEvent(old);
    } else {
      if (old && Object.keys(old.exceptions).length && (F.date !== old.date || F.freq !== old.recurrence.freq || F.interval !== old.recurrence.interval)) {
        const ok = await LB.confirm('Reset individual changes?', '<p>You changed the start date or repeat pattern. Changes and cancellations made to single occurrences would no longer line up, so they will be cleared.</p>', 'Continue', false); if (!ok) return false;
        old.exceptions = {};
      }
      const clean = C.cleanEvent(toRaw(F, old)); if (!clean) { ui.formErr = ['Please check the details.']; return; }
      if (old) S.events[S.events.indexOf(old)] = clean; else { clean.id = C.uid(); S.events.push(clean); }
    }
    ui.view = null; ui.form = null; LB.save();
    const n = F.scope === 'one' ? 0 : (previewHtml(F).match(/<li /g) || []).length - (previewHtml(F).match(/Skipped/g) || []).length;
    LB.toast('Appointment saved.' + (n > 0 ? ' ' + n + ' reminder time' + (n === 1 ? '' : 's') + ' will be checked while the app is open.' : ''));
  };
})();
