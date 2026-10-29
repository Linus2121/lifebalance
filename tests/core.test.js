const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

const T = '2026-10-29';

test('zonedToUtc handles DST (Europe/London)', () => {
  assert.equal(new Date(C.zonedToUtc('2026-03-22', '09:00', 'Europe/London')).toISOString(), '2026-03-22T09:00:00.000Z');
  assert.equal(new Date(C.zonedToUtc('2026-03-29', '09:00', 'Europe/London')).toISOString(), '2026-03-29T08:00:00.000Z');
  assert.equal(new Date(C.zonedToUtc('2026-07-01', '12:00', 'America/New_York')).toISOString(), '2026-07-01T16:00:00.000Z');
  assert.equal(new Date(C.zonedToUtc('2026-01-15', '12:00', 'Asia/Kolkata')).toISOString(), '2026-01-15T06:30:00.000Z');
  assert.equal(new Date(C.zonedToUtc('2026-03-29', '01:30', 'Europe/London')).getUTCHours() >= 0, true); // gap time still resolves
});

test('weekly recurrence keeps wall-clock time across DST', () => {
  const ev = C.cleanEvent({ id: 'a', title: 'Gym', date: '2026-03-22', startTime: '09:00', tz: 'Europe/London', recurrence: { freq: 'weekly', interval: 1 } });
  const occ = C.occurrences(ev, '2026-03-22', '2026-04-05');
  assert.deepEqual(occ.map(o => o.date), ['2026-03-22', '2026-03-29', '2026-04-05']);
  assert.deepEqual(occ.map(o => new Date(C.startInstant(o)).toISOString().slice(11, 16)), ['09:00', '08:00', '08:00']);
});

test('day-based reminder offsets keep wall-clock time over DST; short offsets are exact', () => {
  const ev = C.cleanEvent({ id: 'b', title: 'X', date: '2026-03-29', startTime: '10:00', tz: 'Europe/London', reminders: { offsets: [1440, 120] } });
  const occ = C.occurrences(ev, '2026-03-29', '2026-03-29')[0];
  assert.equal(new Date(C.fireInstant(occ, 1440)).toISOString(), '2026-03-28T10:00:00.000Z'); // 10:00 GMT the day before
  assert.equal(new Date(C.fireInstant(occ, 120)).toISOString(), '2026-03-29T07:00:00.000Z'); // 08:00 BST
});

