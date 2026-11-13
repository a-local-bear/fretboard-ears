// Sound: guitar-like notes, interface sounds and a metronome click, all
// synthesised with the Web Audio API (no audio files to download).

import { pluckSamples } from './synth.js';

let ctx = null;
let master = null;
let enabled = true;
let primed = false;
const plucks = new Map(); // midi -> {buffer, rate}
const live = new Set();   // sources that can be cancelled with stopAll()

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' });
  master = ctx.createGain();
  master.gain.value = 0.8;
  const limiter = ctx.createDynamicsCompressor(); // keeps chords from clipping
  master.connect(limiter);
  limiter.connect(ctx.destination);
  return ctx;
}

function pluckBuffer(midi) {
  let hit = plucks.get(midi);
  if (!hit) {
    const { samples, rate } = pluckSamples(midi, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    hit = { buffer, rate };
    if (plucks.size >= 30) plucks.delete(plucks.keys().next().value); // keep memory use modest on phones
    plucks.set(midi, hit);
  }
  return hit;
}

function track(src) {
  live.add(src);
  src.onended = () => live.delete(src);
}

function blip(freq, when, dur, { type = 'sine', gain = 0.2, glide = 0 } = {}) {
  const t = Math.max(ctx.currentTime, when);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.03);
  track(osc);
}

export const audio = {
  /** Create/resume the audio engine.  Browsers require this to happen inside a tap or key press. */
  unlock() {
    const c = ensure();
    if (!c) return null;
    if (c.state !== 'running') c.resume().catch(() => {});
    if (!primed) {
      // some phones only open the speaker once a sound has actually been started from a tap
      primed = true;
      const blank = c.createBufferSource();
      blank.buffer = c.createBuffer(1, 1, c.sampleRate);
      blank.connect(c.destination);
      blank.start(0);
    }
    return c;
  },
  /** is the audio engine awake? */
  get running() { return Boolean(ctx) && ctx.state === 'running'; },
  get context() { return ctx; },
  get enabled() { return enabled; },
  setEnabled(v) { enabled = Boolean(v); if (!enabled) audio.stopAll(); },
  /** the audio clock, in seconds */
  now() { return ctx ? ctx.currentTime : 0; },

  /**
   * Play a guitar note.  midi is the sounding pitch.
   * when: audio-clock time (default now); duration: seconds before the note is damped.
   */
  pluck(midi, { when = 0, duration = 0, gain = 0.75 } = {}) {
    if (!enabled || !ensure()) return;
    const { buffer, rate } = pluckBuffer(midi);
    const t = Math.max(ctx.currentTime, when);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    g.gain.setValueAtTime(gain, t);
    if (duration > 0) {
      g.gain.setValueAtTime(gain, t + duration);
      g.gain.linearRampToValueAtTime(0.0001, t + duration + 0.09);
    }
    src.connect(g);
    g.connect(master);
    src.start(t);
    if (duration > 0) src.stop(t + duration + 0.12);
    track(src);
  },

  /** metronome click at an audio-clock time */
  click(when, accent = false) {
    if (!enabled || !ensure()) return;
    blip(accent ? 1560 : 1040, when, 0.045, { type: 'triangle', gain: accent ? 0.32 : 0.2 });
  },

  /** interface sounds */
  sfx(name) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'good': blip(659.3, t, 0.13, { type: 'triangle', gain: 0.2 }); blip(987.8, t + 0.085, 0.22, { type: 'triangle', gain: 0.2 }); break;
      case 'bad': blip(207.7, t, 0.16, { type: 'triangle', gain: 0.24, glide: 155 }); blip(155.6, t + 0.13, 0.26, { type: 'triangle', gain: 0.24, glide: 110 }); break;
      case 'pop': blip(520, t, 0.09, { gain: 0.16, glide: 940 }); break;
      case 'match': blip(880, t, 0.1, { type: 'triangle', gain: 0.16 }); break;
      case 'win': [60, 64, 67, 72].forEach((m, i) => audio.pluck(m, { when: t + i * 0.1, gain: 0.6 })); [60, 64, 67, 72].forEach((m) => audio.pluck(m, { when: t + 0.52, gain: 0.4 })); break;
      case 'fail': audio.pluck(52, { when: t, gain: 0.6, duration: 0.3 }); audio.pluck(47, { when: t + 0.28, gain: 0.6 }); break;
      case 'streak': [64, 67, 71, 76].forEach((m, i) => audio.pluck(m, { when: t + i * 0.07, gain: 0.5 })); break;
      default: throw new Error(`unknown sound "${name}"`);
    }
  },

  /** silence everything that is playing or scheduled */
  stopAll() {
    for (const src of [...live]) { try { src.stop(0); } catch { /* not started */ } }
    live.clear();
  },
};
