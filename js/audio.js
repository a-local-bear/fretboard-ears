// Web Audio playback. Everything is scheduled on the AudioContext clock.

import { renderPluck, ksParams, midiToFreq } from './ks.js';
import { CHORDS, CADENCE, CHAPTERS, midiOf } from './data.js';
import { loadSample } from './samples.js';

let ctx = null;
let out = null; // input of the shared chain: lowpass → master → compressor → destination
let sound = 'guitar'; // 'guitar' (recorded samples) | 'synth' (Karplus–Strong)
const buffers = new Map(); // midi → synth entry { buffer, rate, gain }
const samples = new Map(); // midi → decoded sample entry { buffer, rate, gain }
const voices = new Set(); // { src, gain, endAt }
let fadingUntil = 0; // end of the latest stopAll() fade
let noteLimit = null; // seconds; set while the mic listens so notes don't ring for long

const CHORD_GAP = 0.7; // seconds between cadence chords
const CADENCE_TO_NOTE = 1.15;
const DO_TO_NOTE = 0.9;
const STRUM_STEP = 0.022;
const CHORD_DAMP = 0.05; // seconds of fade on the old chord at a chord change
const DRONE_LEAD = 1.4; // seconds the drone sounds alone before the mystery note
const DRONE_GAIN = 0.075; // per oscillator; soft, a bed rather than a note
const DRONE_FADE = 0.3;

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
    applyTone();
    // Start loading every note the app uses, so samples are ready before the first level.
    const used = CHAPTERS.flatMap((c) => c.notes.map(midiOf)).concat(Object.values(CHORDS).flat());
    if (sound === 'guitar') loadSamples(used);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const now = () => (ctx ? ctx.currentTime : 0);
export const getContext = () => ctx;

/** Cap how long any note rings (null = natural length). Used while the mic is listening. */
export function setNoteLimit(seconds) {
  noteLimit = seconds;
}

/** Context time when everything the app has played or scheduled will have finished. */
export function quietAt() {
  let t = fadingUntil;
  for (const v of voices) t = Math.max(t, v.endAt);
  return t;
}

/** Samples need less high-cut than the synth. */
function applyTone() {
  if (out) out.frequency.value = sound === 'guitar' ? 9000 : 4500;
}

/** Switch between recorded samples and the synth. */
export function setSound(mode) {
  sound = mode === 'synth' ? 'synth' : 'guitar';
  applyTone();
}

function loadSamples(midis) {
  for (const m of new Set(midis)) {
    if (samples.has(m)) continue;
    loadSample(ctx, m).then((entry) => { if (entry) samples.set(m, entry); });
  }
}

function getBuffer(midi) {
  let b = buffers.get(midi);
  if (!b) {
    const f = midiToFreq(midi);
    const data = renderPluck(f, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buffer.copyToChannel(data, 0);
    b = { buffer, rate: ksParams(f, ctx.sampleRate).rate, gain: 1 };
    buffers.set(midi, b);
  }
  return b;
}

/** The entry to play: the sample in guitar mode once it's loaded, otherwise the synth. */
function getVoiceSource(midi) {
  return (sound === 'guitar' && samples.get(midi)) || getBuffer(midi);
}

/**
 * Get notes ready ahead of time: load samples (guitar mode) and render synth buffers in idle
 * slices (always, as the fallback) so the first play never stutters.
 */
export function prerender(midis) {
  if (!ctx) return;
  if (sound === 'guitar') loadSamples(midis);
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
  const { buffer, rate, gain: level } = getVoiceSource(midi);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain * level;
  src.connect(g).connect(out);
  const start = Math.max(when, ctx.currentTime);
  src.start(start);
  const voice = { src, gain: g, endAt: start + buffer.duration / rate };
  voices.add(voice);
  src.onended = () => voices.delete(voice);
  if (noteLimit && voice.endAt > start + noteLimit) fadeVoice(voice, start + noteLimit, 0.15);
  return voice;
}

function fadeVoice(v, at, dur) {
  v.endAt = Math.min(v.endAt, at + dur);
  try {
    v.gain.gain.cancelScheduledValues(at);
    v.gain.gain.setValueAtTime(v.gain.gain.value, at);
    v.gain.gain.linearRampToValueAtTime(0, at + dur);
    v.src.stop(at + dur + 0.02);
  } catch { /* already stopped */ }
}

/**
 * Fade out everything currently sounding or scheduled; with `keepDrone` the drone carries on
 * (it is the one voice that has no natural end).
 */
export function stopAll(dur = 0.06, keepDrone = false) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const v of [...voices]) {
    if (keepDrone && v.drone) continue;
    const d = v.drone ? Math.max(dur, DRONE_FADE) : dur;
    fadeVoice(v, t, d);
    voices.delete(v);
    fadingUntil = Math.max(fadingUntil, t + d);
  }
}

