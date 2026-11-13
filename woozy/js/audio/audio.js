// Web Audio instruments: a plucked guitar with chorus + reverb, a round bass,
// and a small synthesized drum kit.  Everything is generated in the browser —
// no samples to download, so it works offline on the LAN.

import { midiHz, renderImpulse, renderPluck } from './dsp.js';

let ctx = null;
const g = {}; // the node graph
const pluckCache = new Map(); // midi → { buffer, rate }
const live = new Set(); // every voice that is sounding or scheduled
const stringVoice = new Array(6).fill(null);
let leadVoice = null;

const prefs = { volume: 0.8, wobble: 0.45, reverb: 0.35, tone: 0.5 };

export const audioPrefs = () => ({ ...prefs });

export function setAudioPrefs(patch) {
  Object.assign(prefs, patch);
  if (ctx) applyPrefs();
}

export function getCtx() {
  if (!ctx) build();
  return ctx;
}

// Call from a click/tap handler: browsers keep audio suspended until then.
export function unlock() {
  const c = getCtx();
  if (c.state !== 'running') c.resume().catch(() => {});
  return c;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });

  g.master = ctx.createGain();
  g.limiter = ctx.createDynamicsCompressor();
  g.limiter.threshold.value = -14;
  g.limiter.knee.value = 12;
  g.limiter.ratio.value = 5;
  g.limiter.attack.value = 0.004;
  g.limiter.release.value = 0.2;
  g.master.connect(g.limiter);
  g.limiter.connect(ctx.destination);

  // Shared reverb.
  g.reverb = ctx.createConvolver();
  const [left, right] = renderImpulse(ctx.sampleRate);
  const impulse = ctx.createBuffer(2, left.length, ctx.sampleRate);
  impulse.getChannelData(0).set(left);
  impulse.getChannelData(1).set(right);
  g.reverb.buffer = impulse;
  g.reverbSend = ctx.createGain();
  g.reverbSend.connect(g.reverb);
  g.reverb.connect(g.master);

  // Rhythm guitar: strings → tone → dry + two wobbling delay lines (chorus).
  g.guitar = ctx.createGain();
  g.tone = ctx.createBiquadFilter();
  g.tone.type = 'lowpass';
  g.tone.Q.value = 0.5;
  g.guitar.connect(g.tone);
  g.dry = ctx.createGain();
  g.tone.connect(g.dry);
  g.dry.connect(g.master);
  g.tone.connect(g.reverbSend);

  g.chorus = ctx.createGain();
  g.chorus.connect(g.master);
  g.lfoDepths = [];
  for (const [base, rate, pan] of [[0.011, 0.61, -0.75], [0.017, 0.83, 0.75]]) {
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = base;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const depth = ctx.createGain();
    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start();
    g.tone.connect(delay);
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      delay.connect(panner);
      panner.connect(g.chorus);
    } else {
      delay.connect(g.chorus);
    }
    g.lfoDepths.push(depth);
  }

  // Lead guitar (melodies): brighter, mostly dry, same room.
  g.lead = ctx.createGain();
  g.leadTone = ctx.createBiquadFilter();
  g.leadTone.type = 'lowpass';
  g.leadTone.frequency.value = 5200;
  g.leadTone.Q.value = 0.7;
  g.lead.connect(g.leadTone);
  g.leadTone.connect(g.master);
  g.leadTone.connect(g.reverbSend);

  g.bass = ctx.createGain();
  g.bass.connect(g.master);

  g.drums = ctx.createGain();
  g.drums.gain.value = 0.72;
  g.drums.connect(g.master);
  g.drumSend = ctx.createGain();
  g.drumSend.gain.value = 0.12;
  g.drums.connect(g.drumSend);
  g.drumSend.connect(g.reverb);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  g.noise = noise;

  applyPrefs();
}

