// Plucked-string synthesis (Karplus–Strong).  Pure maths, no Web Audio — the
// audio module wraps the result in AudioBuffers, and the tests use it as a
// stand-in for a real guitar when checking the pitch detector.

import { midiToFreq } from './theory.js';
import { clamp } from './util.js';

/**
 * One plucked note.
 * Returns {samples, rate}: play `samples` at `rate` × normal speed to land
 * exactly on pitch (the delay line can only be a whole number of samples long).
 */
export function pluckSamples(midi, sampleRate, seconds = 2.6) {
  const freq = midiToFreq(midi);
  // The loop below averages each sample with the one *after* it, so the string
  // repeats every (period - 0.5) samples.
  const period = Math.max(3, Math.round(sampleRate / freq + 0.5));
  const truePeriod = period - 0.5;
  const length = Math.floor(sampleRate * seconds);
  const out = new Float32Array(length);
  const ring = new Float32Array(period);

  // Excitation: a burst of noise, low-passed relative to the pitch so that low
  // strings are not buzzy.  The noise is seeded: a note always sounds the same.
  let seed = (midi * 2654435761) >>> 0;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const cutoff = clamp(freq * 7, 700, 5200);
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  let a = 0, b = 0, mean = 0;
  for (let i = 0; i < period * 3; i++) { // run the filter in before filling the string
    a += k * (noise() - a);
    b += k * (a - b);
    if (i >= period * 2) { ring[i - period * 2] = b; mean += b; }
  }
  mean /= period;
  for (let i = 0; i < period; i++) ring[i] -= mean;

  // Loop loss chosen so low strings ring for about 3 s and high notes about 1.4 s.
  const t60 = 3.2 - 1.8 * clamp((midi - 40) / 48, 0, 1);
  const perPeriod = 0.001 ** (1 / (t60 * freq));
  const loss = Math.min(0.9996, perPeriod / Math.cos((Math.PI * freq) / sampleRate));

  let idx = 0, peak = 1e-9;
  for (let n = 0; n < length; n++) {
    const next = idx + 1 === period ? 0 : idx + 1;
    const v = ring[idx];
    out[n] = v;
    ring[idx] = loss * 0.5 * (v + ring[next]);
    idx = next;
    const m = v < 0 ? -v : v;
    if (m > peak) peak = m;
  }
  const fade = Math.floor(sampleRate * 0.08);
  for (let n = 0; n < length; n++) {
    let g = 0.9 / peak;
    if (n > length - fade) g *= (length - n) / fade;
    out[n] *= g;
  }
  return { samples: out, rate: (freq * truePeriod) / sampleRate, period: truePeriod };
}
