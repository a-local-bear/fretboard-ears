// Web Audio playback for Songcraft: guitar notes (the shared samples, with the plucked-string
// synth until they load), a small drum kit, and a looping step sequencer on the audio clock.

import { renderPluck, ksParams, midiToFreq } from '../../js/ks.js';
import { loadSample, SAMPLE_RANGE } from '../../js/samples.js';

const SITE_ROOT = new URL('../../', import.meta.url).href;
const STRUM_STEP = 0.018; // seconds between the strings of a strum
const DAMP = 0.06;
const TICK_MS = 40; // the scheduler only looks ahead; it does not time the notes
const AHEAD = 0.25;
const LEAD = 0.12;

let ctx = null;
let out = null; // guitar bus: lowpass → master
let master = null;
let noise = null;
const samples = new Map();
const synth = new Map();
const voices = new Set();
let tr = null; // the running transport

/** Create or resume the context. Call from a user gesture (required on mobile). */
export function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;
    master = ctx.createGain();
    master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    lp.connect(master).connect(comp).connect(ctx.destination);
    out = lp;
    const len = Math.round(ctx.sampleRate * 0.3);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    for (let m = SAMPLE_RANGE[0]; m <= SAMPLE_RANGE[1]; m++) {
      loadSample(ctx, m, SITE_ROOT).then((entry) => { if (entry) samples.set(m, entry); });
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const now = () => (ctx ? ctx.currentTime : 0);

function source(midi) {
  const s = samples.get(midi);
  if (s) return s;
  let b = synth.get(midi);
  if (!b) {
    const f = midiToFreq(midi);
    const data = renderPluck(f, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buffer.copyToChannel(data, 0);
    b = { buffer, rate: ksParams(f, ctx.sampleRate).rate, gain: 1 };
    synth.set(midi, b);
  }
  return b;
}

/** Play one note at context time `when`; returns the voice. */
export function playNote(midi, when = now(), gain = 0.8) {
  if (!ctx) return null;
  const { buffer, rate, gain: level } = source(midi);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain * level;
  src.connect(g).connect(out);
  const start = Math.max(when, ctx.currentTime);
  src.start(start);
  const voice = { src, g, level: gain * level };
  voices.add(voice);
  src.onended = () => voices.delete(voice);
  return voice;
}

function fade(v, at, dur = DAMP) {
  if (!v) return;
  try {
    const t = Math.max(at, ctx.currentTime);
    if (v.endAt != null && v.endAt <= t + dur) return; // already fading out sooner
    v.endAt = t + dur;
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(v.level, t);
    v.g.gain.linearRampToValueAtTime(0, t + dur);
    v.src.stop(t + dur + 0.02);
  } catch { /* already stopped */ }
}

/** Strum notes in the order given, one string after another. */
export function strum(notes, when = now() + 0.02, gain = 0.28) {
  return ctx ? notes.map((m, i) => playNote(m, when + i * STRUM_STEP, gain)) : [];
}

function drum(kind, when, gain) {
  const g = ctx.createGain();
  g.connect(master);
  if (kind === 'kick') {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(130, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    o.connect(g);
    o.start(when);
    o.stop(when + 0.24);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  const snare = kind === 'snare';
  f.type = snare ? 'bandpass' : 'highpass';
  f.frequency.value = snare ? 1900 : 7500;
  const dur = snare ? 0.13 : 0.045;
  g.gain.setValueAtTime(gain * (snare ? 0.7 : 0.5), when);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  src.connect(f).connect(g);
  src.start(when);
  src.stop(when + dur + 0.02);
}

// ---------- transport ----------

export const playing = () => !!tr;

/**
 * Loop a compiled track (song.js compile()) until stop(). `onStep(step)` is called as each step
 * is heard, from an animation frame.
 */
export function play(track, bpm, onStep = null) {
  if (!ctx) return false;
  stop();
  const t = { track, bpm, base: ctx.currentTime + LEAD, next: 0, chord: [], mel: null, queue: [], onStep, timer: null, raf: 0 };
  tr = t;
  const tick = () => {
    if (tr !== t) return;
    while (t.base < ctx.currentTime + AHEAD) {
      const dur = 60 / t.bpm / 2;
      const step = t.next % t.track.steps;
      const at = t.base + (t.next % 2 ? t.track.swing * dur : 0);
      for (const e of t.track.events[step] || []) {
        if (e.k === 'strum') {
          if (!e.up) { t.chord.forEach((v) => fade(v, at - 0.04)); t.chord = []; }
          const played = strum(e.notes, at, e.gain);
          if (e.len) played.forEach((v) => fade(v, at + e.len * dur, 0.08));
          t.chord.push(...played);
        } else if (e.k === 'pick') {
          if (e.first) { t.chord.forEach((v) => fade(v, at - 0.04)); t.chord = []; }
          t.chord.push(playNote(e.midi, at, e.gain));
        } else if (e.k === 'mel') {
          fade(t.mel, at - 0.01, 0.03);
          t.mel = playNote(e.midi, at, 0.85);
          fade(t.mel, at + e.len * dur * 0.97, 0.16);
        } else drum(e.k, at, e.gain);
      }
      t.queue.push({ step, at });
      t.next++;
      t.base += dur;
    }
  };
  const frame = () => {
    if (tr !== t) return;
    while (t.queue.length && t.queue[0].at <= ctx.currentTime) {
      const { step } = t.queue.shift();
      if (t.onStep) t.onStep(step);
    }
    t.raf = requestAnimationFrame(frame);
  };
  tick();
  t.timer = setInterval(tick, TICK_MS);
  t.raf = requestAnimationFrame(frame);
  return true;
}

/** Swap the track of the running loop (after an edit); the beat carries on. */
export function setTrack(track) {
  if (tr) tr.track = track;
}

export function setTempo(bpm) {
  if (tr) tr.bpm = bpm;
}

/** Stop the loop and fade out everything sounding. */
export function stop() {
  if (tr) {
    clearInterval(tr.timer);
    cancelAnimationFrame(tr.raf);
    tr = null;
  }
  if (!ctx) return;
  for (const v of [...voices]) fade(v, ctx.currentTime, 0.1);
  voices.clear();
}
