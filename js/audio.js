// Web Audio playback. Everything is scheduled on the AudioContext clock.

import { renderPluck, ksParams, midiToFreq } from './ks.js';
import { CHORDS, CADENCE } from './data.js';

let ctx = null;
let out = null; // input of the shared chain: lowpass → master → compressor → destination
const buffers = new Map(); // midi → { buffer, rate }
const voices = new Set(); // { src, gain }

const CHORD_GAP = 0.7; // seconds between cadence chords
const CADENCE_TO_NOTE = 1.15;
const DO_TO_NOTE = 0.9;
const STRUM_STEP = 0.022;

/** Create or resume the context. Call from a user gesture (required on mobile). */
export function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4500;
    const master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    lp.connect(master).connect(comp).connect(ctx.destination);
    out = lp;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const now = () => (ctx ? ctx.currentTime : 0);

function getBuffer(midi) {
  let b = buffers.get(midi);
  if (!b) {
    const f = midiToFreq(midi);
    const data = renderPluck(f, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buffer.copyToChannel(data, 0);
    b = { buffer, rate: ksParams(f, ctx.sampleRate).rate };
    buffers.set(midi, b);
  }
  return b;
}

/** Render buffers ahead of time in idle slices so the first play never stutters. */
export function prerender(midis) {
  if (!ctx) return;
  const todo = [...new Set(midis)].filter((m) => !buffers.has(m));
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 16));
  const step = () => {
    const m = todo.shift();
    if (m == null) return;
    getBuffer(m);
    idle(step);
  };
  idle(step);
}

/** Play one note at context time `when`; returns the voice. */
export function playNote(midi, when = now(), gain = 0.9) {
  if (!ctx) return null;
  const { buffer, rate } = getBuffer(midi);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(out);
  src.start(Math.max(when, ctx.currentTime));
  const voice = { src, gain: g };
  voices.add(voice);
  src.onended = () => voices.delete(voice);
  return voice;
}

function fadeVoice(v, at, dur) {
  try {
    v.gain.gain.cancelScheduledValues(at);
    v.gain.gain.setValueAtTime(v.gain.gain.value, at);
    v.gain.gain.linearRampToValueAtTime(0, at + dur);
    v.src.stop(at + dur + 0.02);
  } catch { /* already stopped */ }
}

/** Fade out everything currently sounding or scheduled. */
export function stopAll(dur = 0.06) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const v of voices) fadeVoice(v, t, dur);
  voices.clear();
}

function strum(notes, when, gain = 0.38) {
  return notes.map((m, i) => playNote(m, when + i * STRUM_STEP, gain));
}

/**
 * Play the reference for `mode` ('cadence' | 'do' | 'none') starting now.
 * Returns the context time at which the mystery note should start.
 * Reference voices fade as the mystery note begins so it stands alone.
 */
export function playReference(mode, doMidi) {
  const t0 = now() + 0.05;
  let refVoices = [];
  let noteAt = t0;
  if (mode === 'cadence') {
    CADENCE.forEach((name, i) => { refVoices = refVoices.concat(strum(CHORDS[name], t0 + i * CHORD_GAP)); });
    noteAt = t0 + (CADENCE.length - 1) * CHORD_GAP + CADENCE_TO_NOTE;
  } else if (mode === 'do') {
    refVoices.push(playNote(doMidi, t0));
    noteAt = t0 + DO_TO_NOTE;
  }
  for (const v of refVoices) if (v) fadeVoice(v, noteAt - 0.05, 0.25);
  return noteAt;
}

/** Do-Mi-Sol-Do arpeggio for a pass. */
export function playArpeggio(midis) {
  const t = now() + 0.05;
  midis.forEach((m, i) => playNote(m, t + i * 0.16, 0.7));
}
