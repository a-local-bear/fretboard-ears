// Static musical data: strings, positions, note names and colours, and the level model.
//
// A note in a level is identified by its OFFSET: semitones above the key's root (0 = the root,
// 12 = the octave, 24 = two octaves …). Midi = tonic + offset, so the same ids work in every key and mode.

import { SAMPLE_RANGE } from './samples.js';

/** Open-string MIDI numbers, index 0 = low E … 5 = high e. */
export const OPEN = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

/** Colour per scale degree (1 red … 7 purple, the octave shares the root's red), bright enough for text on black. */
export const DEGREE_COLORS = ['#ff5f57', '#ff9a3d', '#ffd93a', '#2ee6a6', '#35c9ff', '#7b8dff', '#c47dff', '#ff5f57'];

/**
 * Positions: where on the neck a level is answered. The player picks one; it changes the shape under
 * the fingers, never what is heard. `notes` are the C major notes root → octave as [string, fret] (the
 * reference placement); `strings`, `lo`/`hi` (fret window) and `root` describe the box so it can be
 * slid to any key (see placePosition). The three boxes are one fingering: E and A are the same shape a
 * string apart, and D moves its B-string notes up a fret.
 */
export const POSITIONS = [
  { id: 'E', name: 'E string', desc: 'Root on the low E string',
    shape: 'box', strings: [0, 1, 2], lo: 7, hi: 10, root: [0, 8],
    notes: [[0, 8], [0, 10], [1, 7], [1, 8], [1, 10], [2, 7], [2, 9], [2, 10]] },
  { id: 'A', name: 'A string', desc: 'Root on the A string',
    shape: 'box', strings: [1, 2, 3], lo: 2, hi: 5, root: [1, 3],
    notes: [[1, 3], [1, 5], [2, 2], [2, 3], [2, 5], [3, 2], [3, 4], [3, 5]] },
  { id: 'D', name: 'D string', desc: 'Root on the D string',
    shape: 'box', strings: [2, 3, 4], lo: 9, hi: 13, root: [2, 10],
    notes: [[2, 10], [2, 12], [3, 9], [3, 10], [3, 12], [4, 10], [4, 12], [4, 13]] },
  { id: 'neck', name: 'Whole neck', desc: 'The same pitch anywhere up to the 12th fret',
    shape: 'neck', notes: [] },
];
export const DEFAULT_POSITION = 'A';

export const ROUNDS = 10;
export const PASS_SCORE = 8;

export const midiOf = ([string, fret]) => OPEN[string] + fret;

export const positionById = (id) => POSITIONS.find((p) => p.id === id);

// ---------- note names and colours (by semitone offset) ----------

const mod12 = (n) => ((n % 12) + 12) % 12;

export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

/**
 * Names for the 12 semitones: each note is its interval above the root. The notes outside the major
 * scale are written as flats, so natural minor reads 1 2 ♭3 4 5 ♭6 ♭7.
 */
export const DEGREE_NAMES = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
const DEGREE_WORDS = ['root', 'flat second', 'second', 'flat third', 'third', 'fourth', 'flat fifth', 'fifth', 'flat sixth', 'sixth', 'flat seventh', 'seventh'];
const SHARP_LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_LETTERS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

