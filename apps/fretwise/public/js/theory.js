// Pitch, staff and fretboard arithmetic.  Pure functions, no DOM.
//
// Conventions used across the app
//   * "written" pitch is what appears on the staff.  Guitar music is written an
//     octave above where it sounds, so the open 1st string (sounding E4) is
//     written as E5, in the top space of the treble staff.
//   * staff "step": 0 = bottom line (E4), 1 = first space (F4) ... 8 = top line (F5).
//   * strings are numbered the way guitarists do: 1 = thinnest (high E), 6 = thickest.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** sounding MIDI number of each open string, index = string number */
export const OPEN = [0, 64, 59, 55, 50, 45, 40];
export const STRING_LETTER = ['', 'E', 'B', 'G', 'D', 'A', 'E'];
export const WRITTEN_SHIFT = 12;
export const ORDINALS = ['open', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th'];

export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);
export const freqToMidi = (freq) => 69 + 12 * Math.log2(freq / 440);

// ---------------------------------------------------------------------------
// Pitches
// ---------------------------------------------------------------------------
export function makePitch(letter, alter, octave) {
  return {
    letter, alter, octave,
    midi: (octave + 1) * 12 + SEMITONE[letter] + alter,
    step: octave * 7 + LETTERS.indexOf(letter) - 30,
    id: letter + (alter > 0 ? '#' : alter < 0 ? 'b' : '') + octave,
  };
}

/** "F#5" / "Bb3" / "E4" -> pitch */
export function parsePitch(text) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(text);
  if (!m) throw new Error(`bad pitch "${text}"`);
  return makePitch(m[1], m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, Number(m[3]));
}

/** choose a spelling for a MIDI number; black keys become sharps or flats */
export function spell(midi, prefer = 'sharp') {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const natural = LETTERS.find((l) => SEMITONE[l] === pc);
  if (natural) return makePitch(natural, 0, octave);
  return prefer === 'flat'
    ? makePitch(LETTERS.find((l) => SEMITONE[l] === pc + 1), -1, octave)
    : makePitch(LETTERS.find((l) => SEMITONE[l] === pc - 1), 1, octave);
}

/** the natural note `steps` staff positions away */
export function diatonicShift(pitch, steps) {
  const index = pitch.octave * 7 + LETTERS.indexOf(pitch.letter) + steps;
  return makePitch(LETTERS[((index % 7) + 7) % 7], 0, Math.floor(index / 7));
}

/** plain-text note name: "F♯", "B♭", "E" */
export const pitchName = (p) => p.letter + (p.alter > 0 ? '♯' : p.alter < 0 ? '♭' : '');
/** name without unicode, used as a stable answer id: "F#", "Bb", "E" */
export const pitchClassId = (p) => p.letter + (p.alter > 0 ? '#' : p.alter < 0 ? 'b' : '');

// ---------------------------------------------------------------------------
// Fretboard positions
// ---------------------------------------------------------------------------
/** a note at a specific place on the neck */
export function noteAt(string, fret, prefer = 'sharp') {
  if (!(string >= 1 && string <= 6) || !(fret >= 0 && fret <= 24)) throw new Error(`bad position ${string}:${fret}`);
  const sounding = OPEN[string] + fret;
  const pitch = spell(sounding + WRITTEN_SHIFT, prefer);
  return { s: string, f: fret, key: `s${string}f${fret}`, sounding, pitch, step: pitch.step, name: pitchName(pitch), nameId: pitchClassId(pitch) };
}

