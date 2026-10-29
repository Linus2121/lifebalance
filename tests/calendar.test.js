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
