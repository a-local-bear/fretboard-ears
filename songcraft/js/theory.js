// Keys, chords, roman numerals and what each chord does. Pure: no DOM, no audio.
// A chord is { root, q, beats }: root = semitones above the tonic (0–11), q = a key of QUALITIES.

export const mod12 = (n) => ((n % 12) + 12) % 12;

export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
export const PENTA = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };

/** iv: intervals above the root. fam: maj | min | dim | sus. */
export const QUALITIES = {
  '': { iv: [0, 4, 7], fam: 'maj', suffix: '', label: 'Triad' },
  m: { iv: [0, 3, 7], fam: 'min', suffix: 'm', label: 'Triad' },
  dim: { iv: [0, 3, 6], fam: 'dim', suffix: '°', label: 'Triad' },
  7: { iv: [0, 4, 7, 10], fam: 'maj', suffix: '7', label: '7' },
  maj7: { iv: [0, 4, 7, 11], fam: 'maj', suffix: 'maj7', label: 'maj7' },
  m7: { iv: [0, 3, 7, 10], fam: 'min', suffix: 'm7', label: 'm7' },
  m7b5: { iv: [0, 3, 6, 10], fam: 'dim', suffix: 'm7♭5', label: 'm7♭5' },
  dim7: { iv: [0, 3, 6, 9], fam: 'dim', suffix: '°7', label: '°7' },
  add9: { iv: [0, 4, 7, 14], fam: 'maj', suffix: 'add9', label: 'add9' },
  sus2: { iv: [0, 2, 7], fam: 'sus', suffix: 'sus2', label: 'sus2' },
  sus4: { iv: [0, 5, 7], fam: 'sus', suffix: 'sus4', label: 'sus4' },
  6: { iv: [0, 4, 7, 9], fam: 'maj', suffix: '6', label: '6' },
  m6: { iv: [0, 3, 7, 9], fam: 'min', suffix: 'm6', label: 'm6' },
  9: { iv: [0, 4, 7, 10, 14], fam: 'maj', suffix: '9', label: '9' },
  maj9: { iv: [0, 4, 7, 11, 14], fam: 'maj', suffix: 'maj9', label: 'maj9' },
  m9: { iv: [0, 3, 7, 10, 14], fam: 'min', suffix: 'm9', label: 'm9' },
};

/** The colours a chord of each family can take, in the order the builder offers them. */
export const FLAVOURS = {
  maj: ['', 'maj7', '7', 'add9', '6', 'sus2', 'sus4', 'maj9', '9'],
  min: ['m', 'm7', 'm9', 'm6', 'sus2', 'sus4'],
  dim: ['dim', 'm7b5', 'dim7'],
  sus: ['sus2', 'sus4', '', 'm'],
};

const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Flats for F B♭ E♭ A♭ D♭ major and their relative minors. */
export const usesFlats = (keyPc, mode) => [1, 3, 5, 8, 10].includes(mode === 'minor' ? mod12(keyPc + 3) : keyPc);
const letters = (keyPc, mode) => (usesFlats(keyPc, mode) ? FLAT : SHARP);
export const keyLetter = (keyPc, mode = 'major') => letters(keyPc, mode)[mod12(keyPc)];
export const keyName = (keyPc, mode) => `${keyLetter(keyPc, mode)} ${mode === 'minor' ? 'minor' : 'major'}`;

/** Letter name of the note `offset` semitones above the tonic, spelled for the key. */
export function noteName(offset, keyPc, mode) {
  const d = mod12(offset);
  if (SCALES[mode].includes(d)) return letters(keyPc, mode)[mod12(keyPc + d)];
  const flat = mode === 'minor' ? d === 1 : [1, 3, 8, 10].includes(d);
  return (flat ? FLAT : SHARP)[mod12(keyPc + d)];
}

/**
 * As noteName, but a note outside the key that is the major 3rd or 7th of the chord under it is
 * spelled as a raised note (G♯ over E7, not A♭), unless the chord itself is named with a flat.
 */
export function noteNameOver(offset, chord, keyPc, mode) {
  const d = mod12(offset);
  if (SCALES[mode].includes(d) || !chord) return noteName(offset, keyPc, mode);
  const raised = [4, 11].includes(mod12(d - chord.root)) && !noteName(chord.root, keyPc, mode).includes('♭');
  return raised ? SHARP[mod12(keyPc + d)] : noteName(offset, keyPc, mode);
}

