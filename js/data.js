// Static musical data: strings, chapters, note names and colours, and the level model.
//
// A note in a level is identified by its OFFSET: semitones above the key's tonic (0 = Do,
// 12 = Do', 24 = Do'' …). Midi = tonic + offset, so the same ids work in every key and mode.

import { SAMPLE_RANGE } from './samples.js';

/** Open-string MIDI numbers, index 0 = low E … 5 = high e. */
export const OPEN = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

export const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', "Do'"];
export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"];
/** Colour per scale degree (Do red … Si purple, Do' shares Do's red), bright enough for text on black. */
export const DEGREE_COLORS = ['#ff5f57', '#ff9a3d', '#ffd93a', '#2ee6a6', '#35c9ff', '#7b8dff', '#c47dff', '#ff5f57'];

/**
 * Chapters. `notes` are the C major notes Do → Do' as [string, fret] (the reference placement);
 * `shape`, `strings`, `lo`/`hi` (fret window) and `root` describe the pattern so it can be slid to
 * any key (see placeChapter).
 */
export const CHAPTERS = [
  { id: 'one', name: 'One string', desc: 'One octave along a single string',
    shape: 'string', root: [4, 1],
    notes: [[4, 1], [4, 3], [4, 5], [4, 6], [4, 8], [4, 10], [4, 12], [4, 13]] },
  { id: 'pA', name: 'Pattern I', desc: 'Root on the A string (C major: 3rd fret)',
    shape: 'box', strings: [1, 2, 3], lo: 2, hi: 5, root: [1, 3],
    notes: [[1, 3], [1, 5], [2, 2], [2, 3], [2, 5], [3, 2], [3, 4], [3, 5]] },
  { id: 'pB', name: 'Pattern II', desc: 'Root on the low E string (C major: 8th fret)',
    shape: 'box', strings: [0, 1, 2], lo: 7, hi: 10, root: [0, 8],
    notes: [[0, 8], [0, 10], [1, 7], [1, 8], [1, 10], [2, 7], [2, 9], [2, 10]] },
  { id: 'pC', name: 'Pattern III', desc: 'Higher octave, root on the D string (C major: 10th fret)',
    shape: 'box', strings: [2, 3, 4], lo: 9, hi: 13, root: [2, 10],
    notes: [[2, 10], [2, 12], [3, 9], [3, 10], [3, 12], [4, 10], [4, 12], [4, 13]] },
  { id: 'neck', name: 'Whole neck', desc: 'Any position: answer with the same pitch anywhere on the neck',
    shape: 'neck', notes: [] },
];

/** Legacy: the number of build-up levels (Do·Re … Do–Do') every pattern chapter starts with. */
export const LEVELS_PER_CHAPTER = 7;
export const ROUNDS = 10;
export const PASS_SCORE = 8;

export const midiOf = ([string, fret]) => OPEN[string] + fret;

/** Legacy: degree indexes (0-based) of build-up level `level`: level 0 → Do·Re, level 6 → Do…Do'. */
export const levelDegrees = (level) => Array.from({ length: level + 2 }, (_, i) => i);

export const chapterById = (id) => CHAPTERS.find((c) => c.id === id);

// ---------- note names and colours (by semitone offset) ----------

const mod12 = (n) => ((n % 12) + 12) % 12;

export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

/**
 * Movable-do names for the 12 semitones. Scale notes keep the app's names (Do Re Mi Fa Sol La Si);
 * the chromatic notes are the "flat" syllables Ra Me Se Le Te, so every name is one distinct word.
 * Natural minor reads Do Re Me Fa Sol Le Te.
 */
export const SEMI_NAMES = ['Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Se', 'Sol', 'Le', 'La', 'Te', 'Si'];
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
export const solfegeName = (offset) => SEMI_NAMES[mod12(offset)] + ticks(offset);
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
 * old meaning (0–7: Do … Do', counted in the level's own mode); every other note, i.e. a chromatic
 * note or one beyond the first octave, is 8 + its offset, so values stay unique per pitch.
 */
export function degreeIndex(offset, mode) {
  if (offset === 12) return 7;
  const i = offset >= 0 && offset < 12 ? SCALES[mode].indexOf(offset) : -1;
  return i >= 0 ? i : 8 + offset;
}

// ---------- placing a chapter's pattern in any key ----------

