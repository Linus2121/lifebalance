'use strict';
const test = require('node:test'), assert = require('node:assert');
const { merge3, setAt } = require('../js/merge.js');
const T = (id, title, done) => ({ id, title, done: !!done });

test('changes on different devices are combined without conflicts', () => {
  const base = { tasks: [T('a', 'A'), T('b', 'B')], logs: { d1: { water: 2 } } };
  const local = { tasks: [T('a', 'A', true), T('b', 'B'), T('c', 'C')], logs: { d1: { water: 2 }, d2: { walk: 1 } } };
  const remote = { tasks: [T('a', 'A'), T('b', 'B2')], logs: { d1: { water: 5 } } };
  const r = merge3(base, local, remote);
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(r.merged.tasks.map(t => t.id + ':' + t.title + ':' + t.done), ['a:A:true', 'b:B2:false', 'c:C:false']);
  assert.deepEqual(r.merged.logs, { d1: { water: 5 }, d2: { walk: 1 } });
});
test('the same field edited on both devices keeps mine and records theirs', () => {
  const base = { tasks: [T('a', 'Old')] }, local = { tasks: [T('a', 'Mine')] }, remote = { tasks: [T('a', 'Theirs')] };
  const r = merge3(base, local, remote);
  assert.equal(r.merged.tasks[0].title, 'Mine'); assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].path, 'tasks/#a/title'); assert.equal(r.conflicts[0].theirs, 'Theirs');
  setAt(r.merged, r.conflicts[0].path, r.conflicts[0].theirs); assert.equal(r.merged.tasks[0].title, 'Theirs');
});
test('edit versus delete keeps the edited item and reports it; plain deletes apply', () => {
  const base = { tasks: [T('a', 'A'), T('b', 'B')] };
  const r = merge3(base, { tasks: [T('a', 'A edited'), T('b', 'B')] }, { tasks: [T('b', 'B')] });
  assert.deepEqual(r.merged.tasks.map(t => t.id), ['a', 'b']); assert.equal(r.conflicts.length, 1);
  const r2 = merge3(base, { tasks: [T('a', 'A')] }, { tasks: [T('a', 'A'), T('b', 'B')] });
  assert.deepEqual(r2.merged.tasks.map(t => t.id), ['a']); assert.equal(r2.conflicts.length, 0);
  const r3 = merge3(base, { tasks: [T('b', 'B')] }, { tasks: [T('b', 'B edited')] }); assert.equal(r3.merged.tasks[0].title, 'B edited');
});
test('plain-value lists merge as sets', () => {
  const r = merge3({ fav: ['x', 'y'] }, { fav: ['x', 'y', 'l'] }, { fav: ['y', 'r'] });
  assert.deepEqual(r.merged.fav.sort(), ['l', 'r', 'y']); assert.equal(r.conflicts.length, 0);
});
test('first connection (empty base) unions both sides; ignored areas never conflict', () => {
  const r = merge3({}, { tasks: [T('a', 'A')], draft: { note: 'mine' } }, { tasks: [T('b', 'B')], draft: { note: 'theirs' } }, { ignore: ['draft'] });
  assert.deepEqual(r.merged.tasks.map(t => t.id), ['a', 'b']); assert.equal(r.merged.draft.note, 'mine'); assert.equal(r.conflicts.length, 0);
});
test('identical changes on both sides are not conflicts', () => {
  const r = merge3({ s: { x: 1 } }, { s: { x: 2 } }, { s: { x: 2 } }); assert.equal(r.conflicts.length, 0); assert.equal(r.merged.s.x, 2);
});