/** "1:3" -> note; "4:4#" / "3:3b" choose the spelling of a black key */
export function parsePos(text) {
  const m = /^([1-6]):(\d{1,2})([#b])?$/.exec(text);
  if (!m) throw new Error(`bad position "${text}"`);
  return noteAt(Number(m[1]), Number(m[2]), m[3] === 'b' ? 'flat' : 'sharp');
}
export const parsePosList = (text) => text.trim().split(/\s+/).filter(Boolean).map(parsePos);

export function noteFromKey(key, prefer = 'sharp') {
  const m = /^s([1-6])f(\d{1,2})$/.exec(key);
  if (!m) throw new Error(`bad note key "${key}"`);
  return noteAt(Number(m[1]), Number(m[2]), prefer);
}

/** every place a sounding pitch can be played inside a fret window */
export function positionsFor(sounding, frets = [0, 12]) {
  const out = [];
  for (let s = 1; s <= 6; s++) {
    const f = sounding - OPEN[s];
    if (f >= frets[0] && f <= frets[1]) out.push({ s, f });
  }
  return out;
}

/** the conventional place to play a written pitch inside a fret window (lowest fret wins) */
export function locate(pitch, { frets = [0, 4], string = null } = {}) {
  const sounding = pitch.midi - WRITTEN_SHIFT;
  const options = positionsFor(sounding, frets).filter((p) => !string || p.s === string);
  if (!options.length) return null;
  options.sort((a, b) => a.f - b.f || a.s - b.s);
  const { s, f } = options[0];
  return { ...noteAt(s, f), pitch, step: pitch.step, name: pitchName(pitch), nameId: pitchClassId(pitch) };
}

export const describePos = (n) => (n.f === 0 ? `open ${ORDINALS[n.s]} string` : `${ORDINALS[n.s]} string, ${ORDINALS[n.f]} fret`);
export const shortPos = (n) => (n.f === 0 ? `string ${n.s}, open` : `string ${n.s}, fret ${n.f}`);

/** where a staff step sits, in words */
export function describeStep(step) {
  const lines = ['bottom line', 'second line', 'middle line', 'fourth line', 'top line'];
  const spaces = ['bottom space', 'second space', 'third space', 'top space'];
  if (step >= 0 && step <= 8) return step % 2 === 0 ? `on the ${lines[step / 2]}` : `in the ${spaces[(step - 1) / 2]}`;
  const nth = ['first', 'second', 'third', 'fourth', 'fifth'];
  if (step === -1) return 'hanging just below the staff';
  if (step === 9) return 'sitting just above the staff';
  if (step < 0) {
    const n = Math.floor(-step / 2);
    return step % 2 === 0 ? `on the ${nth[n - 1]} ledger line below the staff` : `hanging under the ${nth[n - 1]} ledger line below the staff`;
  }
  const n = Math.floor((step - 8) / 2);
  return step % 2 === 0 ? `on the ${nth[n - 1]} ledger line above the staff` : `sitting above the ${nth[n - 1]} ledger line above the staff`;
}

// ---------------------------------------------------------------------------
// Key signatures
// ---------------------------------------------------------------------------
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
/** staff steps where each accidental of a treble-clef key signature is drawn */
export const KEY_SIG_STEPS = { sharp: [8, 5, 9, 6, 3, 7, 4], flat: [4, 7, 3, 6, 2, 5, 1] };
const MAJOR_KEYS = { '-3': 'E♭', '-2': 'B♭', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E' };
const MINOR_KEYS = { '-3': 'C', '-2': 'G', '-1': 'D', 0: 'A', 1: 'E', 2: 'B', 3: 'F♯', 4: 'C♯' };

/** key signature (positive = sharps, negative = flats) -> {letter: alteration} */
export function keyAlterations(keySig = 0) {
  const out = {};
  const order = keySig > 0 ? SHARP_ORDER : FLAT_ORDER;
  for (let i = 0; i < Math.abs(keySig); i++) out[order[i]] = keySig > 0 ? 1 : -1;
  return out;
}
export const keyName = (keySig) => `${MAJOR_KEYS[keySig]} major`;
export const relativeMinor = (keySig) => `${MINOR_KEYS[keySig]} minor`;
export const keySigLetters = (keySig) => (keySig > 0 ? SHARP_ORDER : FLAT_ORDER).slice(0, Math.abs(keySig));

// ---------------------------------------------------------------------------
// Rhythm
// ---------------------------------------------------------------------------
const BASE_BEATS = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
export const DURATION_NAMES = { w: 'whole', h: 'half', q: 'quarter', e: 'eighth', s: 'sixteenth' };

/** "q", "h.", "e" -> {base, dots, beats} (beats are quarter notes) */
export function parseDur(text) {
  const m = /^([whqes])(\.?)$/.exec(text);
  if (!m) throw new Error(`bad duration "${text}"`);
  const dots = m[2] ? 1 : 0;
  return { base: m[1], dots, beats: BASE_BEATS[m[1]] * (dots ? 1.5 : 1), code: text };
}
export const durName = (dur) => `${dur.dots ? 'dotted ' : ''}${DURATION_NAMES[dur.base]}`;
/** quarter-note beats in one measure */
export const measureBeats = (timeSig) => timeSig[0] * (4 / timeSig[1]);

/**
 * Parse a compact melody:  "E5:q F5:q G5:h | r:q E5:q. D5:e D5:h~ | D5:w"
 *   pitch:duration, "r" = rest, trailing "~" ties into the next note,
 *   optional "@3" pins the note to a string.
 * Returns an array of measures; every event is {pitch|null, dur, tie, string}.
 */
export function parseMelody(text) {
  return text.split('|').map((bar) => bar.trim()).filter(Boolean).map((bar) => bar.split(/\s+/).map((tok) => {
    const m = /^([A-G][#b]?\d|r):([whqes]\.?)(~)?(?:@([1-6]))?$/.exec(tok);
    if (!m) throw new Error(`bad melody token "${tok}"`);
    return {
      pitch: m[1] === 'r' ? null : parsePitch(m[1]),
      dur: parseDur(m[2]),
      tie: Boolean(m[3]),
      string: m[4] ? Number(m[4]) : null,
    };
  }));
}

/**
 * Decide which accidentals must be printed.  Follows the usual rule: an
 * accidental lasts until the end of the measure, the key signature applies
 * otherwise.  Sets `event.acc` to '#', 'b', 'n' or null on every event.
 * With {explicit: true} every altered note carries its sign each time — used
 * before the course has taught the bar-line rule.
 */
export function markAccidentals(measures, keySig = 0, { explicit = false } = {}) {
  const key = keyAlterations(keySig);
  const sign = (alter) => (alter > 0 ? '#' : alter < 0 ? 'b' : 'n');
  let tiedFrom = null;
  for (const measure of measures) {
    const inBar = {};
    for (const ev of measure) {
      ev.acc = null;
      if (!ev.pitch) { tiedFrom = null; continue; }
      const slot = ev.pitch.letter + ev.pitch.octave;
      const inKey = key[ev.pitch.letter] || 0;
      const current = slot in inBar ? inBar[slot] : inKey;
      const continuation = tiedFrom !== null && tiedFrom === ev.pitch.midi;
      if (!continuation && (ev.pitch.alter !== current || (explicit && ev.pitch.alter !== inKey))) ev.acc = sign(ev.pitch.alter);
      inBar[slot] = ev.pitch.alter;
      tiedFrom = ev.tie ? ev.pitch.midi : null;
    }
  }
  return measures;
}

/** start time (in beats) of every event of a melody, flattened */
export function timeline(measures) {
  const out = [];
  let t = 0;
  measures.forEach((measure, mi) => {
    for (const ev of measure) {
      out.push({ ...ev, t, measure: mi });
      t += ev.dur.beats;
    }
  });
  return out;
}

/**
 * The moments a player actually strikes a note: rests and the tails of ties
 * are dropped, tied notes are merged into one long note.
 */
export function onsets(measures) {
  const out = [];
  let carry = null;
  for (const ev of timeline(measures)) {
    if (!ev.pitch) { carry = null; continue; }
    if (carry && carry.pitch.midi === ev.pitch.midi) { carry.beats += ev.dur.beats; carry = ev.tie ? carry : null; continue; }
    const hit = { t: ev.t, beats: ev.dur.beats, pitch: ev.pitch, measure: ev.measure };
    out.push(hit);
    carry = ev.tie ? hit : null;
  }
  return out;
}
