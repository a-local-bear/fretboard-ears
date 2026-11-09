import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beatSeconds, chordSeconds, loopEvents, cycleSeconds, dueEvents, BAR_PATTERN } from '../js/sequencer.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('tempo maths', () => {
  near(beatSeconds(120), 0.5);
  near(chordSeconds(120, 1), 2);
  near(chordSeconds(60, 2), 8);
  near(cycleSeconds(4, 120, 2), 16);
});

test('loopEvents: strums of every chord, in order, inside the cycle', () => {
  const ev = loopEvents(3, 120, 2);
  assert.equal(ev.length, 3 * 2 * BAR_PATTERN.length);
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].t > ev[i - 1].t);
  assert.ok(ev[ev.length - 1].t < cycleSeconds(3, 120, 2));
  assert.deepEqual(ev.filter((e) => e.change).map((e) => [e.chord, e.t]), [[0, 0], [1, 4], [2, 8]]);
  assert.deepEqual([...new Set(ev.map((e) => e.chord))], [0, 1, 2]);
});

test('dueEvents: only what falls inside the lookahead window, none twice', () => {
  const ev = loopEvents(2, 120, 1); // strums at 0, 1, 1.75 | 2, 3, 3.75
  const cycle = cycleSeconds(2, 120, 1);
  let r = dueEvents(ev, cycle, 10, 0, 10, 0.5);
  assert.deepEqual(r.due.map((e) => e.time), [10]);
  r = dueEvents(ev, cycle, 10, r.next, 10.6, 0.5); // window up to 11.1
  assert.deepEqual(r.due.map((e) => e.time), [11]);
  r = dueEvents(ev, cycle, 10, r.next, 10.7, 0.5); // nothing new
  assert.equal(r.due.length, 0);
});

test('dueEvents: loops forever with absolute times', () => {
  const ev = loopEvents(2, 120, 1);
  const cycle = cycleSeconds(2, 120, 1); // 4s
  const r = dueEvents(ev, cycle, 0, 0, 0, 9); // up to t < 9
  assert.deepEqual(r.due.map((e) => e.time), [0, 1, 1.75, 2, 3, 3.75, 4, 5, 5.75, 6, 7, 7.75, 8]);
  assert.deepEqual(r.due.map((e) => e.chord), [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0]);
  assert.equal(r.next, 13);
});

test('dueEvents: a late tick catches up on everything missed', () => {
  const ev = loopEvents(2, 120, 1);
  const r = dueEvents(ev, 4, 0, 0, 3.2, 0.25); // first call arrives at 3.2s
  assert.deepEqual(r.due.map((e) => e.time), [0, 1, 1.75, 2, 3]);
});
