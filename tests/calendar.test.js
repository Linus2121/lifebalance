const test = require('node:test'), assert = require('node:assert');
const C = require('../js/core.js'), Cal = require('../js/calendar.js');

const S = C.freshState('2026-03-01');
const timed = { evId: 'e1', key: '2026-03-10', date: '2026-03-10', endDate: '2026-03-10', allDay: false, startTime: '14:30', endTime: '15:15', tz: 'Europe/London', title: 'GP, check; up', category: 'GP', location: 'Clinic', notes: 'Line1\nLine2', contact: { name: 'Dr A', phone: '', email: '' }, bookingRef: 'B1', cancelled: false };

test('timed event exports UTC with escaping', () => {
  const ics = Cal.build(C, [timed], Date.UTC(2026, 0, 1));
  assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /DTSTART:20260310T143000Z/); assert.match(ics, /DTEND:20260310T151500Z/);
  assert.match(ics, /SUMMARY:GP\\, check\\; up/); assert.match(ics, /DESCRIPTION:Line1\\nLine2/); assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
test('daylight saving: London summer time is UTC+1', () => {
  const ics = Cal.build(C, [Object.assign({}, timed, { date: '2026-06-10', endDate: '2026-06-10', key: '2026-06-10' })], 0);
  assert.match(ics, /DTSTART:20260610T133000Z/);
});
test('all-day multi-day uses exclusive end date', () => {
  const ics = Cal.build(C, [Object.assign({}, timed, { allDay: true, endDate: '2026-03-12' })], 0);
  assert.match(ics, /DTSTART;VALUE=DATE:20260310/); assert.match(ics, /DTEND;VALUE=DATE:20260313/);
});
test('cancelled occurrences are skipped and long lines folded', () => {
  const ics = Cal.build(C, [Object.assign({}, timed, { cancelled: true }), Object.assign({}, timed, { notes: 'x'.repeat(300), key: 'k2' })], 0);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  ics.split('\r\n').forEach(l => assert.ok(l.length <= 75));
});
test('calendar links contain title and dates', () => {
  assert.match(Cal.googleUrl(C, timed), /calendar\.google\.com.*dates=20260310T143000Z%2F|dates=20260310T143000Z\/20260310T151500Z/);
  assert.match(Cal.outlookUrl(C, timed), /subject=GP%2C%20check/);
});

test('selected reminder alarms become VALARMs; opt-out and none omit them', () => {
  const ev = Object.assign({}, timed, { offsets: [1440, 30, 0, 30] });
  const ics = Cal.build(C, [ev], 0);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 3);
  assert.match(ics, /TRIGGER:-PT1440M/); assert.match(ics, /TRIGGER:-PT30M/); assert.match(ics, /TRIGGER:-PT0M/);
  assert.equal((Cal.build(C, [ev], 0, { alarms: false }).match(/VALARM/g) || []).length, 0);
  assert.equal((Cal.build(C, [timed], 0).match(/VALARM/g) || []).length, 0);
});
test('recurring series: cancelled and moved occurrences export correctly', () => {
  const S2 = C.freshState('2026-03-01');
  const ev = { id: 'r1', title: 'Weekly', category: 'Meetings', allDay: false, date: '2026-03-02', endDate: '2026-03-02', startTime: '09:00', endTime: '10:00', tz: 'Europe/London', recurrence: { freq: 'weekly', interval: 1 }, reminders: { offsets: [30] }, exceptions: { '2026-03-09': { cancelled: true }, '2026-03-16': { date: '2026-03-17', startTime: '11:00', endTime: '12:00' } } };
  S2.events.push(ev);
  const occ = C.allOccurrences(S2, '2026-03-01', '2026-03-31');
  const ics = Cal.build(C, occ, 0);
  assert.ok(occ.length >= 4);
  assert.ok(!/DTSTART:20260309T/.test(ics), 'cancelled occurrence skipped');
  assert.match(ics, /DTSTART:20260317T110000Z/);
  assert.match(ics, /DTSTART:20260302T090000Z/);
  assert.ok((ics.match(/VALARM/g) || []).length >= 6);
});
test('time zones: New York and Tokyo convert to UTC; DST switch date is respected', () => {
  const ny = Cal.build(C, [Object.assign({}, timed, { tz: 'America/New_York', date: '2026-03-07', endDate: '2026-03-07', startTime: '09:00', endTime: '10:00' })], 0);
  const ny2 = Cal.build(C, [Object.assign({}, timed, { tz: 'America/New_York', date: '2026-03-09', endDate: '2026-03-09', startTime: '09:00', endTime: '10:00' })], 0);
  assert.match(ny, /DTSTART:20260307T140000Z/); assert.match(ny2, /DTSTART:20260309T130000Z/);
  const tk = Cal.build(C, [Object.assign({}, timed, { tz: 'Asia/Tokyo', startTime: '09:00', endTime: '10:00' })], 0);
  assert.match(tk, /DTSTART:20260310T000000Z/);
});
