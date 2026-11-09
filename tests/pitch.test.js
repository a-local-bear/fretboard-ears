import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, freqToMidi, matchDegree, NoteTracker } from '../js/pitch.js';
import { renderPluck, midiToFreq } from '../js/ks.js';
import { mulberry32 } from '../js/deck.js';
import { CHAPTERS, midiOf } from '../js/data.js';

const SR = 48000;
const N = 2048;
const cents = (f, target) => 1200 * Math.log2(f / target);

function wave(f, shape = 'sine', offset = 0) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const ph = (f * (i + offset)) / SR;
    b[i] = shape === 'sine' ? 0.3 * Math.sin(2 * Math.PI * ph) : 0.3 * (2 * (ph - Math.floor(ph + 0.5)));
  }
  return b;
}

test('sine waves across the guitar range are detected within 3 cents', () => {
  for (let m = 40; m <= 76; m++) {
    const f = midiToFreq(m);
    const r = detectPitch(wave(f), SR);
    assert.ok(r, `no pitch for MIDI ${m}`);
    assert.ok(Math.abs(cents(r.freq, f)) < 3, `MIDI ${m}: ${cents(r.freq, f).toFixed(1)} cents`);
    assert.ok(r.clarity > 0.95);
  }
});

test('harmonic-rich sawtooth: no octave errors', () => {
  for (let m = 40; m <= 76; m += 3) {
    const f = midiToFreq(m);
    const r = detectPitch(wave(f, 'saw'), SR);
    assert.ok(Math.abs(cents(r.freq, f)) < 10, `MIDI ${m}: ${cents(r.freq, f).toFixed(1)} cents`);
  }
});

test('plucked strings (Karplus–Strong) for every note the app uses', () => {
  const used = [...new Set(CHAPTERS.flatMap((c) => c.notes.map(midiOf)))];
  for (const m of used) {
    const f = midiToFreq(m);
    const y = renderPluck(f, SR, { rng: mulberry32(m) });
    // A window shortly after the attack and one well into the decay.
    for (const start of [Math.round(SR * 0.05), Math.round(SR * 0.6)]) {
      const r = detectPitch(y.subarray(start, start + N), SR);
      assert.ok(r, `no pitch for MIDI ${m}`);
      // KS buffers render up to a few cents flat (the app corrects with playbackRate), so compare notes.
      assert.equal(Math.round(freqToMidi(r.freq)), m, `MIDI ${m} at ${start}`);
    }
  }
});

test('silence gives null; noise has low clarity', () => {
  assert.equal(detectPitch(new Float32Array(N), SR), null);
  const rng = mulberry32(1);
  const noise = Float32Array.from({ length: N }, () => (rng() * 2 - 1) * 0.3);
  const r = detectPitch(noise, SR);
  assert.ok(r === null || r.clarity < 0.9, `noise clarity ${r?.clarity}`);
});

test('matchDegree: any octave, outside notes have no degree, Do vs Do\' by nearness', () => {
  const pattern = [48, 50, 52, 53, 55, 57, 59, 60]; // Pattern I, C3–C4
  const level3 = [48, 50, 52]; // Do Re Mi
  assert.deepEqual(matchDegree(52.1, level3), { nearest: 52, cents: 10, degree: 2 });
  assert.equal(matchDegree(64, level3).degree, 2, 'E an octave up is still Mi');
  assert.equal(matchDegree(55, level3).degree, null, 'Sol is not in level 3');
  assert.equal(matchDegree(48, pattern).degree, 0, 'C3 → Do');
  assert.equal(matchDegree(60, pattern).degree, 7, "C4 → Do'");
  assert.equal(matchDegree(72, pattern).degree, 7, "C5 → Do' (nearer)");
  assert.equal(matchDegree(36, pattern).degree, 0, 'C2 → Do (nearer)');
  const sparse = [];
  sparse[0] = 48; sparse[1] = 50;
  assert.equal(matchDegree(50, sparse).degree, 1);
});

test('NoteTracker fires once per note, again after silence, a new pluck or a new note', () => {
  const t = new NoteTracker({ stableFrames: 3 });
  const f = (midi, rms = 0.05, clarity = 0.97) => t.push({ midi, rms, clarity });
  assert.equal(f(52.02), null);
  assert.equal(f(51.98), null);
  assert.equal(f(52.01), 52, 'fires after 3 stable frames');
  assert.equal(f(52), null, 'sustain does not refire');
  assert.equal(f(52), null);
  assert.equal(f(52, 0.001), null, 'silence');
  assert.equal(f(52), null);
  assert.equal(f(52), null);
  assert.equal(f(52), 52, 'fires again after silence');
  assert.equal(f(52, 0.2), null, 'new pluck resets the count');
  assert.equal(f(52, 0.2), null);
  assert.equal(f(52, 0.2), 52, 'fires for the new pluck');
  assert.equal(f(55, 0.15), null);
  assert.equal(f(55, 0.12), null);
  assert.equal(f(55, 0.1), 55, 'a different note fires without silence');
  assert.equal(f(55.5, 0.1), null, 'out of tune (50 cents) is ignored');
  assert.equal(f(57, 0.1, 0.5), null, 'low clarity is ignored');
});

test('NoteTracker after reset({requireOnset}) ignores a note that is already ringing', () => {
  const t = new NoteTracker({ stableFrames: 3 });
  t.reset({ requireOnset: true });
  const f = (midi, rms) => t.push({ midi, rms, clarity: 0.97 });
  for (const rms of [0.05, 0.045, 0.04, 0.036, 0.032]) assert.equal(f(57, rms), null, 'decaying old note');
  assert.equal(f(52, 0.03), null, 'pitch change without a pluck');
  assert.equal(f(52, 0.028), null);
  assert.equal(f(52, 0.026), null, 'still not armed');
  assert.equal(f(55, 0.2), null, 'new pluck');
  assert.equal(f(55, 0.18), null);
  assert.equal(f(55, 0.16), 55, 'fires after a pluck');
});
