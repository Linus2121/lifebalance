/* LifeBalance core: pure logic (no DOM). Works in browsers and Node (for tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LBCore = factory();
})(this, function () {
  'use strict';

  const CATS = ['General', 'School', 'GP', 'Hospital', 'Meetings', 'Weddings', 'Travel', 'Other'];
  const CAT_ICONS = { General: '📌', School: '🎓', GP: '🩺', Hospital: '🏥', Meetings: '👥', Weddings: '💍', Travel: '✈️', Other: '🗂️' };
  const PRESET_OFFSETS = [
    { min: 20160, label: '14 days before' }, { min: 10080, label: '7 days before' }, { min: 4320, label: '3 days before' },
    { min: 1440, label: '1 day before' }, { min: 120, label: '2 hours before' }, { min: 30, label: '30 minutes before' },
    { min: 0, label: 'At event time' }];
  const WORKOUT_TYPES = { walking: 'Walking', running: 'Running', cycling: 'Cycling', gym: 'Gym session', custom: 'Custom activity' };
  const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
  const ALL_DAY_TIME = '09:00';
  const APP_UPDATED = '2026-10-29';

  /* ---------- dates (date keys are YYYY-MM-DD, handled in UTC so they never shift) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  function parseDate(k) {
    if (typeof k !== 'string' || !DATE_RE.test(k)) return new Date(NaN);
    const [y, m, d] = k.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : new Date(NaN);
  }
  const isDate = k => !isNaN(parseDate(k));
  const isTime = t => typeof t === 'string' && TIME_RE.test(t);
  const fmt = dt => dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
  const addDays = (k, n) => { const dt = parseDate(k); dt.setUTCDate(dt.getUTCDate() + n); return fmt(dt); };
  const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);
  const dayOfWeek = k => parseDate(k).getUTCDay();
  const localDateKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function addMonths(k, n, anchorDay) {
    const dt = parseDate(k), m = dt.getUTCMonth() + n;
    const ny = dt.getUTCFullYear() + Math.floor(m / 12), nm = ((m % 12) + 12) % 12;
    const dim = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    return fmt(new Date(Date.UTC(ny, nm, Math.min(anchorDay, dim))));
  }
  const weekStart = k => addDays(k, -((dayOfWeek(k) + 6) % 7)); // Monday

  /* ---------- time zones ---------- */
  const dtfCache = {};
  function dtf(tz) {
    return dtfCache[tz] || (dtfCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
  }
  function isTz(tz) { try { dtf(tz); return typeof tz === 'string' && tz.length > 0; } catch (e) { return false; } }
  function tzParts(ms, tz) {
    const o = {};
    dtf(tz).formatToParts(new Date(ms)).forEach(p => { if (p.type !== 'literal') o[p.type] = +p.value; });
    return o;
  }
  const tzOffsetMs = (ms, tz) => { const p = tzParts(ms, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000; };
  function dateInTz(ms, tz) { const p = tzParts(ms, tz); return p.year + '-' + pad(p.month) + '-' + pad(p.day); }
  // Wall-clock time in a zone -> UTC instant (handles DST; times skipped by a spring-forward gap move forward).
  function zonedToUtc(dateKey, time, tz) {
    const [y, m, d] = dateKey.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    const off1 = tzOffsetMs(guess, tz);
    let t = guess - off1;
    const off2 = tzOffsetMs(t, tz);
    if (off2 !== off1) t = guess - off2;
    return t;
  }

  /* ---------- helpers ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const numOr = (v, d, min = -Infinity, max = Infinity) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) && n >= min && n <= max ? n : d; };
  const idOr = v => typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : uid();
  const dateOr = (v, d) => isDate(v) ? v : d;
  const timeOr = (v, d) => isTime(v) ? v : d;
  const strList = (v, max = 60, n = 100) => Array.isArray(v) ? [...new Set(v.map(x => str(x, max)).filter(Boolean))].slice(0, n) : [];

  function offsetLabel(min) {
    const p = PRESET_OFFSETS.find(o => o.min === min);
    if (p) return p.label;
    if (min === 0) return 'At event time';
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60, parts = [];
    if (d) parts.push(d + (d === 1 ? ' day' : ' days'));
    if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
    if (m) parts.push(m + (m === 1 ? ' minute' : ' minutes'));
    return parts.join(' ') + ' before';
  }
  const offsetPhrase = min => offsetLabel(min).replace(/ before$/, '');

  /* ---------- habits (history-aware) ---------- */
  function builtinHabits(createdAt) {
    const mk = (id, name, icon, unit, goal, step, color) => ({ id, name, icon, unit, goal, step, color, builtin: true, createdAt, archivedAt: '', goalHistory: [{ from: createdAt, goal }] });
    return [mk('water', 'Water', '💧', 'glasses', 8, 1, '#1c7ed6'), mk('walk', 'Walking', '🚶', 'min', 30, 5, '#0e9f8e'),
      mk('exercise', 'Exercise', '🏋️', 'min', 30, 5, '#c2255c'), mk('read', 'Reading', '📖', 'min', 20, 5, '#b36200'), mk('sleep', 'Sleep', '😴', 'hours', 8, 0.5, '#6c4cf1')];
  }
  const habitActive = (h, d) => d >= (h.createdAt || '0000-01-01') && (!h.archivedAt || d < h.archivedAt);
  function goalOn(h, d) {
    const gh = (h.goalHistory || []).slice().sort((a, b) => a.from < b.from ? -1 : 1);
    if (!gh.length) return h.goal;
    let g = gh[0].goal;
    gh.forEach(e => { if (e.from <= d) g = e.goal; });
    return g;
  }
  // Workouts feed Walking/Exercise habits so one activity is never counted twice.
  function workoutMinutes(S, d, habitId) {
    return S.fitness.workouts.filter(w => w.date === d && (habitId === 'walk' ? w.type === 'walking' : w.type !== 'walking')).reduce((a, w) => a + w.minutes, 0);
  }
  function habitManual(S, d, h) { return (S.logs[d] && S.logs[d][h.id]) || 0; }
  function habitValue(S, d, h) {
    const v = habitManual(S, d, h) + (h.id === 'walk' || h.id === 'exercise' ? workoutMinutes(S, d, h.id) : 0);
    return Math.round(v * 100) / 100;
  }
  const habitPct = (S, d, h) => Math.min(1, habitValue(S, d, h) / goalOn(h, d));
  function dayHabitPct(S, d) {
    const act = S.habits.filter(h => habitActive(h, d));
    return act.length ? act.reduce((a, h) => a + habitPct(S, d, h), 0) / act.length : null;
  }
  function habitStreak(S, h, today) {
    const met = d => habitActive(h, d) && habitValue(S, d, h) >= goalOn(h, d);
    let d = today, n = 0;
    if (!met(d)) d = addDays(d, -1);
    while (met(d) && n < 3650) { n++; d = addDays(d, -1); }
    return n;
  }
  const dayTasks = (S, d) => S.tasks.filter(t => t.date === d);
  const dayEntries = (S, d) => S.journal.filter(j => j.date === d);
  function activeOn(S, d) {
    return dayTasks(S, d).some(t => t.done) || S.habits.some(h => habitValue(S, d, h) > 0) || dayEntries(S, d).length > 0 ||
      S.fitness.workouts.some(w => w.date === d) || (S.food.diary[d] || []).length > 0;
  }
  function activeStreak(S, today) {
    let d = today, n = 0;
    if (!activeOn(S, d)) d = addDays(d, -1);
    while (activeOn(S, d) && n < 3650) { n++; d = addDays(d, -1); }
    return n;
  }
  const overdueTasks = (S, today) => S.tasks.filter(t => !t.done && t.date < today).sort((a, b) => a.date < b.date ? -1 : 1);

  /* ---------- achievements ---------- */
  const ACHIEVEMENTS = [
    { id: 'first', icon: '✅', name: 'First step', desc: 'Complete a task', test: S => S.tasks.some(t => t.done) },
    { id: 'triple', icon: '⭐', name: 'Triple focus', desc: 'Finish 3 priorities in a day', test: S => [...new Set(S.tasks.map(t => t.date))].some(d => dayTasks(S, d).filter(t => t.priority && t.done).length >= 3) },
    { id: 'water', icon: '💧', name: 'Hydrated', desc: 'Reach your water goal', test: S => Object.keys(S.logs).some(d => S.habits.some(h => h.id === 'water' && habitActive(h, d) && habitValue(S, d, h) >= goalOn(h, d))) },
    { id: 'roll', icon: '🔥', name: 'On a roll', desc: '3-day streak on any habit', test: (S, t) => S.habits.some(h => habitStreak(S, h, t) >= 3) },
    { id: 'week', icon: '🏆', name: 'Week warrior', desc: '7-day streak on any habit', test: (S, t) => S.habits.some(h => habitStreak(S, h, t) >= 7) },
    { id: 'all', icon: '🌈', name: 'All-rounder', desc: 'Hit every habit goal in one day', test: S => Object.keys(S.logs).concat(S.fitness.workouts.map(w => w.date)).some(d => { const a = S.habits.filter(h => habitActive(h, d)); return a.length > 0 && a.every(h => habitValue(S, d, h) >= goalOn(h, d)); }) },
    { id: 'reflect', icon: '📔', name: 'Reflective', desc: 'Write 3 journal entries', test: S => S.journal.length >= 3 },
    { id: 'planner', icon: '📅', name: 'Planner', desc: 'Add an appointment', test: S => S.events.length > 0 },
    { id: 'mover', icon: '🏃', name: 'Mover', desc: 'Log a workout', test: S => S.fitness.workouts.length > 0 },
    { id: 'nourish', icon: '🥗', name: 'Nourished', desc: 'Log a meal', test: S => Object.values(S.food.diary).some(a => a.length > 0) }];
  // Adds newly earned achievements; never removes any. Returns the new ones.
  function updateAchievements(S, today) {
    const fresh = [];
    ACHIEVEMENTS.forEach(a => { if (!S.achievements[a.id] && a.test(S, today)) { S.achievements[a.id] = today; fresh.push(a); } });
    return fresh;
  }

  /* ---------- events: recurrence & occurrences ---------- */
  function origDates(ev, from, to) {
    const r = ev.recurrence || { freq: 'none' }, base = ev.date;
    if (r.freq === 'none') return base >= from && base <= to ? [base] : [];
    const iv = Math.max(1, r.interval || 1), baseDay = parseDate(base).getUTCDate(), out = [];
    const nth = i => r.freq === 'daily' ? addDays(base, i * iv) : r.freq === 'weekly' ? addDays(base, 7 * i * iv) : addMonths(base, (r.freq === 'yearly' ? 12 : 1) * i * iv, baseDay);
    let i = 0;
    if (r.freq === 'daily' || r.freq === 'weekly') i = Math.max(0, Math.floor(diffDays(base, from) / ((r.freq === 'daily' ? 1 : 7) * iv)) - 1);
    for (let n = 0; n < 6000; n++, i++) {
      if (r.count && i >= r.count) break;
      const d = nth(i);
      if (d > to || (r.until && d > r.until)) break;
      if (d >= from) out.push(d);
    }
    return out;
  }
  function occurrences(ev, from, to) {
    const span = ev.endDate ? Math.max(0, diffDays(ev.date, ev.endDate)) : 0, exs = ev.exceptions || {};
    const shift = Math.max(0, ...Object.keys(exs).map(k => exs[k].date ? Math.abs(diffDays(k, exs[k].date)) : 0));
    const pick = (ex, k, d) => ex[k] !== undefined ? ex[k] : d;
    return origDates(ev, addDays(from, -(span + shift)), addDays(to, shift)).map(orig => {
      const ex = exs[orig] || {}, date = ex.date || orig;
      return {
        evId: ev.id, key: orig, date, endDate: addDays(date, span), allDay: ev.allDay, startTime: pick(ex, 'startTime', ev.startTime), endTime: pick(ex, 'endTime', ev.endTime),
        title: ex.title || ev.title, location: pick(ex, 'location', ev.location), notes: pick(ex, 'notes', ev.notes), category: ev.category, tz: ev.tz, endTz: ev.endTz,
        cancelled: !!(ev.cancelled || ex.cancelled), seriesCancelled: !!ev.cancelled, occCancelled: !!ex.cancelled, modified: !!ex.date || (!ex.cancelled && Object.keys(ex).length > 0),
        recurring: !!ev.recurrence && ev.recurrence.freq !== 'none', bookingRef: ev.bookingRef, contact: ev.contact, hasReminders: (ev.reminders.offsets || []).length > 0,
        returnTime: ev.endTime, returnDate: ev.endDate
      };
    }).filter(o => o.date <= to && o.endDate >= from);
  }
  const occSort = (a, b) => (a.date + (a.allDay ? '00:00' : a.startTime)) < (b.date + (b.allDay ? '00:00' : b.startTime)) ? -1 : 1;
  function allOccurrences(S, from, to) {
    const out = [];
    S.events.forEach(ev => out.push(...occurrences(ev, from, to)));
    return out.sort(occSort);
  }
  const startInstant = occ => zonedToUtc(occ.date, occ.allDay ? ALL_DAY_TIME : occ.startTime, occ.tz);

  /* ---------- reminders ---------- */
  // Day-based offsets keep the same wall-clock time (correct across DST); others are exact durations.
  function fireInstant(occ, offsetMin) {
    const time = occ.allDay ? ALL_DAY_TIME : occ.startTime;
    if (offsetMin >= 1440 && offsetMin % 1440 === 0) return zonedToUtc(addDays(occ.date, -offsetMin / 1440), time, occ.tz);
    return zonedToUtc(occ.date, time, occ.tz) - offsetMin * 60000;
  }
  const cleanOffsets = a => [...new Set((Array.isArray(a) ? a : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 60 * 24 * 365))].sort((x, y) => y - x);

  function reminderPreview(ev, nowMs) {
    const offsets = cleanOffsets(ev.reminders && ev.reminders.offsets);
    if (ev.cancelled || !offsets.length) return null;
    const from = dateInTz(nowMs, ev.tz);
    const occ = occurrences(ev, addDays(from, -1), addDays(from, 800)).filter(o => !o.cancelled && startInstant(o) > nowMs).sort(occSort)[0];
    if (!occ) return { occ: null, items: [] };
    return { occ, items: offsets.map(m => { const at = fireInstant(occ, m); return { offset: m, label: offsetLabel(m), at, past: at <= nowMs }; }) };
  }

  function remindersBetween(S, fromMs, toMs, tz) {
    const out = [], settings = S.settings;
    S.events.forEach(ev => {
      const offsets = cleanOffsets(ev.reminders.offsets);
      if (ev.cancelled || !offsets.length) return;
      const maxO = offsets[0];
      const f = addDays(dateInTz(fromMs, ev.tz), -1), t = addDays(dateInTz(toMs + maxO * 60000, ev.tz), 1);
      occurrences(ev, f, t).forEach(occ => {
        if (occ.cancelled) return;
        offsets.forEach(m => {
          const at = fireInstant(occ, m);
          if (at >= fromMs && at <= toMs) out.push({ key: `ev|${ev.id}|${occ.key}|${m}|${at}`, at, kind: 'event', title: occ.title, offset: m, occ });
        });
      });
    });
    const d1 = addDays(dateInTz(fromMs, tz), -1), d2 = addDays(dateInTz(toMs, tz), 1);
    for (let d = d1; d <= d2; d = addDays(d, 1)) {
      const push = (key, time, lead, kind, extra) => { const at = zonedToUtc(d, time, tz) - lead * 60000; if (at >= fromMs && at <= toMs) out.push({ key: `${key}|${d}|${at}`, at, kind, ...extra }); };
      if (settings.fitnessReminders.enabled) S.fitness.plan.forEach(p => { if (p.time && p.day === dayOfWeek(d)) push('fit|' + p.id, p.time, settings.fitnessReminders.lead, 'fitness', { title: p.name || WORKOUT_TYPES[p.type] }); });
      if (settings.mealReminders.enabled) ['breakfast', 'lunch', 'dinner'].forEach(m => { if (settings.mealReminders[m]) push('meal|' + m, settings.mealReminders[m], 0, 'meal', { title: m }); });
      if (settings.hydrationReminders.enabled) settings.hydrationReminders.times.forEach(t => push('water|' + t, t, 0, 'water', { title: 'water' }));
    }
    return out.sort((a, b) => a.at - b.at);
  }
  // Text for a reminder. Generic unless the user opted in to details (privacy default).
  function reminderText(r, showDetails, tz) {
    if (!showDetails) return { title: 'LifeBalance', body: 'You have a reminder.' };
    return fullReminderText(r, tz);
  }
  function fullReminderText(r, tz) {
    if (r.kind === 'event') {
      const when = new Date(r.at + r.offset * 60000).toLocaleString(undefined, { timeZone: r.occ.tz || tz, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      return { title: r.title, body: r.offset === 0 ? 'Starting now' : `Starts in ${offsetPhrase(r.offset)} · ${r.occ.allDay ? 'all day' : when}` };
    }
    if (r.kind === 'fitness') return { title: 'Workout reminder', body: `Time for: ${r.title}` };
    if (r.kind === 'meal') return { title: 'Meal reminder', body: `Time for ${r.title}` };
    return { title: 'Hydration reminder', body: 'Time for a glass of water' };
  }

  /* ---------- state: defaults, normalisation, validation ---------- */
  function freshState(today) {
    return {
      version: 2, tasks: [], habits: builtinHabits(today), logs: {}, journal: [], draft: { mood: null, note: '' }, achievements: {}, events: [],
      fitness: { goals: { weeklyWorkouts: 3, weeklyMinutes: 150, trackWeight: false, targetWeightKg: null }, plan: [], workouts: [], weights: [] },
      food: { prefs: { diets: [], allergies: [], exclusions: [], trackCalories: false, calorieTarget: null }, diary: {}, plan: {}, custom: [], favourites: [], shopping: [] },
      settings: {
        showDetails: false, defaultOffsets: [1440, 30], fitnessReminders: { enabled: false, lead: 15 },
        mealReminders: { enabled: false, breakfast: '08:00', lunch: '13:00', dinner: '19:00' }, hydrationReminders: { enabled: false, times: ['10:00', '13:00', '16:00'] }
      }
    };
  }
  const MAXN = 20000;
  function list(arr, warn, fn) {
    if (!Array.isArray(arr)) return [];
    const out = [], ids = new Set();
    arr.slice(0, MAXN).forEach(x => {
      let r = null; try { r = fn(x); } catch (e) { r = null; }
      if (!r) { warn.n++; return; }
      if (r.id !== undefined) { while (ids.has(r.id)) r.id = uid(); ids.add(r.id); }
      out.push(r);
    });
    return out;
  }
  function cleanRec(r) {
    if (!isObj(r) || !['daily', 'weekly', 'monthly', 'yearly'].includes(r.freq)) return { freq: 'none', interval: 1, until: '', count: 0 };
    return { freq: r.freq, interval: (numOr(r.interval, 1, 1, 365) | 0) || 1, until: dateOr(r.until, ''), count: numOr(r.count, 0, 0, 5000) | 0 };
  }
  function cleanEvent(e) {
    if (!isObj(e) || !str(e.title) || !isDate(e.date)) return null;
    const tz = isTz(e.tz) ? e.tz : 'UTC', c = isObj(e.contact) ? e.contact : {};
    const ex = {};
    if (isObj(e.exceptions)) Object.keys(e.exceptions).slice(0, 2000).forEach(k => {
      const x = e.exceptions[k]; if (!isDate(k) || !isObj(x)) return;
      const o = {};
      if (x.cancelled) o.cancelled = true;
      if (str(x.title)) o.title = str(x.title, 120);
      if (isDate(x.date)) o.date = x.date;
      if (isTime(x.startTime)) o.startTime = x.startTime;
      if (x.endTime === '' || isTime(x.endTime)) o.endTime = x.endTime;
      if (typeof x.location === 'string') o.location = str(x.location, 200);
      if (typeof x.notes === 'string') o.notes = str(x.notes, 2000);
      ex[k] = o;
    });
    const allDay = !!e.allDay;
    return {
      id: idOr(e.id), title: str(e.title, 120), category: CATS.includes(e.category) ? e.category : 'General', allDay, date: e.date,
      startTime: allDay ? '' : timeOr(e.startTime, '09:00'), endTime: allDay ? '' : timeOr(e.endTime, ''), endDate: isDate(e.endDate) && e.endDate >= e.date ? e.endDate : '',
      tz, endTz: isTz(e.endTz) ? e.endTz : tz, location: str(e.location, 200), notes: str(e.notes, 2000), bookingRef: str(e.bookingRef, 60),
      contact: { name: str(c.name, 100), phone: str(c.phone, 40), email: str(c.email, 120) }, recurrence: cleanRec(e.recurrence), exceptions: ex, cancelled: !!e.cancelled,
      reminders: { offsets: cleanOffsets(e.reminders && e.reminders.offsets) }
    };
  }
  function normalize(raw, today) {
    const warn = { n: 0 }, r = isObj(raw) ? raw : {}, S = freshState(today);
    S.tasks = list(r.tasks, warn, t => isObj(t) && str(t.title) ? { id: idOr(t.id), title: str(t.title, 120), date: dateOr(t.date, today), done: !!t.done, priority: !!t.priority } : null);
    S.logs = {};
    if (isObj(r.logs)) Object.keys(r.logs).slice(0, 5000).forEach(d => {
      if (!isDate(d) || !isObj(r.logs[d])) return;
      const o = {}; Object.keys(r.logs[d]).slice(0, 100).forEach(h => { const v = numOr(r.logs[d][h], null, 0, 100000); if (v !== null && /^[\w-]{1,64}$/.test(h)) o[h] = v; });
      S.logs[d] = o;
    });
    S.journal = list(r.journal, warn, j => isObj(j) && isDate(j.date) && [1, 2, 3, 4, 5].includes(+j.mood) ? { id: idOr(j.id), date: j.date, ts: numOr(j.ts, parseDate(j.date).getTime(), 0), mood: +j.mood, note: str(j.note, 2000) } : null);
    if (isObj(r.draft)) S.draft = { mood: [1, 2, 3, 4, 5].includes(+r.draft.mood) ? +r.draft.mood : null, note: typeof r.draft.note === 'string' ? r.draft.note.slice(0, 2000) : '' };
    const dates = [...S.tasks.map(t => t.date), ...Object.keys(S.logs), ...S.journal.map(j => j.date)].sort();
    const earliest = dates[0] && dates[0] < today ? dates[0] : today;
    if (Array.isArray(r.habits)) {
      S.habits = list(r.habits, warn, h => {
        if (!isObj(h) || !str(h.name) || !/^[\w-]{1,64}$/.test(h.id || '')) return null;
        const goal = numOr(h.goal, 1, 0.01, 100000), createdAt = dateOr(h.createdAt, earliest);
        let gh = Array.isArray(h.goalHistory) ? h.goalHistory.filter(e => isObj(e) && isDate(e.from) && numOr(e.goal, 0, 0.01) > 0).map(e => ({ from: e.from, goal: +e.goal })) : [];
        if (!gh.length) gh = [{ from: createdAt, goal }];
        return { id: h.id, name: str(h.name, 30), icon: str(h.icon, 4) || '⭐', unit: str(h.unit, 15) || 'times', goal, step: numOr(h.step, 1, 0.01, 1000), color: /^#[0-9a-f]{6}$/i.test(h.color) ? h.color : '#6c4cf1', builtin: !!h.builtin, createdAt, archivedAt: dateOr(h.archivedAt, ''), goalHistory: gh };
      });
    } else S.habits = builtinHabits(earliest);
    S.achievements = {};
    if (isObj(r.achievements)) Object.keys(r.achievements).forEach(k => { if (ACHIEVEMENTS.some(a => a.id === k) && isDate(r.achievements[k])) S.achievements[k] = r.achievements[k]; });
    S.events = list(r.events, warn, cleanEvent);
    const f = isObj(r.fitness) ? r.fitness : {}, g = isObj(f.goals) ? f.goals : {};
    S.fitness.goals = { weeklyWorkouts: numOr(g.weeklyWorkouts, 3, 0, 21) | 0, weeklyMinutes: numOr(g.weeklyMinutes, 150, 0, 10080) | 0, trackWeight: !!g.trackWeight, targetWeightKg: numOr(g.targetWeightKg, null, 20, 500) };
    S.fitness.plan = list(f.plan, warn, p => isObj(p) && Object.keys(WORKOUT_TYPES).includes(p.type) && [0, 1, 2, 3, 4, 5, 6].includes(+p.day) ? { id: idOr(p.id), day: +p.day, type: p.type, name: str(p.name, 60), minutes: numOr(p.minutes, 0, 0, 1440), time: p.time === '' || isTime(p.time) ? p.time : '' } : null);
    S.fitness.workouts = list(f.workouts, warn, w => isObj(w) && isDate(w.date) && Object.keys(WORKOUT_TYPES).includes(w.type) ? {
      id: idOr(w.id), date: w.date, type: w.type, name: str(w.name, 60), minutes: numOr(w.minutes, 0, 0, 1440), distanceKm: numOr(w.distanceKm, null, 0, 1000), notes: str(w.notes, 500),
      exercises: list(w.exercises, { n: 0 }, x => isObj(x) && str(x.name) ? { name: str(x.name, 60), sets: numOr(x.sets, null, 0, 100), reps: numOr(x.reps, null, 0, 1000), weightKg: numOr(x.weightKg, null, 0, 1000) } : null).slice(0, 30)
    } : null);
    S.fitness.weights = list(f.weights, warn, w => isObj(w) && isDate(w.date) && numOr(w.kg, null, 20, 500) !== null ? { id: idOr(w.id), date: w.date, kg: +w.kg } : null);
    const fd = isObj(r.food) ? r.food : {}, pf = isObj(fd.prefs) ? fd.prefs : {};
    S.food.prefs = { diets: strList(pf.diets, 20, 10), allergies: strList(pf.allergies, 40, 40), exclusions: strList(pf.exclusions, 40, 60), trackCalories: !!pf.trackCalories, calorieTarget: numOr(pf.calorieTarget, null, 500, 10000) };
    S.food.diary = {};
    if (isObj(fd.diary)) Object.keys(fd.diary).slice(0, 5000).forEach(d => {
      if (!isDate(d)) return;
      const a = list(fd.diary[d], warn, e => isObj(e) && MEAL_SLOTS.includes(e.meal) && str(e.name) ? { id: idOr(e.id), meal: e.meal, name: str(e.name, 100), mealId: str(e.mealId, 64), servings: numOr(e.servings, 1, 0.1, 20), kcal: numOr(e.kcal, null, 0, 20000) } : null);
      if (a.length) S.food.diary[d] = a;
    });
    S.food.plan = {};
    if (isObj(fd.plan)) Object.keys(fd.plan).slice(0, 2000).forEach(d => { if (isDate(d) && isObj(fd.plan[d])) { const o = {}; MEAL_SLOTS.forEach(m => { if (typeof fd.plan[d][m] === 'string' && fd.plan[d][m]) o[m] = str(fd.plan[d][m], 64); }); S.food.plan[d] = o; } });
    S.food.custom = list(fd.custom, warn, m => isObj(m) && str(m.name) ? {
      id: idOr(m.id), name: str(m.name, 80), cuisine: str(m.cuisine, 30) || 'Custom', slots: strList(m.slots, 12, 4).filter(s => MEAL_SLOTS.includes(s)), diets: strList(m.diets, 20, 10), allergens: strList(m.allergens, 30, 20),
      ingredients: strList(m.ingredients, 60, 60), servings: numOr(m.servings, 1, 0.1, 50), notes: str(m.notes, 1000),
      nutrition: { kcal: numOr(m.nutrition && m.nutrition.kcal, null, 0, 20000), protein: numOr(m.nutrition && m.nutrition.protein, null, 0, 2000), carbs: numOr(m.nutrition && m.nutrition.carbs, null, 0, 2000), fat: numOr(m.nutrition && m.nutrition.fat, null, 0, 2000) }
    } : null);
    S.food.favourites = strList(fd.favourites, 64, 500);
    S.food.shopping = list(fd.shopping, warn, s => isObj(s) && str(s.name) ? { id: idOr(s.id), name: str(s.name, 80), auto: !!s.auto, checked: !!s.checked, sources: strList(s.sources, 80, 20) } : null);
    const st = isObj(r.settings) ? r.settings : {}, d = S.settings;
    d.showDetails = !!st.showDetails;
    if (Array.isArray(st.defaultOffsets)) d.defaultOffsets = cleanOffsets(st.defaultOffsets);
    if (isObj(st.fitnessReminders)) d.fitnessReminders = { enabled: !!st.fitnessReminders.enabled, lead: numOr(st.fitnessReminders.lead, 15, 0, 1440) | 0 };
    if (isObj(st.mealReminders)) d.mealReminders = { enabled: !!st.mealReminders.enabled, breakfast: timeOr(st.mealReminders.breakfast, '08:00'), lunch: timeOr(st.mealReminders.lunch, '13:00'), dinner: timeOr(st.mealReminders.dinner, '19:00') };
    if (isObj(st.hydrationReminders)) d.hydrationReminders = { enabled: !!st.hydrationReminders.enabled, times: [...new Set((Array.isArray(st.hydrationReminders.times) ? st.hydrationReminders.times : []).filter(isTime))].sort().slice(0, 12) };
    return { state: S, dropped: warn.n, legacySample: r.sample === true && !r.version };
  }
  const summarize = S => ({
    tasks: S.tasks.length, habits: S.habits.length, journal: S.journal.length, events: S.events.length, workouts: S.fitness.workouts.length,
    meals: Object.values(S.food.diary).reduce((a, x) => a + x.length, 0), recipes: S.food.custom.length
  });
  // Validates a backup file's text. Returns {ok:false,error} or {ok:true,state,dropped,summary}.
  function validateImport(text, today) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
    if (text.length > 8e6) return { ok: false, error: 'The file is too large (limit 8 MB).' };
    let obj; try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'This is not valid JSON, so it cannot be a LifeBalance backup.' }; }
    if (!isObj(obj)) return { ok: false, error: 'Unexpected file contents.' };
    let data = obj;
    if (obj.app !== undefined) {
      if (obj.app !== 'LifeBalance') return { ok: false, error: 'This file was not exported from LifeBalance.' };
      if (!isObj(obj.data)) return { ok: false, error: 'The backup has no data section.' };
      data = obj.data;
    }
    if (data.version !== undefined && (typeof data.version !== 'number' || data.version > 2)) return { ok: false, error: 'This backup was made by a newer version of LifeBalance.' };
    const known = ['tasks', 'habits', 'logs', 'journal', 'events', 'fitness', 'food'];
    if (!known.some(k => k in data)) return { ok: false, error: 'No LifeBalance data found in this file.' };
    for (const k of ['tasks', 'habits', 'journal', 'events']) if (k in data && !Array.isArray(data[k])) return { ok: false, error: `"${k}" must be a list.` };
    for (const k of ['logs', 'fitness', 'food']) if (k in data && !isObj(data[k])) return { ok: false, error: `"${k}" has the wrong format.` };
    const n = normalize(data, today);
    return { ok: true, state: n.state, dropped: n.dropped, summary: summarize(n.state) };
  }
  const exportData = (S, now = new Date()) => JSON.stringify({ app: 'LifeBalance', format: 1, version: 2, exportedAt: now.toISOString(), data: S }, null, 2);

  /* ---------- demo data ---------- */
  function demoState(today) {
    const s = freshState(addDays(today, -7)), t = today, id = uid;
    s.tasks = [{ id: id(), title: 'Plan the week', date: t, done: true, priority: true }, { id: id(), title: 'Finish project outline', date: t, done: false, priority: true },
      { id: id(), title: 'Book a check-up', date: t, done: false, priority: true }, { id: id(), title: 'Buy groceries', date: t, done: false, priority: false },
      { id: id(), title: 'Return library books', date: addDays(t, -2), done: false, priority: false }];
    const notes = ['Felt calm after a walk.', 'Busy day but productive.', 'A bit tired, early night planned.', 'Lovely catch-up with a friend.', 'Slow start, got better.', 'Great workout!', 'Relaxed and happy.'];
    for (let i = 0; i < 7; i++) {
      const d = addDays(t, -i), f = i === 0 ? 0.6 : [1, 1, 0.9, 1, 0.7, 1][i - 1];
      s.logs[d] = {};
      s.habits.forEach((h, j) => { if (h.id !== 'walk' && h.id !== 'exercise') s.logs[d][h.id] = Math.round(h.goal * (i > 0 && (i + j) % 4 === 0 ? 0.8 : f) / h.step) * h.step; });
      if (i > 0) for (let k = 0; k < 2; k++) s.tasks.push({ id: id(), title: 'Past task ' + (k + 1), date: d, done: (i + k) % 3 !== 0 && !(i === 2 && k === 0), priority: k === 0 });
      s.journal.push({ id: id(), date: d, ts: parseDate(d).getTime() + 12 * 36e5, mood: [4, 3, 5, 4, 2, 5, 4][i], note: notes[i] });
      if (i % 2 === 0) s.fitness.workouts.push({ id: id(), date: d, type: i % 4 === 0 ? 'walking' : 'cycling', name: '', minutes: 30 + i * 3, distanceKm: 3 + i, notes: '', exercises: [] });
      s.food.diary[d] = [{ id: id(), meal: 'breakfast', name: 'Oatmeal with banana & cinnamon', mealId: 'oatmeal', servings: 1, kcal: null }, { id: id(), meal: 'lunch', name: 'Lentil dal with rice', mealId: 'lentil-dal', servings: 1, kcal: null }];
    }
    s.events = [
      cleanEvent({ id: id(), title: 'GP check-up', category: 'GP', date: addDays(t, 2), startTime: '10:30', endTime: '11:00', tz: 'UTC', location: 'Riverside Clinic', reminders: { offsets: [1440, 120] } }),
      cleanEvent({ id: id(), title: 'Team meeting', category: 'Meetings', date: addDays(t, 1), startTime: '09:00', endTime: '09:30', tz: 'UTC', recurrence: { freq: 'weekly', interval: 1 }, reminders: { offsets: [30] } }),
      cleanEvent({ id: id(), title: 'Cousin’s wedding', category: 'Weddings', date: addDays(t, 20), allDay: true, tz: 'UTC', reminders: { offsets: [10080, 1440] } })];
    s.fitness.plan = [{ id: id(), day: 1, type: 'gym', name: 'Upper body', minutes: 45, time: '18:00' }, { id: id(), day: 4, type: 'running', name: '', minutes: 30, time: '07:00' }];
    return s;
  }

  return {
    CATS, CAT_ICONS, PRESET_OFFSETS, WORKOUT_TYPES, MEAL_SLOTS, ACHIEVEMENTS, APP_UPDATED, ALL_DAY_TIME,
    pad, parseDate, isDate, isTime, addDays, diffDays, dayOfWeek, localDateKey, addMonths, weekStart,
    isTz, dateInTz, zonedToUtc, tzOffsetMs, uid, offsetLabel, offsetPhrase, cleanOffsets,
    builtinHabits, habitActive, goalOn, habitValue, habitManual, habitPct, dayHabitPct, habitStreak, activeOn, activeStreak, overdueTasks, dayTasks, dayEntries, workoutMinutes,
    updateAchievements, occurrences, allOccurrences, startInstant, fireInstant, reminderPreview, remindersBetween, reminderText, fullReminderText,
    freshState, normalize, validateImport, exportData, summarize, demoState, cleanEvent
  };
});