function applyPrefs() {
  const t = ctx.currentTime;
  const set = (param, value) => param.setTargetAtTime(value, t, 0.03);
  set(g.master.gain, prefs.volume);
  set(g.tone.frequency, 1700 + prefs.tone * 3600);
  set(g.chorus.gain, 0.85 * prefs.wobble);
  set(g.dry.gain, 1 - 0.3 * prefs.wobble);
  for (const depth of g.lfoDepths) set(depth.gain, 0.0006 + 0.0034 * prefs.wobble);
  set(g.reverbSend.gain, 0.55 * prefs.reverb);
}

function pluckBuffer(midi) {
  let entry = pluckCache.get(midi);
  if (!entry) {
    const { data, rate } = renderPluck(midi, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buffer.getChannelData(0).set(data);
    entry = { buffer, rate };
    pluckCache.set(midi, entry);
  }
  return entry;
}

// Render buffers ahead of time so the first strum doesn't hiccup.
export function prewarm(midis) {
  getCtx();
  for (const m of midis) if (m != null) pluckBuffer(m);
}

function track(voice, node) {
  live.add(voice);
  node.onended = () => {
    live.delete(voice);
    voice.cleanup?.();
  };
  return voice;
}

function pluckVoice(midi, time, gain, bus, dur) {
  const { buffer, rate } = pluckBuffer(midi);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, time);
  src.connect(amp);
  amp.connect(bus);
  src.start(time);
  const voice = {
    release(at, tau = 0.03) {
      const when = Math.max(at, ctx.currentTime);
      try {
        amp.gain.cancelScheduledValues(when);
        amp.gain.setTargetAtTime(0, when, tau);
        src.stop(when + tau * 8);
      } catch { /* already stopped */ }
    },
    cleanup() {
      amp.disconnect();
    },
  };
  track(voice, src);
  if (dur != null) voice.release(time + dur, 0.035);
  return voice;
}

// One note on one string (0 = low E … 5 = high e).  A new note on a string
// cuts whatever was ringing on it, just like the real thing.
export function pluckString(string, midi, time, { vel = 0.8, dur = null } = {}) {
  getCtx();
  stringVoice[string]?.release(time, 0.012);
  stringVoice[string] = pluckVoice(midi, time, 0.31 * vel, g.guitar, dur);
}

// notes: six MIDI numbers (low E → high e), null = string not played.
export function strum(notes, time, { dir = 'D', vel = 0.8, spread = 0.014, dur = null, dampOthers = true } = {}) {
  getCtx();
  let order = [];
  for (let s = 0; s < 6; s++) if (notes[s] != null) order.push(s);
  if (dir === 'U') order = order.reverse().slice(0, 4); // up-strums catch the top strings
  order.forEach((s, i) => {
    const falloff = 1 - i * (dir === 'U' ? 0.1 : 0.035);
    pluckString(s, notes[s], time + i * spread, { vel: vel * falloff, dur });
  });
  if (dampOthers && dir === 'D') {
    for (let s = 0; s < 6; s++) {
      if (notes[s] == null && stringVoice[s]) {
        stringVoice[s].release(time, 0.02);
        stringVoice[s] = null;
      }
    }
  }
}

export function dampStrings(time, tau = 0.03) {
  if (!ctx) return;
  for (let s = 0; s < 6; s++) {
    stringVoice[s]?.release(time, tau);
    stringVoice[s] = null;
  }
}

// Muted "chk" strum.
export function chuck(time, vel = 0.6) {
  getCtx();
  dampStrings(time, 0.008);
  const src = ctx.createBufferSource();
  src.buffer = g.noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1500;
  band.Q.value = 0.9;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.22 * vel, time);
  amp.gain.exponentialRampToValueAtTime(0.0008, time + 0.06);
  src.connect(band);
  band.connect(amp);
  amp.connect(g.guitar);
  src.start(time, Math.random() * 0.5, 0.08);
  track({ release() { try { src.stop(); } catch { /* not started */ } }, cleanup() { amp.disconnect(); } }, src);
}

// Melody note. Monophonic by default — each new note ends the previous one —
// unless `poly` is set (double-stops: two notes struck together).
export function playLead(midi, time, dur, vel = 0.8, poly = false) {
  getCtx();
  if (poly) {
    pluckVoice(midi, time, 0.42 * vel, g.lead, dur);
    return;
  }
  leadVoice?.release(time, 0.012);
  leadVoice = pluckVoice(midi, time, 0.5 * vel, g.lead, dur);
}