export const MIN_MIDI = SAMPLE_RANGE[0]; // lowest recorded sample, E2
export const MAX_MIDI = SAMPLE_RANGE[1]; // highest, E5 (= 12th fret of the high e string)
export const MAX_FRET = 17;
const NECK_FRETS = 12;

/**
 * Where a chapter sits for a key: { tonic (midi of Do), strings, lo, hi (fret window of the pattern),
 * frame ({lo,hi} fret columns to draw), neck }. Patterns are the C major shapes slid along the neck
 * by the smallest shift that keeps every fret, including the one-fret margin used for chromatic
 * notes, between 0 and MAX_FRET and below the top sample. The one-string chapter moves to another
 * string when the octave would not fit the neck.
 */
export function placeChapter(chapterId, keyPc) {
  const c = chapterById(chapterId);
  if (c.shape === 'neck') {
    return {
      tonic: MIN_MIDI + mod12(keyPc - MIN_MIDI), strings: [0, 1, 2, 3, 4, 5], lo: 0, hi: NECK_FRETS,
      frame: { lo: 0, hi: NECK_FRETS }, neck: true,
    };
  }
  if (c.shape === 'string') {
    for (const s of [4, 3, 2, 1, 0]) {
      const rf = mod12(keyPc - OPEN[s]);
      if (rf <= 5) return { tonic: OPEN[s] + rf, strings: [s], lo: rf, hi: rf + 12, frame: { lo: Math.max(0, rf - 1), hi: rf + 13 }, neck: false };
    }
  }
  const top = Math.max(...c.strings);
  let best = null;
  for (let t = -12; t <= 12; t++) {
    if (mod12(t - keyPc) !== 0) continue;
    if (c.lo + t - 1 < 0 || c.hi + t + 1 > MAX_FRET || OPEN[top] + c.hi + t + 1 > MAX_MIDI) continue;
    if (best === null || Math.abs(t) < Math.abs(best)) best = t;
  }
  if (best === null) throw new Error(`no placement for ${chapterId} in key ${keyPc}`);
  const t = best;
  return {
    tonic: OPEN[c.root[0]] + c.root[1] + t, strings: c.strings, lo: c.lo + t, hi: c.hi + t,
    frame: { lo: c.lo + t - 1, hi: c.hi + t + 1 }, neck: false,
  };
}

/**
 * Fretboard positions [string, fret] where `midi` can be played in a placement.
 * Whole neck: every position up to the 12th fret. A pattern: the one inside its fret window, or
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

// ---------- resolution to Do ----------

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
 * Offsets (semitones above the tonic) from `offset` stepwise to the nearest Do, the note itself
 * first. Notes from Sol up resolve upward, the rest downward; a chromatic note first moves to its
 * neighbour in that direction. With `tonic` (MIDI of Do) given, a path that would leave
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

export const FAMILIES = {
  major: { name: 'Major scale', mode: 'major', chromatic: false },
  majorChrom: { name: 'Major with chromatic notes', mode: 'major', chromatic: true },
  minor: { name: 'Minor scale', mode: 'minor', chromatic: false },
  minorChrom: { name: 'Minor with chromatic notes', mode: 'minor', chromatic: true },
  random: { name: 'Random key', mode: null, chromatic: false },
  dictation: { name: 'Dictation', mode: 'major', chromatic: false },
};

/** Note ranges as semitone spans above the tonic. `to: Infinity` runs to the top of the samples. */
const RANGES = [
  { id: '1st', name: 'First half', from: 0, to: 6 },
  { id: '2nd', name: 'Second half', from: 6, to: 12 },
  { id: 'oct', name: 'Whole octave', from: 0, to: 12 },
  { id: '2oct', name: 'Two octaves', from: 0, to: 24, neckOnly: true },
  { id: 'all', name: 'Many octaves', from: 0, to: Infinity, neckOnly: true },
];

const LENGTH_NAMES = ['Two', 'Three', 'Four', 'Five'];
const MAJOR_8 = [0, 2, 4, 5, 7, 9, 11, 12];

