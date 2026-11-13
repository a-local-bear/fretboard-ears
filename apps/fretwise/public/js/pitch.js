// Pitch detection for a single guitar note (YIN algorithm) and a small tracker
// that turns a stream of analysis frames into "a note was played" events.
// Pure maths, no Web Audio — see mic.js for the microphone plumbing.

import { freqToMidi } from './theory.js';

/**
 * @returns a function detect(samples) -> {freq, clarity, rms}
 *   freq is 0 when no clear pitch was found; clarity is 0..1.
 *   `samples` must hold at least window + sampleRate/minFreq values.
 */
export function createPitchDetector(sampleRate, { minFreq = 70, maxFreq = 1500, window = 2048, threshold = 0.12 } = {}) {
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.ceil(sampleRate / minFreq);
  const d = new Float32Array(tauMax + 2);
  const needed = window + tauMax + 1;

  function detect(buf) {
    const n = Math.min(window, buf.length - tauMax - 1);
    if (n < 256) throw new Error(`pitch detector needs ${needed} samples, got ${buf.length}`);
    let energy = 0;
    for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
    const rms = Math.sqrt(energy / n);
    if (rms < 1e-5) return { freq: 0, clarity: 0, rms };

    // squared difference between the signal and itself shifted by tau
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let i = 0; i < n; i++) { const x = buf[i] - buf[i + tau]; sum += x * x; }
      d[tau] = sum;
    }
    // cumulative-mean normalisation: makes "the first deep dip" well defined
    let running = 0;
    d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      running += d[tau];
      d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }
    let tau = -1;
    for (let t = tauMin; t < tauMax; t++) {
      if (d[t] < threshold) {
        while (t + 1 < tauMax && d[t + 1] < d[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      let best = tauMin;
      for (let t = tauMin + 1; t < tauMax; t++) if (d[t] < d[best]) best = t;
      if (d[best] > 0.3) return { freq: 0, clarity: Math.max(0, 1 - d[best]), rms };
      tau = best;
    }
    // parabolic interpolation around the dip for sub-sample accuracy
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const denom = a + c - 2 * b;
    const shift = denom > 1e-12 ? clampUnit((0.5 * (a - c)) / denom) : 0;
    return { freq: sampleRate / (tau + shift), clarity: Math.max(0, 1 - b), rms };
  }
  detect.needed = needed;
  return detect;
}
const clampUnit = (v) => (v > 1 ? 1 : v < -1 ? -1 : v);

/**
 * Turns frames from the detector into discrete notes.
 * A note is reported once it has been stable for a few frames; it is reported
 * again only after a new attack (a jump in loudness) or a gap of silence.
 */
export class NoteTracker {
  constructor({ gate = 0.012, minClarity = 0.82, hold = 3, attackRatio = 1.5 } = {}) {
    this.gate = gate;
    this.minClarity = minClarity;
    this.hold = hold;
    this.attackRatio = attackRatio;
    this.reset();
  }

  reset() {
    this.candidate = null;
    this.count = 0;
    this.latched = null;
    this.quiet = 0;
    this.history = [];
    this.current = null; // what is sounding right now (for meters / the tuner)
  }

  /** @returns null, or {midi, cents, freq} when a new note starts */
  push(frame) {
    const { freq, clarity, rms } = frame;
    const hist = this.history;
    const floor = hist.length ? Math.min(...hist) : rms;
    const last = hist.length ? hist[hist.length - 1] : rms;
    hist.push(rms);
    if (hist.length > 6) hist.shift();

    if (!(freq > 0) || rms < this.gate || clarity < this.minClarity) {
      this.count = 0;
      this.candidate = null;
      if (rms < this.gate && ++this.quiet >= 2) { this.latched = null; this.current = null; }
      return null;
    }
    this.quiet = 0;
    const exact = freqToMidi(freq);
    const midi = Math.round(exact);
    const cents = Math.round((exact - midi) * 100);
    this.current = { midi, cents, freq, rms };

    // a fresh pluck: louder than the recent quietest moment and still rising
    if (this.latched !== null && rms > floor * this.attackRatio && rms > last * 1.2) {
      this.latched = null;
      this.count = 0;
      this.candidate = null;
    }
    if (midi === this.candidate) this.count++;
    else { this.candidate = midi; this.count = 1; }
    if (this.count >= this.hold && this.latched !== midi) {
      this.latched = midi;
      return { midi, cents, freq };
    }
    return null;
  }
}
