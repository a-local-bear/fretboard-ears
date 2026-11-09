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
 * Ids may be any non-negative integer (semitone offsets), so the array can be sparse.
 * With `exact`, only the note in the right octave counts (levels that span several octaves).
 */
export function matchDegree(midi, degreeMidis, { exact = false } = {}) {
  const nearest = Math.round(midi);
  const cents = Math.round((midi - nearest) * 100);
  const pc = ((nearest % 12) + 12) % 12;
  let degree = null;
  degreeMidis.forEach((m, d) => {
    if (m == null || (exact ? m !== nearest : m % 12 !== pc)) return;
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

// ---------- voice ----------
// Singing differs from plucking: no onset, a sustained and wobbly tone, and the octave is the singer's
// own. So the voice is matched by pitch class (any octave) and accepted after a short stable hold.

/** Detector settings for a voice: a vocal range and a lower clarity bar than a guitar string. */
export const VOICE = { minFreq: 80, maxFreq: 1000, minClarity: 0.85, minRms: 0.008, holdMs: 300, tolCents: 40 };

/** Fractional MIDI of a detectPitch() result if it is a usable voiced frame, else null. */
export const voiceMidi = (r) =>
  (r && r.clarity >= VOICE.minClarity && r.rms >= VOICE.minRms ? freqToMidi(r.freq) : null);

/**
 * Signed distance in cents from a fractional MIDI pitch to the nearest note of pitch class `pc`
 * (0 = C … 11 = B), in any octave: always within ±600.
 */
export const pitchClassCents = (midi, pc) => ((((midi - pc + 6) % 12) + 12) % 12 - 6) * 100;

/** Plain-language cue for a deviation from the target: in tune within `tol` cents, else sharp/flat. */
export function voiceCue(cents, tol = VOICE.tolCents) {
  if (Math.abs(cents) <= tol) return 'in tune';
  if (cents > 0) return cents <= 150 ? 'sharp' : 'too high';
  return cents >= -150 ? 'flat' : 'too low';
}

/**
 * Accepts a sung note: the voice must stay within `tolCents` of the target pitch class for `holdMs`
 * (dropouts and wobble out of tolerance shorter than `gapMs` don't break the hold). Also detects a
 * failed attempt: a stretch of singing that ended in silence, or ran on for `maxVoicedMs`, without
 * ever being accepted. Feed it one frame per analysis tick: push(midi | null, tMs).
 */
export class VoiceHold {
  constructor({ holdMs = VOICE.holdMs, tolCents = VOICE.tolCents, gapMs = 120, endMs = 400, minVoicedMs = 600, maxVoicedMs = 3000 } = {}) {
    Object.assign(this, { holdMs, tolCents, gapMs, endMs, minVoicedMs, maxVoicedMs });
    this.reset(0);
  }

  /** New target pitch class; frames before `ignoreUntil` (ms) are ignored (e.g. the previous note dying away). */
  reset(pc, ignoreUntil = -Infinity) {
    this.pc = pc;
    this.ignoreUntil = ignoreUntil;
    this.holdStart = null;
    this.lastIn = null;
    this.segStart = null;
    this.lastVoiced = null;
  }

  /** Returns { cents (to the target, null if unvoiced), held (ms), done, failed }. */
  push(midi, t) {
    const out = { cents: null, held: 0, done: false, failed: false };
    if (t < this.ignoreUntil) return out;
    if (midi == null) {
      if (this.holdStart != null && t - this.lastIn > this.gapMs) this.holdStart = null;
      if (this.segStart != null && t - this.lastVoiced >= this.endMs) {
        out.failed = this.lastVoiced - this.segStart >= this.minVoicedMs;
        this.segStart = null;
      }
      return out;
    }
    const cents = pitchClassCents(midi, this.pc);
    out.cents = cents;
    if (this.segStart == null) this.segStart = t;
    this.lastVoiced = t;
    if (Math.abs(cents) <= this.tolCents) {
      if (this.holdStart == null) this.holdStart = t;
      this.lastIn = t;
      out.held = t - this.holdStart;
      if (out.held >= this.holdMs) { out.done = true; this.segStart = null; return out; }
    } else if (this.holdStart != null && t - this.lastIn > this.gapMs) {
      this.holdStart = null;
    }
    if (t - this.segStart >= this.maxVoicedMs) { out.failed = true; this.segStart = null; this.holdStart = null; }
    return out;
  }
}
