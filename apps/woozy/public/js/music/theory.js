// Music theory core: notes, keys, scales, chord qualities, Roman numerals.
// Pure functions, no DOM — also imported by the Node tests.
//
// Conventions used across the app:
//   pc     pitch class 0–11 (C = 0)
//   deg    semitones above the key's tonic, 0–11
//   q      chord-quality id, a key of QUALITIES ('' = major triad)
//   Roman numerals are always measured against the tonic's MAJOR scale, so the
//   chords of A minor are i, bIII, iv, v, bVI, bVII (the usual pop/jazz habit).

export const mod12 = (n) => ((n % 12) + 12) % 12;

const LETTERS = 'CDEFGAB';
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const MINOR_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

// ---------------------------------------------------------------- notes ----

export function notePc(name) {
  const m = /^([A-Ga-g])([#b]*)/.exec(String(name).trim());
  if (!m) throw new Error(`Not a note name: ${name}`);
  let pc = LETTER_PC[LETTERS.indexOf(m[1].toUpperCase())];
  for (const ch of m[2]) pc += ch === '#' ? 1 : -1;
  return mod12(pc);
}

const AWKWARD = new Set(['Cb', 'Fb', 'E#', 'B#']);

// Spell `pc` using the given letter when that needs at most one accidental;
// otherwise fall back to the plain sharp/flat name.
function spell(letterIdx, pc, preferFlat) {
  const diff = ((pc - LETTER_PC[letterIdx] + 18) % 12) - 6;
  if (Math.abs(diff) <= 1) {
    const name = LETTERS[letterIdx] + (diff === 1 ? '#' : diff === -1 ? 'b' : '');
    if (!AWKWARD.has(name)) return name;
  }
  return (preferFlat ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}

export function midiName(midi, preferFlat = false) {
  return (preferFlat ? FLAT_NAMES : SHARP_NAMES)[mod12(midi)] + (Math.floor(midi / 12) - 1);
}

// ------------------------------------------------------------ intervals ----

// 'b3', '#11', 'bb7', '5' → { semis, step } (step = letter distance, 0–6)
export function parseInterval(label) {
  const m = /^([b#]*)(\d+)$/.exec(label);
  if (!m) throw new Error(`Bad interval: ${label}`);
  const num = Number(m[2]);
  let semis = MAJOR_STEPS[(num - 1) % 7] + 12 * Math.floor((num - 1) / 7);
  for (const ch of m[1]) semis += ch === '#' ? 1 : -1;
  return { semis, step: (num - 1) % 7, num, label };
}

// Letter step + label for each semitone above a tonic (used for spelling).
const DEGREE_STEP = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
export const DEGREE_LABELS = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];
export const INTERVAL_LABELS = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

// ----------------------------------------------------------------- keys ----

export function makeKey(tonic, mode = 'major') {
  const pc = notePc(tonic);
  let preferFlat;
  if (tonic.includes('b')) preferFlat = true;
  else if (tonic.includes('#')) preferFlat = false;
  else preferFlat = mode === 'minor' ? 'DGCF'.includes(tonic[0]) : tonic[0] === 'F';
  return { tonic, pc, mode, letter: LETTERS.indexOf(tonic[0].toUpperCase()), preferFlat };
}

// Name of the note `deg` semitones above the tonic, spelled for this key.
export function noteName(key, deg) {
  const d = mod12(deg);
  return spell((key.letter + DEGREE_STEP[d]) % 7, key.pc + d, key.preferFlat);
}

export const pcName = (key, pc) => noteName(key, pc - key.pc);

// --------------------------------------------------------------- scales ----

export const SCALES = {
  major: { name: 'Major', iv: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'Natural minor', iv: [0, 2, 3, 5, 7, 8, 10] },
  dorian: { name: 'Dorian', iv: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { name: 'Mixolydian', iv: [0, 2, 4, 5, 7, 9, 10] },
  lydian: { name: 'Lydian', iv: [0, 2, 4, 6, 7, 9, 11] },
  phrygian: { name: 'Phrygian', iv: [0, 1, 3, 5, 7, 8, 10] },
  harmonicMinor: { name: 'Harmonic minor', iv: [0, 2, 3, 5, 7, 8, 11] },
  majorPent: { name: 'Major pentatonic', iv: [0, 2, 4, 7, 9] },
  minorPent: { name: 'Minor pentatonic', iv: [0, 3, 5, 7, 10] },
  blues: { name: 'Blues', iv: [0, 3, 5, 6, 7, 10] },
};

export const scaleFor = (mode) => SCALES[mode === 'minor' ? 'minor' : mode] || SCALES.major;

// ------------------------------------------------------- chord qualities ----

// fam: maj | min | dom | dim | sus — used to pick Roman-numeral case and to
// group qualities in pickers.
const Q = (label, iv, fam, symbol) => {
  const parsed = iv.map(parseInterval);
  return { label, iv, fam, symbol, semis: parsed.map((p) => p.semis), parsed };
};

export const QUALITIES = {
  '': Q('major', ['1', '3', '5'], 'maj', ''),
  m: Q('minor', ['1', 'b3', '5'], 'min', 'm'),
  dim: Q('diminished', ['1', 'b3', 'b5'], 'dim', 'dim'),
  aug: Q('augmented', ['1', '3', '#5'], 'maj', 'aug'),
  sus2: Q('sus2', ['1', '2', '5'], 'sus', 'sus2'),
  sus4: Q('sus4', ['1', '4', '5'], 'sus', 'sus4'),
  6: Q('major 6', ['1', '3', '5', '6'], 'maj', '6'),
  m6: Q('minor 6', ['1', 'b3', '5', '6'], 'min', 'm6'),
  maj7: Q('major 7', ['1', '3', '5', '7'], 'maj', 'maj7'),
  m7: Q('minor 7', ['1', 'b3', '5', 'b7'], 'min', 'm7'),
  7: Q('dominant 7', ['1', '3', '5', 'b7'], 'dom', '7'),
  m7b5: Q('half-diminished', ['1', 'b3', 'b5', 'b7'], 'dim', 'm7b5'),
  dim7: Q('diminished 7', ['1', 'b3', 'b5', 'bb7'], 'dim', 'dim7'),
  mMaj7: Q('minor-major 7', ['1', 'b3', '5', '7'], 'min', 'm(maj7)'),
  '7sus4': Q('7sus4', ['1', '4', '5', 'b7'], 'dom', '7sus4'),
  add9: Q('add9', ['1', '3', '5', '9'], 'maj', 'add9'),
  madd9: Q('minor add9', ['1', 'b3', '5', '9'], 'min', 'm(add9)'),
  '6/9': Q('6/9', ['1', '3', '5', '6', '9'], 'maj', '6/9'),
  maj9: Q('major 9', ['1', '3', '5', '7', '9'], 'maj', 'maj9'),
  m9: Q('minor 9', ['1', 'b3', '5', 'b7', '9'], 'min', 'm9'),
  9: Q('dominant 9', ['1', '3', '5', 'b7', '9'], 'dom', '9'),
  m11: Q('minor 11', ['1', 'b3', '5', 'b7', '9', '11'], 'min', 'm11'),
  13: Q('dominant 13', ['1', '3', '5', 'b7', '9', '13'], 'dom', '13'),
  '7#9': Q('7#9', ['1', '3', '5', 'b7', '#9'], 'dom', '7#9'),
  '7b9': Q('7b9', ['1', '3', '5', 'b7', 'b9'], 'dom', '7b9'),
  'maj7#11': Q('major 7 #11', ['1', '3', '5', '7', '#11'], 'maj', 'maj7#11'),
};

export const QUALITY_GROUPS = [
  { name: 'Major family', ids: ['', 'maj7', 'maj9', '6', '6/9', 'add9', 'maj7#11', 'aug'] },
  { name: 'Minor family', ids: ['m', 'm7', 'm9', 'm11', 'm6', 'madd9', 'mMaj7'] },
  { name: 'Dominant family', ids: ['7', '9', '13', '7sus4', '7#9', '7b9'] },
  { name: 'Suspended', ids: ['sus2', 'sus4'] },
  { name: 'Diminished', ids: ['m7b5', 'dim', 'dim7'] },
];

export const qSymbol = (q) => QUALITIES[q].symbol;
export const isMinorish = (q) => QUALITIES[q].fam === 'min' || QUALITIES[q].fam === 'dim';

// Interval label for each pitch class of a chord, relative to its root:
// { 0: 'R', 4: '3', 7: '5', 11: '7' }
export function toneLabels(q) {
  const out = {};
  for (const p of QUALITIES[q].parsed) out[mod12(p.semis)] = p.label === '1' ? 'R' : p.label;
  return out;
}

// Spelled note names of a chord: chordNotes('D', 'maj7') → ['D','F#','A','C#']
export function chordNotes(rootName, q) {
  const rootPc = notePc(rootName);
  const letter = LETTERS.indexOf(rootName[0].toUpperCase());
  const preferFlat = rootName.includes('b') || rootName === 'F';
  return QUALITIES[q].parsed.map((p) => spell((letter + p.step) % 7, rootPc + p.semis, preferFlat));
}

const SYMBOL_TO_Q = (() => {
  const map = new Map();
  for (const [id, q] of Object.entries(QUALITIES)) {
    map.set(id, id);
    map.set(q.symbol, id);
  }
  const alias = {
    M7: 'maj7', Maj7: 'maj7', min7: 'm7', min: 'm', 'ø': 'm7b5', 'ø7': 'm7b5', o: 'dim', '°': 'dim',
    '°7': 'dim7', o7: 'dim7', '+': 'aug', sus: 'sus4', madd9: 'madd9', '69': '6/9', mM7: 'mMaj7',
  };
  for (const [k, v] of Object.entries(alias)) map.set(k, v);
  return map;
})();

// 'F#m7' → { root: 'F#', rootPc: 6, q: 'm7' }.  q is null for unknown suffixes
// (slash chords, add11 …) so callers can still use the root.
export function parseChord(name) {
  const m = /^([A-G][#b]?)(.*)$/.exec(String(name).trim());
  if (!m) return null;
  const suffix = m[2].split('/')[0] === m[2] || SYMBOL_TO_Q.has(m[2]) ? m[2] : m[2].split('/')[0];
  const q = SYMBOL_TO_Q.has(suffix) ? SYMBOL_TO_Q.get(suffix) : null;
  return { root: m[1], rootPc: notePc(m[1]), q };
}

// ------------------------------------------------------- Roman numerals ----

const ROMAN = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
const ROMAN_SUFFIX = {
  '': '', m: '', dim: '°', aug: '+', sus2: 'sus2', sus4: 'sus4', 6: '6', m6: '6', maj7: 'maj7',
  m7: '7', 7: '7', m7b5: 'ø7', dim7: '°7', mMaj7: '(maj7)', '7sus4': '7sus4', add9: 'add9',
  madd9: 'add9', '6/9': '6/9', maj9: 'maj9', m9: '9', 9: '9', m11: '11', 13: '13', '7#9': '7#9',
  '7b9': '7b9', 'maj7#11': 'maj7#11',
};

// Diminished chords on the "black-key" degrees are passing chords that climb,
// so they are named from below: #i°7 (C#°7 in C), not bii°7.
const RAISED = { 1: ['#I', 0], 3: ['#II', 1], 6: ['#IV', 3], 8: ['#V', 4], 10: ['#VI', 5] };
const isRaisedDim = (deg, q) => (q === 'dim' || q === 'dim7') && RAISED[mod12(deg)] !== undefined;

export function romanOf(deg, q) {
  let r = isRaisedDim(deg, q) ? RAISED[mod12(deg)][0] : ROMAN[mod12(deg)];
  if (isMinorish(q)) r = r.replace(/[IV]+/, (s) => s.toLowerCase());
  return r + ROMAN_SUFFIX[q];
}

const RN = /^([b#]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/;
const RN_INDEX = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
const UPPER_SUFFIX = {
  '': '', maj7: 'maj7', 7: '7', 9: '9', maj9: 'maj9', 6: '6', '6/9': '6/9', 13: '13', sus2: 'sus2',
  sus4: 'sus4', '7sus4': '7sus4', add9: 'add9', '+': 'aug', aug: 'aug', '7#9': '7#9', '7b9': '7b9',
  'maj7#11': 'maj7#11',
};
const LOWER_SUFFIX = {
  '': 'm', 7: 'm7', 9: 'm9', 11: 'm11', 6: 'm6', 'ø': 'm7b5', 'ø7': 'm7b5', '7b5': 'm7b5',
  '°': 'dim', dim: 'dim', '°7': 'dim7', dim7: 'dim7', '(maj7)': 'mMaj7', maj7: 'mMaj7', add9: 'madd9',
};

// 'bVImaj7' → { deg: 8, q: 'maj7' };  'V7/ii' → { deg: 9, q: '7', label: 'V7/ii' }
export function parseRoman(str) {
  const slash = str.lastIndexOf('/');
  if (slash > 0) {
    const target = RN.exec(str.slice(slash + 1));
    if (target && target[3] === '') {
      const base = parseRoman(str.slice(0, slash));
      const t = parseRoman(str.slice(slash + 1));
      return { deg: mod12(base.deg + t.deg), q: base.q, label: str };
    }
  }
  const m = RN.exec(str);
  if (!m) throw new Error(`Bad Roman numeral: ${str}`);
  const upper = m[2] === m[2].toUpperCase();
  const q = (upper ? UPPER_SUFFIX : LOWER_SUFFIX)[m[3]];
  if (q === undefined) throw new Error(`Unknown chord suffix in: ${str}`);
  const acc = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
  return { deg: mod12(MAJOR_STEPS[RN_INDEX[m[2].toUpperCase()]] + acc), q };
}

// 'Imaj7 | vi7 | ii7 V7 | Imaj7'  → [{ deg, q, beats, label? }]
//   · bars are split by |, chords inside a bar share its four beats equally
//   · 'V7:1' sets beats explicitly, '%' repeats the previous chord for a bar
export function parseProgression(str) {
  const out = [];
  for (const bar of str.split('|')) {
    const tokens = bar.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const share = 4 / tokens.length;
    for (const tok of tokens) {
      if (tok === '%') {
        if (out.length) out[out.length - 1].beats += share;
        continue;
      }
      const [sym, beats] = tok.split(':');
      out.push({ ...parseRoman(sym), beats: beats ? Number(beats) : share });
    }
  }
  return out;
}

// --------------------------------------------------------- chords in key ----

export function chordIn(key, c) {
  const rootPc = mod12(key.pc + c.deg);
  const root = isRaisedDim(c.deg, c.q)
    ? spell((key.letter + RAISED[mod12(c.deg)][1]) % 7, rootPc, false)
    : noteName(key, c.deg);
  return {
    ...c,
    rootPc,
    root,
    symbol: root + qSymbol(c.q),
    roman: c.label || romanOf(c.deg, c.q),
    pcs: QUALITIES[c.q].semis.map((s) => mod12(rootPc + s)),
  };
}

const TRIADS = { '4,7': '', '3,7': 'm', '3,6': 'dim', '4,8': 'aug' };
const SEVENTHS = { '4,7,11': 'maj7', '3,7,10': 'm7', '4,7,10': '7', '3,6,10': 'm7b5', '3,6,9': 'dim7', '3,7,11': 'mMaj7' };

// Harmonise a 7-note scale by stacking thirds.
export function diatonicChords(scaleIv, sevenths = true) {
  return scaleIv.map((root, i) => {
    const tone = (k) => mod12(scaleIv[(i + k) % 7] - root);
    const key = sevenths ? [tone(2), tone(4), tone(6)].join(',') : [tone(2), tone(4)].join(',');
    const q = (sevenths ? SEVENTHS : TRIADS)[key];
    return { deg: root, q: q ?? (sevenths ? 'maj7' : '') };
  });
}

const FUNCTION_BY_DEG = {
  major: { 0: 'T', 2: 'S', 4: 'T', 5: 'S', 7: 'D', 9: 'T', 11: 'D' },
  minor: { 0: 'T', 2: 'S', 3: 'T', 5: 'S', 7: 'D', 8: 'S', 10: 'D' },
};
export const FUNCTION_NAMES = { T: 'home', S: 'away', D: 'tension' };

const BORROWED = {
  major: [
    { deg: 5, fam: ['min'], why: 'the minor iv, borrowed from the parallel minor' },
    { deg: 10, fam: ['maj', 'dom', 'sus'], why: 'bVII, borrowed from Mixolydian / the parallel minor' },
    { deg: 8, fam: ['maj'], why: 'bVI, borrowed from the parallel minor' },
    { deg: 3, fam: ['maj'], why: 'bIII, borrowed from the parallel minor' },
    { deg: 7, fam: ['min'], why: 'the minor v, borrowed from the parallel minor' },
    { deg: 2, fam: ['dim'], why: 'iiø, borrowed from the parallel minor' },
    { deg: 0, fam: ['min'], why: 'the tonic turned minor' },
    { deg: 1, fam: ['maj'], why: 'bII, borrowed from Phrygian' },
  ],
  minor: [
    { deg: 5, fam: ['maj', 'dom'], why: 'the major IV — the Dorian sound' },
    { deg: 7, fam: ['maj', 'dom'], why: 'the major V, borrowed from harmonic minor' },
    { deg: 2, fam: ['min'], why: 'ii minor — the Dorian sound' },
    { deg: 0, fam: ['maj'], why: 'the tonic turned major' },
    { deg: 1, fam: ['maj'], why: 'bII, borrowed from Phrygian' },
    { deg: 9, fam: ['dim'], why: 'viø from Dorian / melodic minor' },
  ],
};

// What job does a chord do in this key?
//   kind: 'diatonic' | 'borrowed' | 'secondary' | 'passing' | 'chromatic'
//   fn:   'T' | 'S' | 'D' | null
export function analyzeChord(mode, c) {
  const m = mode === 'minor' ? 'minor' : 'major';
  const scale = scaleFor(m).iv;
  const deg = mod12(c.deg);
  const quality = QUALITIES[c.q];
  const fam = quality.fam;
  const inScale = quality.semis.every((s) => scale.includes(mod12(deg + s)));
  if (inScale) {
    return { kind: 'diatonic', fn: FUNCTION_BY_DEG[m][deg] ?? null, why: 'in the key' };
  }
  if (fam === 'dom' && deg === 1) {
    return { kind: 'secondary', fn: 'D', why: 'tritone substitute for V7 — slides down a half-step to I' };
  }
  for (const b of BORROWED[m]) {
    if (b.deg === deg && b.fam.includes(fam)) {
      const fn = deg === 7 ? 'D' : deg === 0 || deg === 3 ? 'T' : 'S';
      return { kind: 'borrowed', fn, why: b.why };
    }
  }
  if (fam === 'dom' || c.q === '' || c.q === 'aug') {
    const target = mod12(deg + 5);
    if (scale.includes(target) && target !== 0) {
      const t = diatonicChords(scale, false).find((d) => d.deg === target);
      return { kind: 'secondary', fn: 'D', why: `secondary dominant — pulls to ${romanOf(target, t.q)}` };
    }
    if (target === 0) return { kind: 'diatonic', fn: 'D', why: 'the dominant, with altered colour' };
  }
  if (c.q === 'dim7' || c.q === 'dim') {
    return { kind: 'passing', fn: null, why: 'passing diminished — connects its neighbours by half-step' };
  }
  return { kind: 'chromatic', fn: null, why: 'outside the key — colour by surprise' };
}

// Chord palette for the builder, grouped the way the lessons teach it.
export function palette(mode, sevenths = true) {
  const m = mode === 'minor' ? 'minor' : 'major';
  const R = (list) => list.map((s) => ({ ...parseRoman(s) }));
  const diatonic = diatonicChords(scaleFor(m).iv, sevenths);
  if (m === 'major') {
    return {
      diatonic,
      borrowed: R(sevenths
        ? ['iv7', 'iv6', 'bVIImaj7', 'bVII7', 'bVImaj7', 'bIIImaj7', 'v7', 'iiø7', 'bIImaj7']
        : ['iv', 'bVII', 'bVI', 'bIII', 'v', 'bII']),
      secondary: R(['V7/ii', 'V7/iii', 'V7/IV', 'V7/V', 'V7/vi', 'bII7', '#i°7', '#ii°7', 'biii7']),
    };
  }
  return {
    diatonic,
    borrowed: R(sevenths ? ['IV7', 'IVmaj7', 'V7', 'ii7', 'i6', 'i(maj7)', 'bIImaj7', 'Imaj7'] : ['IV', 'V', 'ii', 'bII', 'I']),
    secondary: R(['V7/iv', 'V7/bVI', 'V7/bIII', 'V7/bVII', 'bII7', 'vii°7', '#iv°7']),
  };
}
