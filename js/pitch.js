// Pure pitch detection (McLeod Pitch Method) and note tracking. No browser APIs, so it's testable in Node.

export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/**
 * Detect the fundamental of `buf` (Float32Array, mono) sampled at `sr`.
 * Returns { freq, clarity, rms } or null when there's no usable periodic signal.
 * clarity is the normalised-square-difference peak (0..1); above ~0.9 is a clean note.
 */
export function detectPitch(buf, sr, { minFreq = 70, maxFreq = 1100, cutoff = 0.9 } = {}) {
  const N = buf.length;
  let energy = 0;
  for (let i = 0; i < N; i++) energy += buf[i] * buf[i];
  const rms = Math.sqrt(energy / N);
  if (rms < 1e-4) return null;

  const minLag = Math.max(2, Math.floor(sr / maxFreq));
  const maxLag = Math.min(N - 2, Math.ceil(sr / minFreq));
  const nsdf = new Float32Array(maxLag + 2);
  let m = 2 * energy; // m(τ) = Σ x[i]² + x[i+τ]², updated incrementally
  for (let tau = 0; tau <= maxLag + 1; tau++) {
    let acf = 0;
    for (let i = 0, n = N - tau; i < n; i++) acf += buf[i] * buf[i + tau];
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
    m -= buf[N - 1 - tau] * buf[N - 1 - tau] + buf[tau] * buf[tau];
  }

  // Key maxima: the highest point of each positive region after the first negative dip.
  const peaks = [];
  let tau = 1;
  while (tau <= maxLag && nsdf[tau] > 0) tau++;
  while (tau <= maxLag) {
    while (tau <= maxLag && nsdf[tau] <= 0) tau++;
    let best = -1;
    while (tau <= maxLag && nsdf[tau] > 0) {
      if (best < 0 || nsdf[tau] > nsdf[best]) best = tau;
      tau++;
    }
    if (best >= minLag) peaks.push(best);
  }
  if (!peaks.length) return null;

  const top = Math.max(...peaks.map((t) => nsdf[t]));
  const t = peaks.find((p) => nsdf[p] >= cutoff * top);
  // Parabolic interpolation around the chosen peak.
  const a = nsdf[t - 1], b = nsdf[t], c = nsdf[t + 1];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (a - c) / (2 * denom) : 0;
  const clarity = b - ((a - c) * shift) / 4;
  return { freq: sr / (t + shift), clarity: Math.min(1, clarity), rms };
}

/**
 * Match a detected pitch (fractional MIDI) to a level's notes by note name, any octave.
 * `degreeMidis[d]` is the MIDI of degree d, or undefined when d isn't in the level.
 * Returns { nearest, cents, degree } where degree is null for notes outside the level.
 * Do and Do' share a name: the one closest in pitch wins.
 */
export function matchDegree(midi, degreeMidis) {
  const nearest = Math.round(midi);
  const cents = Math.round((midi - nearest) * 100);
  const pc = ((nearest % 12) + 12) % 12;
  let degree = null;
  degreeMidis.forEach((m, d) => {
    if (m == null || m % 12 !== pc) return;
    if (degree === null || Math.abs(m - nearest) < Math.abs(degreeMidis[degree] - nearest)) degree = d;
  });
  return { nearest, cents, degree };
}

/**
 * Turns a stream of analysis frames into discrete "note played" events.
 * A note fires once it's been stable for `stableFrames` frames; it fires again only after
 * silence, a new pluck (a jump in level) or a change of note.
 * reset({ requireOnset: true }) ignores whatever is already ringing until silence or a new pluck,
 * e.g. the guitar still sounding from the last answer when listening resumes.
 */
export class NoteTracker {
  constructor({ stableFrames = 3, minClarity = 0.9, minRms = 0.004, maxCents = 45, onsetRatio = 1.6 } = {}) {
    Object.assign(this, { stableFrames, minClarity, minRms, maxCents, onsetRatio });
    this.reset();
  }

  reset({ requireOnset = false } = {}) {
    this.candidate = null;
    this.count = 0;
    this.armed = !requireOnset;
    this.strict = requireOnset; // only silence or a new pluck can arm it
    this.last = null;
    this.prevRms = 0;
  }

  arm() {
    this.armed = true;
    this.strict = false;
  }

  /** frame: { midi (fractional) | null, clarity, rms }. Returns the rounded MIDI to emit, or null. */
  push({ midi, clarity = 0, rms = 0 }) {
    const prev = this.prevRms;
    this.prevRms = rms;
    if (rms < this.minRms) {
      this.candidate = null;
      this.count = 0;
      this.arm();
      return null;
    }
    if (prev > 0 && rms > prev * this.onsetRatio) {
      this.arm();
      this.count = 0;
    }
    if (midi == null || clarity < this.minClarity) { this.count = 0; return null; }
    const nearest = Math.round(midi);
    if (Math.abs(midi - nearest) * 100 > this.maxCents) { this.count = 0; return null; }
    if (nearest === this.candidate) this.count++;
    else { this.candidate = nearest; this.count = 1; }
    if (this.count >= this.stableFrames && (this.armed || (!this.strict && nearest !== this.last))) {
      this.armed = false;
      this.last = nearest;
      return nearest;
    }
    return null;
  }
}
