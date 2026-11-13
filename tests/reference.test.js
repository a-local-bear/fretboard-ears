import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceFor } from '../js/reference.js';

test('each: every round gets the reference', () => {
  for (const r of [0, 1, 9]) assert.equal(referenceFor({ ref: 'cadence', refWhen: 'each' }, r), 'cadence');
});
test('level: only the first round gets it', () => {
  assert.equal(referenceFor({ ref: 'cadence', refWhen: 'level' }, 0), 'cadence');
  assert.equal(referenceFor({ ref: 'do', refWhen: 'level' }, 0), 'do');
  assert.equal(referenceFor({ ref: 'cadence', refWhen: 'level' }, 1), 'none');
});
test('none stays none', () => {
  assert.equal(referenceFor({ ref: 'none', refWhen: 'level' }, 0), 'none');
});

test('drone: held under the note, but the root alone while the mic is on', () => {
  assert.equal(referenceFor({ ref: 'drone', refWhen: 'each', mic: false }, 3), 'drone');
  assert.equal(referenceFor({ ref: 'drone', refWhen: 'each', mic: true }, 3), 'do');
  assert.equal(referenceFor({ ref: 'drone', refWhen: 'level', mic: false }, 1), 'none');
});
