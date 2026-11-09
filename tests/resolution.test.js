import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolutionOf, SCALES, MIN_MIDI, MAX_MIDI } from '../js/data.js';

test('major: stepwise to the nearest Do', () => {
  assert.deepEqual(resolutionOf(0), [0]);
  assert.deepEqual(resolutionOf(12), [12]);
  assert.deepEqual(resolutionOf(2), [2, 0]);
  assert.deepEqual(resolutionOf(5), [5, 4, 2, 0]);
  assert.deepEqual(resolutionOf(7), [7, 9, 11, 12]);
  assert.deepEqual(resolutionOf(9), [9, 11, 12]);
  assert.deepEqual(resolutionOf(11), [11, 12]);
});

test('minor uses the minor scale', () => {
  assert.deepEqual(resolutionOf(5, 'minor'), [5, 3, 2, 0]);
  assert.deepEqual(resolutionOf(8, 'minor'), [8, 10, 12]);
  assert.deepEqual(resolutionOf(7, 'minor'), [7, 8, 10, 12]);
});

test('chromatic notes move to the neighbour in the direction of travel', () => {
  assert.deepEqual(resolutionOf(1), [1, 0]);
  assert.deepEqual(resolutionOf(3), [3, 2, 0]);
  assert.deepEqual(resolutionOf(6), [6, 5, 4, 2, 0]);
  assert.deepEqual(resolutionOf(8), [8, 9, 11, 12]);
  assert.deepEqual(resolutionOf(10), [10, 11, 12]);
});

test('octave-correct', () => {
  assert.deepEqual(resolutionOf(16), [16, 14, 12]);
  assert.deepEqual(resolutionOf(21), [21, 23, 24]);
  assert.deepEqual(resolutionOf(24), [24]);
  assert.deepEqual(resolutionOf(-5), [-5, -3, -1, 0]);
  assert.deepEqual(resolutionOf(-8), [-8, -10, -12]);
});

test('every path ends on Do and moves by at most a minor third', () => {
  for (const mode of Object.keys(SCALES)) {
    for (let o = -24; o <= 36; o++) {
      const p = resolutionOf(o, mode);
      assert.equal(p[0], o);
      assert.equal(((p.at(-1) % 12) + 12) % 12, 0);
      for (let i = 1; i < p.length; i++) {
        assert.ok(Math.abs(p[i] - p[i - 1]) <= 3);
        assert.ok(SCALES[mode].includes(((p[i] % 12) + 12) % 12));
      }
    }
  }
});

test('stays inside the sample range for every key, in either direction', () => {
  for (const mode of Object.keys(SCALES)) {
    for (let tonic = 40; tonic <= 52; tonic++) {
      for (let o = 0; o <= 24; o++) {
        if (tonic + o > MAX_MIDI) continue;
        const p = resolutionOf(o, mode, tonic);
        for (const x of p) assert.ok(tonic + x >= MIN_MIDI && tonic + x <= MAX_MIDI, `${mode} ${tonic} ${o}`);
      }
    }
  }
  // Sol near the top of the range would go up past MAX_MIDI, so it goes down.
  assert.deepEqual(resolutionOf(7, 'major', 66), [7, 5, 4, 2, 0]);
});
