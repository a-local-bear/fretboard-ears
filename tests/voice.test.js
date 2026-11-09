import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceHold, pitchClassCents, voiceCue, voiceMidi, detectPitch, freqToMidi, VOICE } from '../js/pitch.js';
import { levelsFor } from '../js/data.js';

test('pitchClassCents is octave-agnostic and signed', () => {
  assert.equal(pitchClassCents(60, 0), 0);
  assert.equal(pitchClassCents(48, 0), 0);
  assert.equal(Math.round(pitchClassCents(72.3, 0)), 30);
  assert.equal(Math.round(pitchClassCents(59.7, 0)), -30);
  assert.equal(Math.round(pitchClassCents(64.5, 4)), 50);
  assert.equal(Math.round(pitchClassCents(67, 0)), -500);
  assert.equal(Math.abs(pitchClassCents(66, 0)), 600);
});

test('voiceCue words', () => {
  assert.equal(voiceCue(10), 'in tune');
  assert.equal(voiceCue(-40), 'in tune');
  assert.equal(voiceCue(80), 'sharp');
  assert.equal(voiceCue(-80), 'flat');
  assert.equal(voiceCue(300), 'too high');
  assert.equal(voiceCue(-300), 'too low');
});

test('voiceMidi needs a clear, loud enough frame', () => {
  assert.equal(voiceMidi(null), null);
  assert.equal(voiceMidi({ freq: 440, clarity: 0.5, rms: 0.1 }), null);
  assert.equal(voiceMidi({ freq: 440, clarity: 0.95, rms: 0.001 }), null);
  assert.ok(Math.abs(voiceMidi({ freq: 440, clarity: 0.95, rms: 0.1 }) - 69) < 1e-9);
});

test('detectPitch finds a sung-range tone with a harmonic, slightly noisy voice', () => {
  const sr = 44100;
  for (const f of [110, 196, 330, 880]) {
    const buf = new Float32Array(2048);
    for (let i = 0; i < buf.length; i++) {
      const p = (2 * Math.PI * f * i) / sr;
      buf[i] = 0.2 * Math.sin(p) + 0.1 * Math.sin(2 * p) + 0.05 * Math.sin(3 * p) + 0.01 * Math.sin(i * 12.9898);
    }
    const r = detectPitch(buf, sr, { minFreq: VOICE.minFreq, maxFreq: VOICE.maxFreq });
    assert.ok(Math.abs(freqToMidi(r.freq) - freqToMidi(f)) < 0.2, `${f} Hz`);
    assert.ok(voiceMidi(r) != null);
  }
});

const run = (hold, frames, step = 40, t0 = 0) => {
  let last;
  let t = t0;
  for (const m of frames) { last = hold.push(m, t); if (last.done || last.failed) return last; t += step; }
  return last;
};
const rep = (v, n) => Array(n).fill(v);

test('VoiceHold accepts a steady note in any octave after 300 ms', () => {
  assert.equal(run(new VoiceHold(), rep(48.1, 7)).done, false); // 240 ms
  assert.equal(run(new VoiceHold(), rep(48.1, 9)).done, true); // 320 ms, an octave below Do (60)
  const h = new VoiceHold();
  h.reset(7);
  assert.equal(run(h, rep(67.2, 9)).done, true);
});

test('VoiceHold tolerates wobble within 40 cents and a short dropout', () => {
  const wobble = Array.from({ length: 12 }, (_, i) => 60 + 0.3 * Math.sin(i));
  assert.equal(run(new VoiceHold(), wobble).done, true);
  assert.equal(run(new VoiceHold(), [...rep(60, 5), null, ...rep(60, 7)]).done, true);
});

test('VoiceHold restarts after a long break or a wrong note', () => {
  assert.equal(run(new VoiceHold(), [...rep(60, 6), ...rep(null, 5), ...rep(60, 6)]).done, false);
  assert.equal(run(new VoiceHold(), [...rep(60, 5), ...rep(62, 5), ...rep(60, 5)]).done, false);
  assert.equal(run(new VoiceHold(), rep(60.6, 20)).done, false); // 60 cents sharp never counts
});

test('VoiceHold reports a failed attempt after the wrong note then silence', () => {
  const r = run(new VoiceHold(), [...rep(62, 20), ...rep(null, 12)]);
  assert.equal(r.done, false);
  assert.equal(r.failed, true);
  assert.notEqual(run(new VoiceHold(), [...rep(62, 4), ...rep(null, 12)]).failed, true); // a blip is no attempt
  assert.equal(run(new VoiceHold(), rep(63, 100)).failed, true); // singing on without landing
});

test('VoiceHold ignores frames before ignoreUntil', () => {
  const h = new VoiceHold();
  h.reset(0, 400);
  assert.equal(run(h, rep(60, 9)).done, false); // 0..320 ms ignored
  assert.equal(run(h, rep(60, 9), 40, 400).done, true);
});

test('Sing and find levels exist in every chapter with stable ids', () => {
  for (const ch of ['one', 'pA', 'pB', 'pC', 'neck']) {
    const ids = levelsFor(ch).filter((l) => l.family === 'sing').map((l) => l.id);
    assert.deepEqual(ids, ['sing-1', 'sing-2', 'sing-oct', 'sing-p2', 'sing-p3', 'sing-rk'].map((s) => `${ch}-${s}`));
  }
});
