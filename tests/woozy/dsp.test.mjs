import assert from 'node:assert/strict';
import { test } from 'node:test';

import { midiHz, renderPluck } from '../../woozy/js/audio/dsp.js';

// Deterministic noise so the test is repeatable.
function lcg(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Fundamental estimate from the autocorrelation peak nearest the expected period.
function estimateHz(data, sampleRate, expectHz) {
  const start = Math.floor(sampleRate * 0.15);
  const size = Math.floor(sampleRate * 0.5);
  const expected = sampleRate / expectHz;
  const corr = (lag) => {
    let sum = 0;
    for (let n = start; n < start + size; n++) sum += data[n] * data[n + lag];
    return sum;
  };
  let best = 0;
  let bestLag = 0;
  for (let lag = Math.floor(expected * 0.9); lag <= Math.ceil(expected * 1.1); lag++) {
    const c = corr(lag);
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }
  // Parabolic interpolation around the peak for sub-sample accuracy.
  const [y0, y1, y2] = [corr(bestLag - 1), corr(bestLag), corr(bestLag + 1)];
  const shift = (y0 - y2) / (2 * (y0 - 2 * y1 + y2));
  return sampleRate / (bestLag + shift);
}

test('plucked notes are in tune across the neck at common sample rates', () => {
  for (const sampleRate of [44100, 48000]) {
    for (const midi of [40, 45, 50, 55, 59, 64, 69, 76, 81, 86]) {
      const { data, rate } = renderPluck(midi, sampleRate, { seconds: 1, random: lcg(midi) });
      const heard = estimateHz(data, sampleRate, midiHz(midi) / rate) * rate;
      const cents = 1200 * Math.log2(heard / midiHz(midi));
      assert.ok(Math.abs(cents) < 4, `midi ${midi} @${sampleRate}: ${cents.toFixed(2)} cents off`);
      assert.ok(Math.abs(rate - 1) < 0.02, `rate correction too large: ${rate}`);
    }
  }
});

test('notes ring, decay, and never blow up', () => {
  for (const midi of [40, 52, 64, 76, 88]) {
    const { data } = renderPluck(midi, 44100, { random: lcg(7) });
    const rms = (from, to) => {
      let s = 0;
      for (let n = Math.floor(from * 44100); n < Math.floor(to * 44100); n++) s += data[n] ** 2;
      return Math.sqrt(s / ((to - from) * 44100));
    };
    const early = rms(0.02, 0.12);
    const later = rms(1.0, 1.1);
    assert.ok(data.every((v) => Number.isFinite(v) && Math.abs(v) <= 1.0001), `midi ${midi} out of range`);
    assert.ok(early > 0.05, `midi ${midi} too quiet at the start (${early})`);
    assert.ok(later < early, `midi ${midi} does not decay`);
    assert.ok(later > early * 0.15, `midi ${midi} dies too fast (${(later / early).toFixed(4)})`);
    assert.equal(Math.abs(data[data.length - 1]), 0);
  }
});
