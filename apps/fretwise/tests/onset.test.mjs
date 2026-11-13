import test from 'node:test';
import assert from 'node:assert/strict';
import { pluckSamples } from '../public/js/synth.js';
import { OnsetDetector } from '../public/js/pitch.js';

const rate = 48000, BLOCK = 256;

/** mix notes into a signal and run it through the detector block by block */
function onsetsOf(plan, seconds, { click = [], noise = 0.002 } = {}) {
  const signal = new Float32Array(Math.floor(seconds * rate));
  let seed = 7;
  for (let i = 0; i < signal.length; i++) { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; signal[i] = (seed / 2147483648 - 1) * noise; }
  for (const [midi, start, gain = 0.5] of plan) {
    const { samples } = pluckSamples(midi, rate, 1.5);
    const from = Math.floor(start * rate);
    for (let n = 0; n < samples.length && from + n < signal.length; n++) signal[from + n] += samples[n] * gain;
  }
  for (const [start, freq] of click) { // what audio.click() sounds like: a 45 ms triangle blip
    const from = Math.floor(start * rate);
    for (let n = 0; n < 0.045 * rate; n++) {
      const ph = (n * freq / rate) % 1;
      signal[from + n] += 0.2 * (4 * Math.abs(ph - 0.5) - 1) * (1 - n / (0.045 * rate));
    }
  }
  const det = new OnsetDetector();
  const found = [];
  for (let i = 1; i + BLOCK <= signal.length; i += BLOCK) {
    let e = 0, d = 0;
    for (let k = i; k < i + BLOCK; k++) { e += signal[k] * signal[k]; d += (signal[k] - signal[k - 1]) ** 2; }
    for (const o of det.push(Math.sqrt(e / BLOCK), (i + BLOCK) / rate, Math.sqrt(d / BLOCK))) found.push(o.t);
  }
  return found;
}

test('every pluck is an onset, including the same note again and again', () => {
  // eighth notes at 66 bpm are 0.227 s apart; all on the open G string
  const starts = Array.from({ length: 8 }, (_, i) => 0.3 + i * 0.227);
  const found = onsetsOf(starts.map((t) => [55, t]), 3);
  assert.equal(found.length, 8, `found ${JSON.stringify(found)}`);
  found.forEach((t, i) => assert.ok(t - starts[i] > -0.005 && t - starts[i] < 0.02, `onset ${i} at ${t} for ${starts[i]}`));
});

test('sixteenth notes at 56 bpm, and notes of different strings, are all found', () => {
  const gap = 60 / 56 / 4;
  const plan = [55, 55, 55, 64, 55, 40].map((m, i) => [m, 0.3 + i * gap]);
  assert.equal(onsetsOf(plan, 2).length, 6);
});

test('a second pluck over a still-ringing note counts, a long ring alone does not', () => {
  assert.equal(onsetsOf([[55, 0.2, 0.5], [55, 0.9, 0.5]], 2).length, 2);
  assert.equal(onsetsOf([[55, 0.2, 0.5]], 2.5).length, 1);
});

test('silence and a short metronome click are not onsets, a pluck after one is', () => {
  assert.equal(onsetsOf([], 1).length, 0);
  assert.equal(onsetsOf([], 2, { click: [[0.2, 1560], [0.7, 1040], [1.2, 1040]] }).length, 0);
  const found = onsetsOf([[55, 1.0]], 2, { click: [[0.2, 1560], [0.7, 1040]] });
  assert.equal(found.length, 1);
  assert.ok(Math.abs(found[0] - 1.0) < 0.02);
});

test('a quiet pluck below the gate is ignored', () => {
  assert.equal(onsetsOf([[55, 0.3, 0.01]], 1).length, 0);
});