/** Scale-degree label of a note: 1–7 in the major scale, with ♭ or ♯ for the notes between. */
export function degreeLabel(offset) {
  const d = mod12(offset);
  const i = SCALES.major.indexOf(d);
  if (i >= 0) return String(i + 1);
  return d === 6 ? '♯4' : '♭' + (SCALES.major.indexOf(d + 1) + 1);
}

export const chordPcs = (c) => [...new Set(QUALITIES[c.q].iv.map((i) => mod12(c.root + i)))];
export const isDiatonic = (c, mode) => chordPcs(c).every((pc) => SCALES[mode].includes(pc));

export function chordName(c, keyPc, mode) {
  const fam = QUALITIES[c.q].fam;
  // A diminished chord on a note outside the key is a raised note on its way up: spell it sharp.
  const root = fam === 'dim' && !SCALES[mode].includes(c.root) ? SHARP[mod12(keyPc + c.root)] : noteName(c.root, keyPc, mode);
  return root + QUALITIES[c.q].suffix;
}

const NUMERALS = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
const NUMERALS_SHARP = ['I', '♯I', 'II', '♯II', 'III', 'IV', '♯IV', 'V', '♯V', 'VI', '♯VI', 'VII'];
const ROMAN_SUFFIX = { m: '', m7: '7', m9: '9', m6: '6', dim: '°', m7b5: 'ø7', dim7: '°7' };

/** Roman numeral of a chord: capitals for major, small for minor and diminished. */
export function roman(c) {
  const fam = QUALITIES[c.q].fam;
  const lower = fam === 'min' || fam === 'dim';
  const num = (fam === 'dim' ? NUMERALS_SHARP : NUMERALS)[c.root]; // a diminished chord is a raised note on its way up
  const base = lower ? num.toLowerCase() : num;
  return base + (c.q in ROMAN_SUFFIX ? ROMAN_SUFFIX[c.q] : QUALITIES[c.q].suffix);
}