// Any instant sound for "what does this note sound like" taps.
export function tapNote(midi, vel = 0.9) {
  const c = unlock();
  playLead(midi, c.currentTime + 0.01, 1.6, vel);
}

export function playBass(midi, time, dur, vel = 0.8) {
  getCtx();
  const freq = midiHz(midi);
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = freq;
  const grit = ctx.createOscillator(); // harmonics so the bass still reads on small speakers
  grit.type = 'sawtooth';
  grit.frequency.value = freq;
  const gritGain = ctx.createGain();
  gritGain.gain.value = 0.28;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(1100, time);
  filter.frequency.exponentialRampToValueAtTime(380, time + 0.22);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(0.34 * vel, time + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.22 * vel, time + 0.2);
  amp.gain.setTargetAtTime(0.0001, time + dur, 0.035);
  sub.connect(filter);
  grit.connect(gritGain);
  gritGain.connect(filter);
  filter.connect(amp);
  amp.connect(g.bass);
  sub.start(time);
  grit.start(time);
  sub.stop(time + dur + 0.4);
  grit.stop(time + dur + 0.4);
  track({
    release(at) {
      const when = Math.max(at, ctx.currentTime);
      try {
        amp.gain.cancelScheduledValues(when);
        amp.gain.setTargetAtTime(0.0001, when, 0.02);
        sub.stop(when + 0.2);
        grit.stop(when + 0.2);
      } catch { /* already stopped */ }
    },
    cleanup() { amp.disconnect(); },
  }, sub);
}

export function playDrum(kind, time, vel = 0.8) {
  getCtx();
  let stopper;
  const amp = ctx.createGain();
  amp.connect(g.drums);
  if (kind === 'kick') {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.11);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.95 * vel, time + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0008, time + 0.3);
    osc.connect(amp);
    osc.start(time);
    osc.stop(time + 0.32);
    stopper = osc;
  } else {
    const src = ctx.createBufferSource();
    src.buffer = g.noise;
    const filter = ctx.createBiquadFilter();
    let length;
    if (kind === 'snare') {
      filter.type = 'bandpass';
      filter.frequency.value = 1900;
      filter.Q.value = 0.7;
      length = 0.17;
      amp.gain.setValueAtTime(0.5 * vel, time);
      // a little pitched thump under the noise
      const body = ctx.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(210, time);
      body.frequency.exponentialRampToValueAtTime(150, time + 0.07);
      const bodyAmp = ctx.createGain();
      bodyAmp.gain.setValueAtTime(0.28 * vel, time);
      bodyAmp.gain.exponentialRampToValueAtTime(0.0008, time + 0.1);
      body.connect(bodyAmp);
      bodyAmp.connect(g.drums);
      body.start(time);
      body.stop(time + 0.12);
      body.onended = () => bodyAmp.disconnect();
    } else {
      filter.type = 'highpass';
      filter.frequency.value = kind === 'ohat' ? 6500 : 7500;
      length = kind === 'ohat' ? 0.22 : 0.045;
      amp.gain.setValueAtTime(0.16 * vel, time);
    }
    amp.gain.exponentialRampToValueAtTime(0.0008, time + length);
    src.connect(filter);
    filter.connect(amp);
    src.start(time, Math.random() * 0.5, length + 0.03);
    stopper = src;
  }
  track({ release() { try { stopper.stop(); } catch { /* not started */ } }, cleanup() { amp.disconnect(); } }, stopper);
}

// Silence everything that is sounding or still waiting to sound.
export function stopAll() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const voice of [...live]) voice.release(t, 0.02);
  stringVoice.fill(null);
  leadVoice = null;
}

// Strum a chord right now (used when tapping a chord diagram).
export function auditionChord(notes, { slow = false } = {}) {
  const c = unlock();
  strum(notes, c.currentTime + 0.02, { spread: slow ? 0.09 : 0.028, vel: 0.85 });
}
