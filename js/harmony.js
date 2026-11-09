// Diatonic harmony shared by the backing track and "note over a chord": triads, roman numerals,
// chord names, voicings inside the sample range, presets and the saved progression.
// Pure functions only. Offsets are semitones above the key's tonic, like everywhere else.

import { SCALES, MIN_MIDI, letterName } from './data.js';

const mod12 = (n) => ((n % 12) + 12) % 12;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * The chords of a mode. Each: { numeral, degree (0-6), root (semitones above the tonic), intervals
 * (from the root: third, fifth), quality ('maj' | 'min' | 'dim'), borrowed }. Minor also offers the
 * major V (harmonic minor), which the app's own minor cadence uses and common progressions need.
 */
const CACHE = {};
export function chordsFor(mode) {
  const m = mode === 'minor' ? 'minor' : 'major';
  if (CACHE[m]) return CACHE[m];
  const scale = SCALES[m];
  const note = (i) => scale[i % 7] + (i >= 7 ? 12 : 0);
  const make = (degree, third, fifth, borrowed = false) => {
    const quality = fifth === 6 ? 'dim' : third === 3 ? 'min' : 'maj';
    const r = ROMAN[degree];
    const numeral = (quality === 'maj' ? r : r.toLowerCase()) + (quality === 'dim' ? '°' : '');
    return { numeral, degree, root: scale[degree], intervals: [third, fifth], quality, borrowed };
  };
  const out = scale.map((root, i) => make(i, note(i + 2) - root, note(i + 4) - root));
  if (m === 'minor') out.push(make(4, 4, 7, true));
  return (CACHE[m] = out);
}

export const chordByNumeral = (mode, numeral) => chordsFor(mode).find((c) => c.numeral === numeral) || null;

/** Pitch classes (0-11 above the tonic) of a chord's three notes. */
export const chordPcs = (chord) => [0, ...chord.intervals].map((i) => mod12(chord.root + i));

/** "Am", "B°", "F♯" for a chord in a key. */
export function chordName(chord, keyPc, mode) {
  const suffix = chord.quality === 'min' ? 'm' : chord.quality === 'dim' ? '°' : '';
  return letterName(chord.root, keyPc, mode) + suffix;
}

/**
 * Guitar-like voicing, MIDI low → high: the root as the bass (E2 … D♯3), then fifth, root, third and
 * fifth an octave up. Everything stays within the samples (at most MIN_MIDI + 30) for every key.
 */
export function voicing(chord, keyPc) {
  const [third, fifth] = chord.intervals;
  const bass = MIN_MIDI + mod12(keyPc + chord.root - MIN_MIDI);
  return [bass, bass + fifth, bass + 12, bass + 12 + third, bass + 12 + fifth];
}

// ---------- presets and progressions ----------

export const PRESETS = {
  major: [['I', 'IV'], ['I', 'V'], ['I', 'vi', 'IV', 'V'], ['ii', 'V', 'I']],
  minor: [['i', 'iv'], ['i', 'VII', 'VI', 'V'], ['ii°', 'V', 'i'], ['i', 'VI', 'III', 'VII']],
};
export const presetLabel = (p) => p.join('–');

export const MIN_SLOTS = 2;
export const MAX_SLOTS = 4;
export const TEMPO_RANGE = [40, 200];
export const BARS_OPTIONS = [1, 2, 4];
const DEFAULT_BACKING = { key: 0, mode: 'major', tempo: 90, bars: 1 };

/** A saved/loaded backing track made safe: unknown values fall back to the defaults. */
export function normalizeBacking(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const mode = r.mode === 'minor' ? 'minor' : 'major';
  const slots = Array.isArray(r.slots) && r.slots.length >= MIN_SLOTS && r.slots.length <= MAX_SLOTS
    && r.slots.every((n) => chordByNumeral(mode, n))
    ? [...r.slots] : [...PRESETS[mode][mode === 'major' ? 2 : 1]];
  return {
    key: Number.isInteger(r.key) && r.key >= 0 && r.key < 12 ? r.key : DEFAULT_BACKING.key,
    mode,
    slots,
    tempo: Number.isFinite(r.tempo) ? Math.min(TEMPO_RANGE[1], Math.max(TEMPO_RANGE[0], Math.round(r.tempo))) : DEFAULT_BACKING.tempo,
    bars: BARS_OPTIONS.includes(r.bars) ? r.bars : DEFAULT_BACKING.bars,
  };
}

/** The same degrees in the other mode (the borrowed V becomes the natural v and back). */
export function convertSlots(slots, from, to) {
  return slots.map((n) => {
    const c = chordByNumeral(from, n);
    const t = c && chordsFor(to).find((x) => x.degree === c.degree && !x.borrowed);
    return (t || chordsFor(to)[0]).numeral;
  });
}

// ---------- a note over a chord ----------

/** Settings values for "mystery note over a chord". */
export const OVER_OPTIONS = ['off', 'main', 'any'];

/** The chord pool: 'main' = tonic, subdominant and dominant (as in the cadence); 'any' = all diatonic. */
export function overPool(over, mode) {
  const all = chordsFor(mode);
  if (over === 'main') return mode === 'minor' ? ['i', 'iv', 'V'].map((n) => chordByNumeral(mode, n)) : [all[0], all[3], all[4]];
  if (over === 'any') return all.filter((c) => !c.borrowed);
  return [];
}

/** A random chord from the pool, or null when off. */
export function pickOverChord(over, mode, rng = Math.random) {
  const pool = overPool(over, mode);
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] : null;
}