const ROMAN_RE = /^([b♭#♯]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/;
const BASES = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
const LOWER_Q = { '': 'm', 7: 'm7', 9: 'm9', 6: 'm6', '°': 'dim', 'ø7': 'm7b5', 'ø': 'm7b5', '°7': 'dim7', sus2: 'sus2', sus4: 'sus4' };

/** "IVmaj7", "♭VII", "ii7", "V7:2" (2 beats) → chord, or null if it cannot be read. */
export function parseRoman(text) {
  const [sym, len] = text.trim().split(':');
  const m = ROMAN_RE.exec(sym);
  if (!m) return null;
  const [, acc, num, rest] = m;
  const lower = num === num.toLowerCase();
  const root = mod12(BASES[num.toLowerCase()] + (acc === 'b' || acc === '♭' ? -1 : acc ? 1 : 0));
  const q = lower ? LOWER_Q[rest] : rest;
  if (q == null || !(q in QUALITIES)) return null;
  return { root, q, beats: len ? Number(len) : 4 };
}

/** "I V vi IV" → chords. Unreadable symbols are skipped. */
export const parseProg = (text) => text.trim().split(/\s+/).map(parseRoman).filter(Boolean);

const TRIADS = { major: ['', 'm', 'm', '', '', 'm', 'dim'], minor: ['m', 'dim', '', 'm', 'm', '', ''] };
const SEVENTHS = { major: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'], minor: ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'] };

/** The seven chords of the key, as triads or seventh chords. */
export const diatonic = (mode, sevenths = false) =>
  SCALES[mode].map((root, i) => ({ root, q: (sevenths ? SEVENTHS : TRIADS)[mode][i], beats: 4 }));

/** The seventh chord the key gives a root, or null for a root outside the key. */
export function diatonicSeventh(root, mode) {
  const i = SCALES[mode].indexOf(root);
  return i < 0 ? null : SEVENTHS[mode][i];
}

/** Chords from outside the key that songs reach for, as roman numerals. */
export const SPICE = {
  major: ['iv', '♭VII', '♭VI', '♭III', 'v', 'III7', 'VI7', 'II7', 'I7', '♯i°7', '♭II7'],
  minor: ['V', 'V7', 'IV', '♭II', 'I', 'ii', 'vii°7', 'I7'],
};

const B = {
  major: {
    I: 'Home. Every other chord is heard as a distance from this one.',
    ii: 'Away, with a soft minor colour. It loves to move on to V.',
    iii: 'Close to home. A floating stand-in for I, and a good bridge to IV.',
    IV: 'Away. Bright and open, the classic lift. It falls back to I or climbs to V.',
    V: 'Tension. It pulls harder than any other chord back to I.',
    vi: 'The sad twin of I. It feels like home, in minor.',
    vii: 'Tension, but fragile. Songs usually play V in its place.',
    iv: 'Borrowed from the minor key. The bittersweet move: play it after IV or just before I.',
    bVII: 'Borrowed from the minor key. Open and bright, a whole step below home.',
    bVI: 'Borrowed from the minor key. Dark and cinematic; ♭VI, ♭VII, I climbs home.',
    bIII: 'Borrowed from the minor key. A bluesy, heavy colour.',
    v: 'Borrowed minor five. It takes the pull out of V and sounds dreamy.',
    i: 'The key turns minor for a moment, as if the floor drops.',
    bII: 'A half step above home. It slides down into I.',
    tritone: 'A stand-in for V, a half step above home. It slides down into I.',
  },
  minor: {
    i: 'Home, in minor.',
    ii: 'Away, and tense. It leads to V.',
    bIII: 'The relative major: a brighter kind of home.',
    iv: 'Away. The minor four deepens the mood.',
    v: 'Soft tension. It drifts back to i without pushing.',
    bVI: 'Away. A warm lift out of the minor home.',
    bVII: 'Soft tension. It steps up to i or falls to ♭VI.',
    V: 'Strong tension. A major five (borrowed from the harmonic minor) that pulls hard to i.',
    vii: 'Tension. A leading-tone chord that resolves up to i.',
    IV: 'A major four in a minor key: the Dorian colour, hopeful.',
    bII: 'A half step above home. Dark, it slides down into i.',
    I: 'A major home chord in a minor key: unexpected sunshine.',
    dorianii: 'A minor two: the Dorian colour, lighter than the usual ii°.',
  },
};

/**
 * What a chord does in the key: { role: home | away | tension | spice, kind: key | borrowed |
 * secondary | passing | outside, target (root it points to, for push and passing chords), blurb }.
 */
export function describe(c, mode) {
  const fam = QUALITIES[c.q].fam;
  const r = c.root;
  const b = B[mode];
  const key = (role, blurb) => ({ role, kind: 'key', blurb });
  const spice = (kind, blurb, target = null) => ({ role: 'spice', kind, blurb, target });
  const push = () => {
    const target = mod12(r + 5);
    const t = roman({ root: target, q: SCALES[mode].includes(target) ? TRIADS[mode][SCALES[mode].indexOf(target)] : '' });
    return spice('secondary', `A push chord: the V of ${t}. It borrows V's tension to drive into ${t}.`, target);
  };
  const domType = c.q === '' || c.q === '7' || c.q === '9';
  if (mode === 'major') {
    if (isDiatonic(c, mode)) {
      return key(...({
        0: ['home', b.I], 2: ['away', b.ii], 4: ['home', b.iii], 5: ['away', b.IV], 7: ['tension', b.V], 9: ['home', b.vi], 11: ['tension', b.vii],
      })[r]);
    }
    if (fam === 'dim') return spice('passing', 'A passing diminished chord: a half-step stepping stone into the chord above it.', mod12(r + 1));
    if (r === 1 && c.q === '7') return spice('secondary', b.tritone, 0);
    if (domType && ([2, 4, 9, 11].includes(r) || (r === 0 && c.q !== ''))) return push();
    if (r === 5 && fam === 'min') return spice('borrowed', b.iv);
    if (r === 10 && fam === 'maj') return spice('borrowed', b.bVII);
    if (r === 8 && fam === 'maj') return spice('borrowed', b.bVI);
    if (r === 3 && fam === 'maj') return spice('borrowed', b.bIII);
    if (r === 7 && fam === 'min') return spice('borrowed', b.v);
    if (r === 0 && fam === 'min') return spice('borrowed', b.i);
    if (r === 1 && fam === 'maj') return spice('borrowed', b.bII);
  } else {
    if (isDiatonic(c, mode)) {
      return key(...({
        0: ['home', b.i], 2: ['away', b.ii], 3: ['home', b.bIII], 5: ['away', b.iv], 7: ['tension', b.v], 8: ['away', b.bVI], 10: ['tension', b.bVII],
      })[r]);
    }
    if (r === 7 && fam === 'maj') return { role: 'tension', kind: 'borrowed', blurb: b.V };
    if (r === 11 && fam === 'dim') return { role: 'tension', kind: 'borrowed', blurb: b.vii };
    if (fam === 'dim') return spice('passing', 'A passing diminished chord: a half-step stepping stone into the chord above it.', mod12(r + 1));
    if (r === 5 && fam === 'maj' && c.q !== '7' && c.q !== '9') return spice('borrowed', b.IV);
    if (r === 1 && fam === 'maj') return spice('borrowed', b.bII);
    if (r === 0 && fam === 'maj' && c.q !== '7' && c.q !== '9') return spice('borrowed', b.I);
    if (r === 2 && fam === 'min') return spice('borrowed', b.dorianii);
    if (domType && [0, 2, 3, 5, 10].includes(r)) return push();
  }
  return spice('outside', 'Outside the key. It can work, but let your ear decide.');
}

const REASONS = {
  major: {
    I: [['IV', 'lift away from home'], ['V', 'build tension'], ['vi', 'turn moody'], ['iii', 'drift, staying close to home']],
    ii: [['V', 'the classic next step'], ['IV', 'stay away a little longer'], ['iii', 'walk up the scale']],
    iii: [['IV', 'step up, a gentle lift'], ['vi', 'sink into the sad twin']],
    IV: [['V', 'climb to tension'], ['I', 'fall back home, softly'], ['iv', 'turn bittersweet'], ['vi', 'go moody']],
    V: [['I', 'release the tension'], ['vi', 'dodge home (deceptive)'], ['IV', 'back off, rock style']],
    vi: [['IV', 'the pop move'], ['ii', 'head for V'], ['V', 'build tension'], ['iii', 'stay in the shadows']],
    'vii°': [['I', 'resolve up'], ['iii', 'drift']],
    iv: [['I', 'fall home, bittersweet'], ['V', 'build tension']],
    '♭VII': [['IV', 'keep falling'], ['I', 'step up into home']],
    '♭VI': [['♭VII', 'climb towards home'], ['V', 'drop to tension']],
    '♭III': [['IV', 'step up'], ['♭VI', 'go darker']],
  },
  minor: {
    i: [['♭VI', 'a warm lift'], ['♭VII', 'step down'], ['iv', 'deepen the mood'], ['♭III', 'brighten']],
    'ii°': [['V', 'the classic next step'], ['v', 'soft tension']],
    '♭III': [['♭VII', 'keep it bright'], ['iv', 'darken'], ['♭VI', 'fall']],
    iv: [['V', 'strong tension'], ['i', 'fall home'], ['♭VII', 'step up']],
    v: [['i', 'drift home'], ['♭VI', 'dodge home']],
    V: [['i', 'release the tension'], ['♭VI', 'dodge home (deceptive)']],
    '♭VI': [['♭VII', 'climb towards home'], ['♭III', 'brighten'], ['V', 'drop to tension']],
    '♭VII': [['i', 'step up into home'], ['♭III', 'resolve to the relative major'], ['♭VI', 'keep falling']],
  },
};

/** Chords that tend to follow `c`: [{ chord, why }]. With `sevenths`, in-key answers come as seventh chords. */
export function suggestNext(c, mode, sevenths = false) {
  const info = describe(c, mode);
  let list;
  if (info.target != null) {
    const i = SCALES[mode].indexOf(info.target);
    const q = i >= 0 ? TRIADS[mode][i] : '';
    list = [[roman({ root: info.target, q }), 'land where it points']];
  } else {
    const tri = { ...c, q: QUALITIES[c.q].fam === 'min' ? 'm' : QUALITIES[c.q].fam === 'dim' ? 'dim' : '' };
    list = REASONS[mode][roman(tri)] || (mode === 'major' ? [['I', 'go home'], ['IV', 'lift'], ['V', 'build tension']] : [['i', 'go home'], ['♭VI', 'lift'], ['V', 'build tension']]);
  }
  return list.map(([sym, why]) => {
    const chord = parseRoman(sym);
    const q7 = sevenths && isDiatonic(chord, mode) ? diatonicSeventh(chord.root, mode) : null;
    return { chord: q7 ? { ...chord, q: q7 } : chord, why };
  });
}

/** Plain-language observations about a progression, most telling first (at most `max`). */
export function analyse(chords, mode, max = 6) {
  const n = chords.length;
  if (!n) return [];
  const rn = chords.map((c) => roman(c));
  const info = chords.map((c) => describe(c, mode));
  const fam = (c) => QUALITIES[c.q].fam;
  const out = [];
  const soft = [];
  const add = (list, text) => { if (!out.includes(text) && !soft.includes(text)) list.push(text); };
  const major = mode === 'major';
  const tonic = (c) => c.root === 0 && (major ? fam(c) === 'maj' || fam(c) === 'sus' : fam(c) === 'min' || fam(c) === 'sus');
  const dom = (c) => c.root === 7 && fam(c) !== 'min' && fam(c) !== 'dim';
  const home = major ? 'I' : 'i';

  if (tonic(chords[0])) add(soft, `It starts at home (${home}), so the key is clear from the first bar.`);
  else if (major && chords[0].root === 9 && fam(chords[0]) === 'min') add(out, 'It starts on vi, the sad twin of I: the same seven chords, a moodier song.');
  else add(out, `It starts away from home, on ${rn[0]}, so the loop is already in motion when it begins.`);

  for (let i = 0; i < n && n > 1; i++) {
    const j = (i + 1) % n;
    const a = chords[i];
    const b = chords[j];
    const k = (i + 2) % n;
    const pair = `${rn[i]} → ${rn[j]}${j === 0 ? ' (as it loops)' : ''}`;
    const step = mod12(b.root - a.root);
    if (a.root === b.root && a.q === b.q) continue;
    if ((a.root === 2 && fam(a) !== 'maj') && dom(b) && n > 2 && tonic(chords[k])) add(out, `${rn[i]} → ${rn[j]} → ${rn[k]}: away, tension, home. This is the engine of jazz.`);
    else if (dom(a) && tonic(b)) add(out, `${pair}: tension lets go. The strongest way home.`);
    else if (major && dom(a) && b.root === 9 && fam(b) === 'min') add(out, `${pair}: the ear expects home and gets its sad twin instead.`);
    else if (info[i].kind === 'secondary' && a.root === 1) add(out, `${pair}: ${rn[i]} stands in for V and slides down a half step into home.`);
    else if (info[i].kind === 'secondary') {
      add(out, b.root === info[i].target
        ? `${pair}: ${rn[i]} is a push chord, and it lands exactly where it points.`
        : `${rn[i]} is a push chord that points somewhere else than ${rn[j]}: a deliberate swerve.`);
    } else if (info[i].kind === 'passing') add(out, `${pair}: ${rn[i]} is a half-step stepping stone${b.root === info[i].target ? ' into the next chord' : ''}.`);
    else if (major && a.root === 5 && fam(a) === 'maj' && b.root === 5 && fam(b) === 'min') add(out, `${pair}: one note drops a half step. The bittersweet indie move.`);
    else if (major && a.root === 5 && fam(a) === 'min' && tonic(b)) add(out, `${pair}: the borrowed minor four falls home.`);
    else if (a.root === 5 && tonic(b)) add(out, `${pair}: a soft landing, gentler than V → ${home}.`);
    else if (a.root === 10 && fam(a) === 'maj' && tonic(b)) add(out, `${pair}: a whole step up into home, open and bright.`);
    else if (a.root === 8 && b.root === 10 && fam(a) === 'maj' && fam(b) === 'maj') add(out, `${pair}: two major chords climbing by whole steps towards home.`);
    else if (a.root === 2 && fam(a) !== 'maj' && dom(b)) add(out, `${pair}: the first half of jazz's favourite move. It wants ${home} next.`);
    else if (info[i].kind === 'borrowed' && info[i].role === 'spice') add(out, `${rn[i]} is borrowed from outside the key: a moment of unexpected colour.`);
    else if (step === 5) add(soft, `${pair}: the root moves up a fourth, the strongest pull between two chords.`);
    else if ([3, 4, 8, 9].includes(step)) add(soft, `${pair}: the two chords share notes, so the change is gentle.`);
    else if ([1, 2, 10, 11].includes(step)) add(soft, `${pair}: the root moves by step, like a bass line walking.`);
  }

  const last = chords[n - 1];
  if (n > 1 && info[n - 1].role === 'tension') add(out, `It ends on tension (${rn[n - 1]}), so every pass pulls back to the start.`);
  else if (n > 1 && tonic(last)) add(soft, `It ends at home: finished and calm. Good for an ending, less urgent as a loop.`);
  if (n > 1 && !chords.some(tonic)) add(out, `It never lands on ${home}, so it floats without resolving.`);
  return out.concat(soft).slice(0, max);
}

/** The key that shares its notes: G major ↔ E minor. */
export const relativeKey = (keyPc, mode) => (mode === 'major' ? { key: mod12(keyPc + 9), mode: 'minor' } : { key: mod12(keyPc + 3), mode: 'major' });