/** True while a drone is sounding. */
export const droneActive = () => [...voices].some((v) => v.drone && v.endAt === Infinity);

/**
 * A soft sustained root + fifth (triangle oscillators) from context time `when`. It rings until
 * stopAll() or, with `until`, fades by itself at that time. While it rings, quietAt() is Infinity
 * (the mic never listens), so the UI does not use a drone together with the mic.
 */
export function startDrone(tonicMidi, when = now(), until = null) {
  if (!ctx) return [];
  const pc = ((tonicMidi % 12) + 12) % 12;
  const root = 48 + ((pc - 48) % 12 + 12) % 12; // C3 … B3
  const start = Math.max(when, ctx.currentTime);
  return [root, root + 7].map((m) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiToFreq(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(DRONE_GAIN, start + DRONE_FADE);
    osc.connect(g).connect(out);
    osc.start(start);
    const voice = { src: osc, gain: g, endAt: Infinity, drone: true };
    voices.add(voice);
    osc.onended = () => voices.delete(voice);
    if (until != null) {
      // Scheduled by hand: fadeVoice() reads the gain *now*, which is still 0 before the fade-in.
      g.gain.setValueAtTime(DRONE_GAIN, Math.max(until, start + DRONE_FADE));
      g.gain.linearRampToValueAtTime(0, Math.max(until, start + DRONE_FADE) + DRONE_FADE);
      osc.stop(Math.max(until, start + DRONE_FADE) + DRONE_FADE + 0.02);
      voice.endAt = Math.max(until, start + DRONE_FADE) + DRONE_FADE;
    }
    return voice;
  });
}

function strum(notes, when, gain = 0.3) {
  return notes.map((m, i) => playNote(m, when + i * STRUM_STEP, gain));
}

/**
 * Play the reference for `mode` ('cadence' | 'do' | 'drone' | 'none') starting now; `chords` are the cadence voicings (MIDI arrays).
 * Returns the context time at which the mystery note should start.
 * `opts.droneFor`: seconds after which a drone fades by itself (the "Hear key" button); otherwise it holds.
 * Reference voices fade as the mystery note begins so it stands alone.
 */
export function playReference(mode, doMidi, chords = CADENCE.map((n) => CHORDS[n]), opts = {}) {
  const t0 = now() + 0.05;
  let refVoices = [];
  let noteAt = t0;
  if (mode === 'cadence') {
    let prev = [];
    chords.forEach((notes, i) => {
      const at = t0 + i * CHORD_GAP;
      // Damp the previous chord as the next one is strummed, like a guitarist's hand would,
      // so its notes don't ring against the new chord.
      for (const v of prev) if (v) fadeVoice(v, at - CHORD_DAMP, CHORD_DAMP + 0.03);
      prev = strum(notes, at);
    });
    refVoices = prev;
    noteAt = t0 + (chords.length - 1) * CHORD_GAP + CADENCE_TO_NOTE;
  } else if (mode === 'do') {
    refVoices.push(playNote(doMidi, t0));
    noteAt = t0 + DO_TO_NOTE;
  } else if (mode === 'drone') {
    // The drone keeps sounding under the note: it is not in refVoices, so it isn't faded here.
    startDrone(doMidi, t0, opts.droneFor != null ? t0 + opts.droneFor : null);
    noteAt = t0 + DRONE_LEAD;
  }
  for (const v of refVoices) if (v) fadeVoice(v, noteAt - 0.05, 0.25);
  return noteAt;
}

/** Do-Mi-Sol-Do arpeggio for a pass. */
export function playArpeggio(midis) {
  const t = now() + 0.05;
  midis.forEach((m, i) => playNote(m, t + i * 0.16, 0.7));
}