test('monthly recurrence clamps to month end; until and count respected', () => {
  const m = C.cleanEvent({ id: 'm', title: 'Rent', date: '2026-01-31', startTime: '09:00', tz: 'UTC', recurrence: { freq: 'monthly', interval: 1 } });
  assert.deepEqual(C.occurrences(m, '2026-01-01', '2026-04-30').map(o => o.date), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  const u = C.cleanEvent({ id: 'u', title: 'U', date: '2026-05-01', startTime: '09:00', tz: 'UTC', recurrence: { freq: 'daily', interval: 2, until: '2026-05-07' } });
  assert.deepEqual(C.occurrences(u, '2026-05-01', '2026-06-01').map(o => o.date), ['2026-05-01', '2026-05-03', '2026-05-05', '2026-05-07']);
  const c = C.cleanEvent({ id: 'c', title: 'C', date: '2026-05-01', startTime: '09:00', tz: 'UTC', recurrence: { freq: 'weekly', interval: 1, count: 3 } });
  assert.equal(C.occurrences(c, '2026-01-01', '2027-01-01').length, 3);
  const far = C.cleanEvent({ id: 'f', title: 'F', date: '2020-01-01', startTime: '09:00', tz: 'UTC', recurrence: { freq: 'daily', interval: 1 } });
  assert.deepEqual(C.occurrences(far, '2026-10-29', '2026-10-30').map(o => o.date), ['2026-10-29', '2026-10-30']);
});

test('editing/cancelling one occurrence leaves the series intact', () => {
  const ev = C.cleanEvent({ id: 'r', title: 'Class', date: '2026-11-02', startTime: '10:00', tz: 'UTC', recurrence: { freq: 'weekly', interval: 1 }, reminders: { offsets: [30] },
    exceptions: { '2026-11-09': { cancelled: true }, '2026-11-16': { startTime: '14:00', title: 'Class (moved)' }, '2026-11-23': { date: '2026-11-24' } } });
  const o = C.occurrences(ev, '2026-11-01', '2026-11-30');
  assert.deepEqual(o.map(x => x.date), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-24', '2026-11-30']);
  assert.equal(o[1].cancelled, true);
  assert.equal(o[2].startTime, '14:00'); assert.equal(o[2].title, 'Class (moved)');
  const now = C.zonedToUtc('2026-11-01', '00:00', 'UTC');
  const rem = C.remindersBetween({ ...C.freshState(T), events: [ev] }, now, now + 30 * 864e5, 'UTC');
  assert.equal(rem.length, 4); // cancelled occurrence has no reminder
  assert.equal(new Date(rem[1].at).toISOString(), '2026-11-16T13:30:00.000Z');
  const cancelled = { ...ev, cancelled: true };
  assert.equal(C.remindersBetween({ ...C.freshState(T), events: [cancelled] }, now, now + 30 * 864e5, 'UTC').length, 0);
});

test('reminder preview skips past times and handles all-day + travel time zones', () => {
  const now = C.zonedToUtc('2026-11-01', '12:00', 'UTC');
  const ev = C.cleanEvent({ title: 'Flight', category: 'Travel', date: '2026-11-03', startTime: '08:00', endDate: '2026-11-10', endTime: '18:00', tz: 'Africa/Lagos', endTz: 'Europe/London', bookingRef: 'ABC123', reminders: { offsets: [20160, 4320, 1440, 120, 0] } });
  const p = C.reminderPreview(ev, now);
  assert.equal(p.occ.date, '2026-11-03');
  assert.deepEqual(p.items.map(i => i.past), [true, true, false, false, false]);
  assert.equal(new Date(p.items[4].at).toISOString(), '2026-11-03T07:00:00.000Z'); // 08:00 Lagos (UTC+1)
  assert.equal(ev.endTz, 'Europe/London'); assert.equal(ev.bookingRef, 'ABC123');
  const ad = C.cleanEvent({ title: 'Wedding', date: '2026-12-05', allDay: true, tz: 'UTC', reminders: { offsets: [10080] } });
  assert.equal(new Date(C.reminderPreview(ad, now).items[0].at).toISOString(), '2026-11-28T09:00:00.000Z');
  assert.equal(C.reminderPreview({ ...ad, reminders: { offsets: [] } }, now), null);
});

test('reminders are de-duplicated and unique per occurrence', () => {
  const ev = C.cleanEvent({ id: 'd', title: 'D', date: '2026-11-05', startTime: '10:00', tz: 'UTC', reminders: { offsets: [30, 30, 120, 1440, 1440] } });
  assert.deepEqual(ev.reminders.offsets, [1440, 120, 30]);
  const now = C.zonedToUtc('2026-11-01', '00:00', 'UTC');
  const rem = C.remindersBetween({ ...C.freshState(T), events: [ev] }, now, now + 10 * 864e5, 'UTC');
  assert.equal(new Set(rem.map(r => r.key)).size, rem.length);
  assert.equal(rem.length, 3);
});

test('moving an event produces different reminder keys (no stale duplicate)', () => {
  const a = C.cleanEvent({ id: 'k', title: 'K', date: '2026-11-05', startTime: '10:00', tz: 'UTC', reminders: { offsets: [30] } });
  const b = { ...a, startTime: '11:00' };
  const now = C.zonedToUtc('2026-11-01', '00:00', 'UTC'), S = C.freshState(T);
  const ka = C.remindersBetween({ ...S, events: [a] }, now, now + 9e8, 'UTC')[0].key, kb = C.remindersBetween({ ...S, events: [b] }, now, now + 9e8, 'UTC')[0].key;
  assert.notEqual(ka, kb);
});

test('routine reminders (workout/meal/water) and privacy text', () => {
  const S = C.freshState(T);
  S.settings.fitnessReminders = { enabled: true, lead: 15 };
  S.fitness.plan = [{ id: 'p1', day: 1, type: 'gym', name: 'Upper body', minutes: 45, time: '18:00' }];
  S.settings.mealReminders.enabled = true; S.settings.hydrationReminders = { enabled: true, times: ['10:00'] };
  const from = C.zonedToUtc('2026-11-02', '00:00', 'UTC'); // Monday
  const r = C.remindersBetween(S, from, from + 864e5, 'UTC');
  assert.deepEqual(r.map(x => x.kind).sort(), ['fitness', 'meal', 'meal', 'meal', 'water']);
  const fit = r.find(x => x.kind === 'fitness');
  assert.equal(new Date(fit.at).toISOString(), '2026-11-02T17:45:00.000Z');
  assert.deepEqual(C.reminderText(fit, false, 'UTC'), { title: 'LifeBalance', body: 'You have a reminder.' });
  assert.match(C.reminderText(fit, true, 'UTC').body, /Upper body/);
});

test('historical habit progress uses the goal and habits that applied on each date', () => {
  const S = C.freshState('2026-10-01');
  const water = S.habits.find(h => h.id === 'water');
  S.logs['2026-10-10'] = { water: 4 };
  assert.equal(C.habitPct(S, '2026-10-10', water), 0.5);
  water.goalHistory.push({ from: '2026-10-20', goal: 4 }); water.goal = 4;
  assert.equal(C.habitPct(S, '2026-10-10', water), 0.5); // past unchanged by new goal
  assert.equal(C.habitPct(S, '2026-10-20', water), 0); S.logs['2026-10-20'] = { water: 4 };
  assert.equal(C.habitPct(S, '2026-10-20', water), 1);
  const added = { id: 'yoga', name: 'Yoga', icon: '⭐', unit: 'min', goal: 10, step: 5, color: '#6c4cf1', createdAt: '2026-10-15', archivedAt: '', goalHistory: [{ from: '2026-10-15', goal: 10 }] };
  S.habits.push(added);
  assert.equal(C.habitActive(added, '2026-10-10'), false);
  assert.equal(C.dayHabitPct(S, '2026-10-10'), (0.5 + 0 + 0 + 0 + 0) / 5); // yoga not counted before it existed
  added.archivedAt = '2026-10-25';
  assert.equal(C.habitActive(added, '2026-10-24'), true); assert.equal(C.habitActive(added, '2026-10-25'), false);
  assert.equal(C.dayHabitPct(S, '1999-01-01'), null);
});

test('workouts feed walking/exercise habits without double counting', () => {
  const S = C.freshState(T);
  S.logs[T] = { walk: 10 };
  S.fitness.workouts.push({ id: 'w', date: T, type: 'walking', minutes: 20, name: '', exercises: [] }, { id: 'x', date: T, type: 'gym', minutes: 40, name: '', exercises: [] });
  const walk = S.habits.find(h => h.id === 'walk'), ex = S.habits.find(h => h.id === 'exercise');
  assert.equal(C.habitValue(S, T, walk), 30); assert.equal(C.habitValue(S, T, ex), 40);
});

test('streaks use per-day goals', () => {
  const S = C.freshState('2026-10-20'); const w = S.habits[0];
  [27, 28, 29].forEach(d => { S.logs['2026-10-' + d] = { water: 8 }; });
  assert.equal(C.habitStreak(S, w, '2026-10-29'), 3);
  assert.equal(C.habitStreak(S, w, '2026-10-30'), 3); // today not yet met -> streak continues from yesterday
});

test('overdue tasks', () => {
  const S = C.freshState(T);
  S.tasks = [{ id: '1', title: 'old', date: '2026-10-20', done: false }, { id: '2', title: 'done', date: '2026-10-21', done: true }, { id: '3', title: 'today', date: T, done: false }];
  assert.deepEqual(C.overdueTasks(S, T).map(t => t.id), ['1']);
});

test('achievements are permanent once earned', () => {
  const S = C.freshState(T);
  S.tasks = [{ id: '1', title: 'a', date: T, done: true, priority: false }];
  assert.equal(C.updateAchievements(S, T).length >= 1, true);
  assert.equal(S.achievements.first, T);
  S.tasks = []; C.updateAchievements(S, '2026-11-30');
  assert.equal(S.achievements.first, T);
});

test('migration from v1 preserves data; legacy sample flagged', () => {
  const v1 = { tasks: [{ id: 't1', title: 'Old task', date: '2026-10-01', done: false, priority: true }], habits: [{ id: 'water', name: 'Water', icon: '💧', unit: 'glasses', goal: 6, step: 1, color: '#1c7ed6', builtin: true }],
    logs: { '2026-10-02': { water: 3 } }, journal: [{ id: 'j1', date: '2026-10-02', ts: 1, mood: 4, note: 'hi' }], sample: false };
  const n = C.normalize(v1, T);
  assert.equal(n.state.tasks[0].title, 'Old task'); assert.equal(n.state.logs['2026-10-02'].water, 3);
  assert.equal(n.state.habits[0].createdAt, '2026-10-01'); assert.equal(C.goalOn(n.state.habits[0], '2026-10-02'), 6);
  assert.equal(n.state.journal[0].note, 'hi'); assert.equal(n.legacySample, false);
  assert.equal(C.normalize({ ...v1, sample: true }, T).legacySample, true);
});

test('import validation rejects bad files and sanitises content', () => {
  assert.equal(C.validateImport('', T).ok, false);
  assert.equal(C.validateImport('not json', T).ok, false);
  assert.equal(C.validateImport('[1,2]', T).ok, false);
  assert.equal(C.validateImport('{"hello":1}', T).ok, false);
  assert.equal(C.validateImport('{"app":"Other","data":{}}', T).ok, false);
  assert.equal(C.validateImport('{"app":"LifeBalance","data":{"version":9,"tasks":[]}}', T).ok, false);
  assert.equal(C.validateImport('{"tasks":"x"}', T).ok, false);
  const bad = C.validateImport(JSON.stringify({ tasks: [{ title: 'ok', date: T }, { title: '', date: T }, 5], events: [{ title: 'E', date: 'nope' }] }), T);
  assert.equal(bad.ok, true); assert.equal(bad.summary.tasks, 1); assert.equal(bad.dropped, 3);
  const S = C.demoState(T); const round = C.validateImport(C.exportData(S), T);
  assert.equal(round.ok, true); assert.deepEqual(round.summary, C.summarize(S));
  assert.deepEqual(round.state.events.map(e => e.title), S.events.map(e => e.title));
});

test('demo state is independent and valid', () => {
  const d = C.demoState(T);
  assert.ok(d.events.length === 3 && d.tasks.length > 5);
  assert.equal(C.validateImport(JSON.stringify(d), T).ok, true);
  assert.ok(C.overdueTasks(d, T).length >= 1);
});

test('offset labels', () => {
  assert.equal(C.offsetLabel(20160), '14 days before'); assert.equal(C.offsetLabel(0), 'At event time');
  assert.equal(C.offsetLabel(90), '1 hour 30 minutes before'); assert.equal(C.offsetLabel(2880), '2 days before');
});
