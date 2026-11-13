import test from 'node:test';
import assert from 'node:assert/strict';
import { pluckSamples } from '../public/js/synth.js';
import { createPitchDetector, NoteTracker } from '../public/js/pitch.js';
import { freqToMidi, midiToFreq } from '../public/js/theory.js';

const cents = (a, b) => 1200 * Math.log2(a / b);
const rmsOf = (x, from, n) => { let e = 0; for (let i = from; i < from + n; i++) e += x[i] * x[i]; return Math.sqrt(e / n); };

for (const sampleRate of [48000, 44100]) {
  test(`synth and detector agree on every guitar note at ${sampleRate} Hz`, () => {
    const detect = createPitchDetector(sampleRate);
    for (let midi = 40; midi <= 88; midi++) { // low E to the 24th fret of the 1st string
      const { samples, rate, period } = pluckSamples(midi, sampleRate, 1.2);
      const intrinsic = sampleRate / period;
      // the playback-rate correction lands exactly on pitch
      assert.ok(Math.abs(cents(intrinsic * rate, midiToFreq(midi))) < 0.01, `rate correction for ${midi}`);
      assert.ok(Math.abs(rate - 1) < 0.02, `rate stays close to 1 for ${midi} (${rate})`);
      for (const offset of [0, 3000, Math.floor(sampleRate * 0.6)]) {
        const frame = detect(samples.subarray(offset, offset + detect.needed));
        assert.ok(frame.freq > 0, `no pitch for midi ${midi} at offset ${offset} (clarity ${frame.clarity.toFixed(2)})`);
        const off = cents(frame.freq, intrinsic);
        assert.ok(Math.abs(off) < 3, `midi ${midi} @${offset}: ${frame.freq.toFixed(2)} Hz is ${off.toFixed(1)} cents from ${intrinsic.toFixed(2)}`);
        assert.ok(frame.clarity > 0.85, `clarity for ${midi} @${offset}: ${frame.clarity}`);
      }
    }
  });
}

test('plucked notes have a sane level and decay', () => {
  for (const midi of [40, 52, 64, 76, 88]) {
    const { samples } = pluckSamples(midi, 48000, 2.6);
    let peak = 0;
    for (const v of samples) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak > 0.85 && peak <= 0.9001, `peak ${peak}`);
    const early = rmsOf(samples, 2400, 4800), late = rmsOf(samples, 48000 * 2, 4800);
    assert.ok(late < early * 0.5, `midi ${midi} should decay (early ${early.toFixed(3)}, late ${late.toFixed(3)})`);
    assert.ok(early > 0.05, `midi ${midi} is audible`);
    assert.ok(Math.abs(samples.at(-1)) < 1e-3, 'ends in silence');
    let mean = 0;
    for (const v of samples) mean += v;
    assert.ok(Math.abs(mean / samples.length) < 0.01, 'no DC offset');
  }
});

test('detector survives noise and a thin phone-microphone sound', () => {
  const sampleRate = 48000;
  const detect = createPitchDetector(sampleRate);
  let seed = 12345;
  const noise = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 2147483648 - 1; };
  for (const midi of [40, 41, 43, 45, 47, 48, 50, 52, 55, 59, 64, 67, 72, 76]) {
    const { samples, period } = pluckSamples(midi, sampleRate, 1.0);
    const target = sampleRate / period;
    // a small microphone: two-pole high-pass at 220 Hz strips most of the fundamental of the low strings
    const k = Math.exp((-2 * Math.PI * 220) / sampleRate);
    const thin = new Float32Array(samples.length);
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = k * (y1 + samples[i] - x1); x1 = samples[i]; y1 = a;
      const b = k * (y2 + a - x2); x2 = a; y2 = b;
      thin[i] = b + noise() * 0.01;
    }
    for (const offset of [2000, 9000, 20000]) {
      const frame = detect(thin.subarray(offset, offset + detect.needed));
      assert.ok(frame.freq > 0, `midi ${midi} lost at ${offset}`);
      assert.equal(Math.round(freqToMidi(frame.freq)), Math.round(freqToMidi(target)), `midi ${midi} @${offset} heard as ${frame.freq.toFixed(1)} Hz`);
    }
  }
});

test('silence and plain noise are not mistaken for notes', () => {
  const detect = createPitchDetector(48000);
  assert.equal(detect(new Float32Array(detect.needed)).freq, 0);
  let seed = 99;
  const hiss = Float32Array.from({ length: detect.needed }, () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed / 2147483648 - 1) * 0.2; });
  const frame = detect(hiss);
  assert.ok(frame.freq === 0 || frame.clarity < 0.8, `noise gave freq ${frame.freq} clarity ${frame.clarity}`);
  assert.throws(() => detect(new Float32Array(100)));
});

test('tracker reports each plucked note once, including a repeated note', () => {
  const sampleRate = 48000;
  const detect = createPitchDetector(sampleRate);
  // E4, G4, G4 again, a pause, then low A — like playing a short phrase
  const plan = [[64, 0.10], [67, 0.60], [67, 1.05], [45, 2.2]];
  const total = Math.floor(sampleRate * 3.2);
  const signal = new Float32Array(total);
  plan.forEach(([midi, start], i) => {
    const { samples } = pluckSamples(midi, sampleRate, 2.0);
    const from = Math.floor(start * sampleRate);
    const until = i + 1 < plan.length ? Math.floor(plan[i + 1][1] * sampleRate) : total;
    const stopAt = midi === 67 && i === 2 ? Math.floor(1.6 * sampleRate) : until; // the second G is damped at 1.6 s
    for (let n = from; n < Math.min(stopAt, total, from + samples.length); n++) {
      const fadeOut = Math.min(1, (stopAt - n) / 200);
      signal[n] = samples[n - from] * 0.5 * fadeOut;
    }
  });
  const tracker = new NoteTracker();
  const heard = [];
  const hop = Math.floor(sampleRate * 0.03);
  for (let end = detect.needed; end <= total; end += hop) {
    const note = tracker.push(detect(signal.subarray(end - detect.needed, end)));
    if (note) heard.push([note.midi, +(end / sampleRate).toFixed(2)]);
  }
  assert.deepEqual(heard.map((h) => h[0]), [64, 67, 67, 45], `heard ${JSON.stringify(heard)}`);
  // each note is recognised within a quarter of a second of being played
  heard.forEach(([, at], i) => assert.ok(at - plan[i][1] < 0.25, `note ${i} recognised after ${(at - plan[i][1]).toFixed(2)} s`));
});