/**
 * Level spec: { id, idx, chapterId, family, name, tag, title, mode ('major'|'minor'|null), random
 * (null | 'major' | 'minor' | 'any': key, and for 'any' the mode, are drawn on every attempt),
 * chromatic, from, to, grow?, len? (notes per round, pairs and dictation families only; absent = 1) }. The first seven levels of every pattern chapter are the original
 * build-up levels and keep their ids `<chapter>-<0..6>`, so saved scores carry over.
 */
function levelsOf(chapter) {
  const out = [];
  const ch = chapter.id;
  const neck = chapter.shape === 'neck';
  const add = (family, spec) => out.push({
    chapterId: ch, family, chromatic: FAMILIES[family].chromatic, random: null, mode: FAMILIES[family].mode,
    tag: '', title: `${FAMILIES[family].name} · ${spec.name}`, ...spec,
  });
  const ranges = RANGES.filter((r) => neck || !r.neckOnly);
  for (const family of ['major', 'majorChrom', 'minor', 'minorChrom']) {
    if (family === 'major' && !neck) {
      for (let l = 0; l < LEVELS_PER_CHAPTER; l++) {
        add('major', {
          id: `${ch}-${l}`, grow: l, from: 0, to: MAJOR_8[l + 1],
          name: l === 0 ? 'Do · Re' : `Do – ${SOLFEGE[l + 1]}`,
          tag: l === 2 ? 'First half' : l === 6 ? 'Whole octave' : '',
        });
      }
      add('major', { id: `${ch}-major-2nd`, from: 6, to: 12, name: 'Second half' });
    } else {
      for (const r of ranges) add(family, { id: `${ch}-${family}-${r.id}`, from: r.from, to: r.to, name: r.name });
    }
  }
  add('random', { id: `${ch}-rk-major`, mode: 'major', random: 'major', from: 0, to: 12, name: 'Major, one octave' });
  add('random', { id: `${ch}-rk-minor`, mode: 'minor', random: 'minor', from: 0, to: 12, name: 'Minor, one octave' });
  if (neck) add('random', { id: `${ch}-rk-all`, mode: null, random: 'any', from: 0, to: Infinity, name: 'Major or minor, many octaves' });
  // Sequence levels: `len` target notes per round, answered note by note (see phrase.js).
  LENGTH_NAMES.forEach((w, i) => add('dictation', { id: `${ch}-dict-${i + 2}`, len: i + 2, from: 0, to: 12, name: `${w} notes` }));
  add('dictation', { id: `${ch}-dict-minor`, len: 4, from: 0, to: 12, mode: 'minor', name: 'Minor, four notes' });
  add('dictation', { id: `${ch}-dict-rk`, len: 4, from: 0, to: 12, mode: 'major', random: 'major', name: 'Random key, four notes' });
  return out.map((l, idx) => ({ ...l, idx }));
}

const LEVEL_CACHE = new Map();
/** All levels of a chapter, in display order. Index 0–6 are the original build-up levels. */
export function levelsFor(chapterId) {
  if (!LEVEL_CACHE.has(chapterId)) LEVEL_CACHE.set(chapterId, levelsOf(chapterById(chapterId)));
  return LEVEL_CACHE.get(chapterId);
}

/** Pick the key (and mode) for an attempt: fixed levels use `keyPc`, random ones draw. */
export function pickKey(level, keyPc, rng = Math.random) {
  if (!level.random) return { keyPc, mode: level.mode };
  return {
    keyPc: Math.floor(rng() * 12),
    mode: level.random === 'any' ? (rng() < 0.5 ? 'major' : 'minor') : level.random,
  };
}

/**
 * Everything the UI needs to run a level in a key: the ascending note ids (`pool`, offsets from the
 * tonic), their fretboard positions, the fret frame, and the cadence.
 * `multiOctave` is true when notes of the same name occur in several octaves.
 */
export function buildContext(chapterId, level, keyPc, mode) {
  const place = placeChapter(chapterId, keyPc);
  const positions = new Map();
  const pool = [];
  const maxOffset = MAX_MIDI - place.tonic;
  for (let o = level.from; o <= Math.min(level.to, maxOffset); o++) {
    if (!level.chromatic && !SCALES[mode].includes(mod12(o))) continue;
    const pos = positionsOf(place, place.tonic + o);
    if (!pos.length) continue;
    pool.push(o);
    positions.set(o, pos);
  }
  return {
    chapterId, level, keyPc, mode, tonic: place.tonic, frame: place.frame, pool, positions,
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