const mixHex = (a, b) => '#' + [1, 3, 5].map((i) =>
  Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');

/** Colour per semitone: scale degrees keep DEGREE_COLORS, chromatic notes mix their two neighbours. */
export const SEMI_COLORS = Array.from({ length: 12 }, (_, pc) => {
  const i = SCALES.major.indexOf(pc);
  return i >= 0 ? DEGREE_COLORS[i] : mixHex(DEGREE_COLORS[SCALES.major.indexOf(pc - 1)], DEGREE_COLORS[SCALES.major.indexOf(pc + 1)]);
});

const ticks = (offset) => "'".repeat(Math.floor(offset / 12));
/** "1", "♭3", "5"; a tick per octave above the first: 1' is the octave, ♭3' the flat third above it. */
export const degreeName = (offset) => DEGREE_NAMES[mod12(offset)] + ticks(offset);
/** The name in words, for tips, speech and screen readers: "flat third". A root above the lowest one is the "octave". */
export const degreeWord = (offset) => (offset > 0 && mod12(offset) === 0 ? 'octave' : DEGREE_WORDS[mod12(offset)]);
export const noteColor = (offset) => (offset > 0 && offset % 12 === 0 ? DEGREE_COLORS[7] : SEMI_COLORS[mod12(offset)]);

/** Flats for F B♭ E♭ A♭ D♭ major and their relative minors. */
export const usesFlats = (keyPc, mode) => [1, 3, 5, 8, 10].includes(mode === 'minor' ? mod12(keyPc + 3) : keyPc);
const letters = (keyPc, mode) => (usesFlats(keyPc, mode) ? FLAT_LETTERS : SHARP_LETTERS);
export const letterName = (offset, keyPc, mode) => letters(keyPc, mode)[mod12(keyPc + offset)] + ticks(offset);
export const keyName = (keyPc, mode) => `${letters(keyPc, mode)[keyPc]} ${mode === 'minor' ? 'minor' : 'major'}`;
/** The tonic's letter name, e.g. "B♭". */
export const keyLetter = (keyPc, mode = 'major') => letters(keyPc, mode)[keyPc];

/**
 * Value stored as heard/answered in the answer log. Scale degrees of the first octave keep their
 * old meaning (0–7: the root … the octave, counted in the level's own mode); every other note, i.e. a
 * chromatic note or one beyond the first octave, is 8 + its offset, so values stay unique per pitch.
 */
export function degreeIndex(offset, mode) {
  if (offset === 12) return 7;
  const i = offset >= 0 && offset < 12 ? SCALES[mode].indexOf(offset) : -1;
  return i >= 0 ? i : 8 + offset;
}

// ---------- placing a position in any key ----------

export const MIN_MIDI = SAMPLE_RANGE[0]; // lowest recorded sample, E2
export const MAX_MIDI = SAMPLE_RANGE[1]; // highest, E5 (= 12th fret of the high e string)
export const MAX_FRET = 17;
const NECK_FRETS = 12;

/**
 * Where a position sits for a key: { tonic (midi of the root), strings, lo, hi (fret window of the
 * box), frame ({lo,hi} fret columns to draw), neck }. A box is the C major shape slid along the neck
 * by the smallest shift that keeps every fret, including the one-fret margin used for chromatic
 * notes, between 0 and MAX_FRET and below the top sample.
 */
export function placePosition(positionId, keyPc) {
  const c = positionById(positionId);
  if (c.shape === 'neck') {
    return {
      tonic: MIN_MIDI + mod12(keyPc - MIN_MIDI), strings: [0, 1, 2, 3, 4, 5], lo: 0, hi: NECK_FRETS,
      frame: { lo: 0, hi: NECK_FRETS }, neck: true,
    };
  }
  const top = Math.max(...c.strings);
  let best = null;
  for (let t = -12; t <= 12; t++) {
    if (mod12(t - keyPc) !== 0) continue;
    if (c.lo + t - 1 < 0 || c.hi + t + 1 > MAX_FRET || OPEN[top] + c.hi + t + 1 > MAX_MIDI) continue;
    if (best === null || Math.abs(t) < Math.abs(best)) best = t;
  }
  if (best === null) throw new Error(`no placement for ${positionId} in key ${keyPc}`);
  const t = best;
  return {
    tonic: OPEN[c.root[0]] + c.root[1] + t, strings: c.strings, lo: c.lo + t, hi: c.hi + t,
    frame: { lo: c.lo + t - 1, hi: c.hi + t + 1 }, neck: false,
  };
}

/**
 * Fretboard positions [string, fret] where `midi` can be played in a placement.
 * Whole neck: every position up to the 12th fret. A box: the one inside its fret window, or
 * failing that the nearest to it within one fret (the chromatic notes the scale shape lacks).
 */
export function positionsOf(place, midi) {
  const all = [];
  for (const s of place.strings) {
    const f = midi - OPEN[s];
    if (place.neck ? f >= 0 && f <= NECK_FRETS : f >= Math.max(0, place.lo - 1) && f <= place.hi + 1) all.push([s, f]);
  }
  if (place.neck) return all;
  const dist = ([, f]) => (f < place.lo ? place.lo - f : f > place.hi ? f - place.hi : 0);
  all.sort((a, b) => dist(a) - dist(b) || a[1] - b[1] || a[0] - b[0]);
  return all.slice(0, 1);
}

// ---------- resolution to the root ----------

function walk(offset, mode, up) {
  const scale = SCALES[mode] || SCALES.major;
  const base = Math.floor(offset / 12) * 12;
  const r = offset - base;
  const path = [offset];
  if (r === 0) return path;
  if (up) {
    for (const s of scale) if (s > r) path.push(base + s);
    path.push(base + 12);
  } else {
    for (let i = scale.length - 1; i >= 0; i--) if (scale[i] < r) path.push(base + scale[i]);
  }
  return path;
}

/**
 * Offsets (semitones above the tonic) from `offset` stepwise to the nearest root, the note itself
 * first. Notes from the fifth up resolve upward, the rest downward; a chromatic note first moves to
 * its neighbour in that direction. With `tonic` (MIDI of the root) given, a path that would leave
 * [MIN_MIDI, MAX_MIDI] is replaced by the one in the other direction.
 */
export function resolutionOf(offset, mode = 'major', tonic = null) {
  const up = mod12(offset) >= 7;
  const fits = (p) => tonic == null || p.every((o) => tonic + o >= MIN_MIDI && tonic + o <= MAX_MIDI);
  const first = walk(offset, mode, up);
  if (fits(first)) return first;
  const other = walk(offset, mode, !up);
  return fits(other) ? other : first;
}

// ---------- cadence in any key and mode ----------

/** Chord voicings as semitones from the tonic chord's root R (low → high). */
const VOICINGS = {
  major: [[0, 4, 7, 12, 16], [-7, 0, 5, 9, 12], [-5, -1, 2, 7, 11], [0, 4, 7, 12, 16]], // I IV V I
  minor: [[0, 3, 7, 12, 15], [-7, 0, 5, 8, 12], [-5, -1, 2, 7, 11], [0, 3, 7, 12, 15]], // i iv V i
};
const CADENCE_NAMES = { major: ['I', 'IV', 'V', 'I'], minor: ['i', 'iv', 'V', 'i'] };

/** The reference cadence for a key: { names, chords } with chords as MIDI arrays, all within the samples. */
export function cadenceFor(keyPc, mode) {
  const low = MIN_MIDI + 7; // the IV chord reaches 7 semitones below its root
  const root = low + mod12(keyPc - low);
  return { names: CADENCE_NAMES[mode], chords: VOICINGS[mode].map((v) => v.map((n) => root + n)) };
}

// ---------- the level model ----------

/** The stages of the ladder, in order. `mode: null` draws major or minor on every attempt. */
export const FAMILIES = {
  major: { name: 'Major scale', mode: 'major', chromatic: false },
  majorChrom: { name: 'Major with chromatic notes', mode: 'major', chromatic: true },
  minor: { name: 'Minor scale', mode: 'minor', chromatic: false },
  minorChrom: { name: 'Minor with chromatic notes', mode: 'minor', chromatic: true },
  all: { name: 'Any note', mode: null, chromatic: true },
};

/**
 * Level spec: { id, idx (index in LEVELS), family, name, tag, title, mode ('major'|'minor'|null),
 * random (null: the player's chosen key | 'major' | 'minor' | 'any': the key, and for 'any' the mode,
 * are drawn on every attempt), chromatic, from, to (semitone span above the tonic; `to: Infinity` runs
 * to the top of the samples) or an explicit `notes` list of offsets, newest? (the offset the level
 * adds: it is introduced on the explore screen and dealt more often), len? (notes per round, dictation
 * only; absent = 1), neck (true: more than one octave, always answered on the whole neck) }.
 *
 * One ladder. The major scale is built up in a fixed key, triad first; from the whole octave on, every
 * level draws a new key on each attempt.
 */
function buildLevels() {
  const out = [];
  const add = (family, id, spec) => {
    const f = FAMILIES[family];
    out.push({
      family, mode: f.mode, chromatic: f.chromatic, random: f.mode ?? 'any', tag: '', neck: false,
      title: `${f.name} · ${spec.name}`, ...spec, id: `${family}-${id}`,
    });
  };
  const octave = { from: 0, to: 12 };
  const twoOctaves = { from: 0, to: 24, name: 'Two octaves', neck: true };
  const dictation = (family) => {
    add(family, 'dict-2', { ...octave, len: 2, name: 'Two-note phrases', tag: 'Dictation' });
    add(family, 'dict-4', { ...octave, len: 4, name: 'Four-note phrases', tag: 'Dictation' });
  };
  const chromatic = (family) => {
    add(family, '1st', { from: 0, to: 6, name: 'First half' });
    add(family, '2nd', { from: 6, to: 12, name: 'Second half' });
    add(family, 'oct', { ...octave, name: 'Whole octave' });
    add(family, '2oct', { ...twoOctaves });
    dictation(family);
  };

  add('major', 't0', { notes: [0, 7], newest: 7, name: '1 · 5', random: null });
  add('major', 't1', { notes: [0, 4, 7], newest: 4, name: '1 · 3 · 5', tag: 'The triad', random: null });
  add('major', 't2', { notes: [0, 2, 4, 7], newest: 2, name: '1 · 2 · 3 · 5', random: null });
  add('major', '3', { from: 0, to: 7, newest: 5, name: '1 – 5', tag: 'First half', random: null });
  add('major', '4', { from: 0, to: 9, newest: 9, name: '1 – 6', random: null });
  add('major', '5', { from: 0, to: 11, newest: 11, name: '1 – 7', random: null });
  add('major', '6', { ...octave, newest: 12, name: 'Whole octave', random: null });
  add('major', 'rk', { ...octave, name: 'Whole octave, any key' });
  add('major', '2oct', { ...twoOctaves });
  dictation('major');

  chromatic('majorChrom');

  add('minor', 't', { notes: [0, 3, 7], newest: 3, name: '1 · ♭3 · 5', tag: 'The minor triad' });
  add('minor', '5', { from: 0, to: 7, name: '1 – 5', tag: 'First half' });
  add('minor', '6', { from: 0, to: 8, newest: 8, name: '1 – ♭6' });
  add('minor', 'oct', { ...octave, newest: 10, name: 'Whole octave' });
  add('minor', '2oct', { ...twoOctaves });
  dictation('minor');

  chromatic('minorChrom');

  add('all', 'neck', { from: 0, to: Infinity, name: 'Any octave, major or minor', neck: true });
  return out.map((l, idx) => ({ ...l, idx }));
}

/** Every level, in ladder order. */
export const LEVELS = buildLevels();
export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? null;

/** The note a level adds (its `newest`), else the top of the pool. */
export const newestOf = (level, pool) => (pool.includes(level.newest) ? level.newest : pool[pool.length - 1]);

/** Pick the key (and mode) for an attempt: fixed levels use `keyPc`, random ones draw. */
export function pickKey(level, keyPc, rng = Math.random) {
  if (!level.random) return { keyPc, mode: level.mode };
  return {
    keyPc: Math.floor(rng() * 12),
    mode: level.random === 'any' ? (rng() < 0.5 ? 'major' : 'minor') : level.random,
  };
}

const MIN_CELLS = 4;

/**
 * The fret columns to draw for the notes of a level: just the frets they use (so a phone shows a
 * short board, not the whole box), widened to MIN_CELLS inside the placement's own window.
 * A dot on fret `lo` sits before the first wire, as an open string does before the nut.
 */
export function frameOf(place, positions) {
  if (!positions.length) return place.frame;
  const frets = positions.map(([, f]) => f);
  let lo = Math.max(0, Math.min(...frets) - 1);
  let hi = Math.max(...frets);
  while (hi - lo < MIN_CELLS) {
    if (hi < place.frame.hi) hi++;
    else if (lo > 0) lo--;
    else hi++;
  }
  return { lo, hi };
}

/**
 * Everything the UI needs to run a level in a key: the ascending note ids (`pool`, offsets from the
 * tonic), their fretboard positions, the fret frame around them, and the cadence. `positionId` is the
 * player's choice; a level of more than one octave is placed on the whole neck whatever it is
 * (`positionId` in the result is the one used). `multiOctave` is true when notes of the same name
 * occur in several octaves.
 */
export function buildContext(positionId, level, keyPc, mode) {
  const used = level.neck ? 'neck' : positionId;
  const place = placePosition(used, keyPc);
  const positions = new Map();
  const pool = [];
  const maxOffset = MAX_MIDI - place.tonic;
  const offsets = level.notes ?? Array.from({ length: Math.max(0, Math.min(level.to, maxOffset) - level.from + 1) }, (_, i) => level.from + i);
  for (const o of offsets) {
    if (o > maxOffset) continue;
    if (!level.notes && !level.chromatic && !SCALES[mode].includes(mod12(o))) continue;
    const pos = positionsOf(place, place.tonic + o);
    if (!pos.length) continue;
    pool.push(o);
    positions.set(o, pos);
  }
  return {
    positionId: used, level, keyPc, mode, tonic: place.tonic, frame: frameOf(place, [...positions.values()].flat()), pool, positions,
    multiOctave: pool[pool.length - 1] - pool[0] > 12, cadence: cadenceFor(keyPc, mode),
  };
}

/** Cadence voicings (MIDI, low → high) in C major, around middle C. Other keys: cadenceFor(). */
export const CHORDS = {
  C: [48, 52, 55, 60, 64],
  F: [41, 48, 53, 57, 60],
  G: [43, 47, 50, 55, 59],
};
export const CADENCE = ['C', 'F', 'G', 'C'];
