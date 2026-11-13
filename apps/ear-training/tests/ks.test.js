import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ksParams, renderPluck, midiToFreq } from '../public/js/ks.js';
import { mulberry32 } from '../public/js/deck.js';
import { POSITIONS, OPEN, midiOf } from '../public/js/data.js';

test('midiToFreq: A4 = 440 Hz, C4 ≈ 261.63 Hz', () => {
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(60) - 261.6256) < 1e-3);
});

test('playback rate corrects the pitch exactly for every note we use', () => {
  for (const sr of [44100, 48000]) {
    for (let midi = 36; midi <= 76; midi++) {
      const f = midiToFreq(midi);
      const { N, rate } = ksParams(f, sr);
      const rendered = sr / (N + 0.5);
      assert.ok(Math.abs(rendered * rate - f) < 1e-9, `midi ${midi} @ ${sr}`);
      assert.ok(Math.abs(rate - 1) < 0.02, `rate close to 1 (midi ${midi}: ${rate})`);
    }
  }
});

test('decay: rho^(f·3.2) = 10^-3 (60 dB over 3.2 s)', () => {
  const f = 261.63;
  const { rho } = ksParams(f, 48000);
  assert.ok(Math.abs(Math.log10(rho ** (f * 3.2)) + 3) < 1e-9);
});

test('rendered buffer is peak-normalised, finite and fades to silence', () => {
  const y = renderPluck(220, 44100, { rng: mulberry32(3) });
  let peak = 0;
  for (const v of y) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); }
  assert.ok(Math.abs(peak - 1) < 1e-6);
  assert.equal(Math.abs(y[y.length - 1]), 0);
});

test('position pitch ranges match the spec', () => {
  const range = (id) => {
    const c = POSITIONS.find((x) => x.id === id);
    return [midiOf(c.notes[0]), midiOf(c.notes[7])];
  };
  assert.deepEqual(range('E'), [48, 60]); // C3–C4
  assert.deepEqual(range('A'), [48, 60]);
  assert.deepEqual(range('D'), [60, 72]); // C4–C5
  assert.equal(OPEN.length, 6);
});

test('every box is a C major scale (W W H W W W H)', () => {
  for (const c of POSITIONS.filter((c) => c.notes.length)) {
    const m = c.notes.map(midiOf);
    const steps = m.slice(1).map((v, i) => v - m[i]);
    assert.deepEqual(steps, [2, 2, 1, 2, 2, 2, 1], c.id);
  }
});
