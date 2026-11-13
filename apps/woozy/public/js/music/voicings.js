// Guitar chord voicings: movable shapes (root on the 6th, 5th or 4th string),
// an open-chord dictionary, and a voice-leading picker for whole progressions.
//
// A voicing is an array of six frets, low E → high e, null = muted string.

import { QUALITIES, mod12, parseChord, toneLabels } from './theory.js';

export const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
const FORM_STRING = { E: 0, A: 1, D: 2 };
export const FORM_NAMES = { E: 'root on 6th string', A: 'root on 5th string', D: 'root on 4th string', open: 'open position', custom: '' };

// Offsets from the root fret, low E → high e, x = muted.  The first shape in
// each list is the default; later ones are alternates.
const SHAPES = {
  E: {
    '': ['0 2 2 1 0 0'],
    m: ['0 2 2 0 0 0'],
    dim: ['0 x 2 0 -1 x'],
    aug: ['0 x 2 1 1 x'],
    sus4: ['0 2 2 2 0 0'],
    6: ['0 x -1 1 0 x'],
    m6: ['0 x -1 0 0 x'],
    maj7: ['0 x 1 1 0 x', '0 2 1 1 0 0'],
    m7: ['0 x 0 0 0 x', '0 2 0 0 0 0'],
    7: ['0 x 0 1 0 x', '0 2 0 1 0 0'],
    m7b5: ['0 x 0 0 -1 x'],
    dim7: ['0 x -1 0 -1 x'],
    mMaj7: ['0 x 1 0 0 x'],
    '7sus4': ['0 2 0 2 0 0'],
    add9: ['0 2 4 1 0 0'],
    madd9: ['0 2 4 0 0 0'],
    '6/9': ['0 -1 -1 -1 0 0'],
    maj9: ['0 x 1 1 0 2'],
    m9: ['0 x 0 0 0 2'],
    9: ['0 x 0 1 0 2'],
    m11: ['0 x 0 0 -2 x'],
    13: ['0 x 0 1 2 x'],
    'maj7#11': ['0 x 1 1 -1 x'],
  },
  A: {
    '': ['x 0 2 2 2 0'],
    m: ['x 0 2 2 1 0'],
    dim: ['x 0 1 2 1 x'],
    aug: ['x 0 -1 -2 -2 x'],
    sus2: ['x 0 2 2 0 0'],
    sus4: ['x 0 2 2 3 0'],
    6: ['x 0 2 2 2 2'],
    m6: ['x 0 2 2 1 2'],
    maj7: ['x 0 2 1 2 0'],
    m7: ['x 0 2 0 1 0'],
    7: ['x 0 2 0 2 0'],
    m7b5: ['x 0 1 0 1 x'],
    dim7: ['x 0 1 -1 1 x'],
    mMaj7: ['x 0 2 1 1 0'],
    '7sus4': ['x 0 2 0 3 0'],
    add9: ['x 0 2 4 2 0', 'x 0 -1 -3 0 0'],
    madd9: ['x 0 2 4 1 0'],
    '6/9': ['x 0 -1 -1 0 0'],
    maj9: ['x 0 -1 1 0 x'],
    m9: ['x 0 -2 0 0 x'],
    9: ['x 0 -1 0 0 x', 'x 0 -1 0 0 0'],
    m11: ['x 0 0 0 1 x'],
    13: ['x 0 -1 0 0 2'],
    '7#9': ['x 0 -1 0 1 x'],
    '7b9': ['x 0 -1 0 -1 x'],
    'maj7#11': ['x 0 1 1 2 x'],
  },
  D: {
    '': ['x x 0 2 3 2'],
    m: ['x x 0 2 3 1'],
    dim: ['x x 0 1 3 1'],
    aug: ['x x 0 3 3 2'],
    sus2: ['x x 0 2 3 0'],
    sus4: ['x x 0 2 3 3'],
    6: ['x x 0 2 0 2'],
    m6: ['x x 0 2 0 1'],
    maj7: ['x x 0 2 2 2'],
    m7: ['x x 0 2 1 1'],
    7: ['x x 0 2 1 2'],
    m7b5: ['x x 0 1 1 1'],
    dim7: ['x x 0 1 0 1'],
    mMaj7: ['x x 0 2 2 1'],
    '7sus4': ['x x 0 2 1 3'],
  },
};

// Favourite open-position grips, looked up by chord symbol.
const OPEN_CHORDS = {
  C: 'x32010', D: 'xx0232', E: '022100', G: '320003', A: 'x02220',
  Am: 'x02210', Em: '022000', Dm: 'xx0231',
  Cmaj7: 'x32000', Dmaj7: 'xx0222', Emaj7: '021100', Fmaj7: 'xx3210', Gmaj7: '320002', Amaj7: 'x02120',
  Am7: 'x02010', Em7: '022030', Dm7: 'xx0211', Bm7: 'x20202',
  A7: 'x02020', B7: 'x21202', C7: 'x32310', D7: 'xx0212', E7: '020100', G7: '320001',
  A6: 'x02222', C6: 'x32210', D6: 'xx0202', E6: '022120', G6: '320000',
  Am6: 'x02212', Em6: '022020', Dm6: 'xx0201',
  Cadd9: 'x32033', Eadd9: '024100', 'Em(add9)': '024000', 'Am(add9)': 'x02410',
  Asus2: 'x02200', Dsus2: 'xx0230', Asus4: 'x02230', Dsus4: 'xx0233', Esus4: '022200',
  A7sus4: 'x02030', E7sus4: '020200', D7sus4: 'xx0213',
  Em9: '022032', E9: '020102', 'Fmaj7#11': 'xx3200', 'Am(maj7)': 'x02110', 'Dm(maj7)': 'xx0221',
};

export function parseFrets(v) {
  if (Array.isArray(v)) return v.slice();
  const s = String(v).trim();
  const parts = /[-\s]/.test(s) ? s.split(/[-\s]+/) : [...s];
  if (parts.length !== 6) throw new Error(`A voicing needs six strings: "${v}"`);
  return parts.map((p) => (p === 'x' || p === 'X' ? null : parseInt(p, 10)));
}

export function fretsToString(frets) {
  const wide = frets.some((f) => f != null && f > 9);
  return frets.map((f) => (f == null ? 'x' : f)).join(wide ? '-' : '');
}

export const voicingMidi = (frets) => frets.map((f, i) => (f == null ? null : OPEN_MIDI[i] + f));

function describe(frets, form, alt = 0) {
  const fretted = frets.filter((f) => f != null && f > 0);
  const min = fretted.length ? Math.min(...fretted) : 0;
  const max = fretted.length ? Math.max(...fretted) : 0;
  const pos = fretted.length ? fretted.reduce((a, b) => a + b, 0) / fretted.length : 0;
  return { frets, form, alt, min, max, pos, span: max - min, id: `${form}:${fretsToString(frets)}` };
}

const parseShape = (s) => s.split(' ').map((t) => (t === 'x' ? null : Number(t)));

const OPEN_INDEX = (() => {
  const idx = new Map();
  for (const [symbol, frets] of Object.entries(OPEN_CHORDS)) {
    const c = parseChord(symbol);
    if (!c || c.q == null) throw new Error(`Open chord with unknown quality: ${symbol}`);
    idx.set(`${c.rootPc}:${c.q}`, parseFrets(frets));
  }
  return idx;
})();

// Every way we know to play this chord, best-first for a standalone chord.
export function voicingsFor(rootPc, q) {
  const out = [];
  const seen = new Set();
  const push = (v) => {
    if (!seen.has(fretsToString(v.frets))) {
      seen.add(fretsToString(v.frets));
      out.push(v);
    }
  };
  const open = OPEN_INDEX.get(`${mod12(rootPc)}:${q}`);
  if (open) push(describe(open, 'open'));
  for (const form of ['E', 'A', 'D']) {
    const shapes = SHAPES[form][q];
    if (!shapes) continue;
    shapes.forEach((shape, alt) => {
      const offsets = parseShape(shape);
      const lowest = Math.min(...offsets.filter((o) => o != null));
      const highest = Math.max(...offsets.filter((o) => o != null));
      let r = mod12(rootPc - OPEN_MIDI[FORM_STRING[form]]);
      if (r + lowest < 0) r += 12;
      push(describe(offsets.map((o) => (o == null ? null : r + o)), form, alt));
      if (r + 12 + highest <= 15) push(describe(offsets.map((o) => (o == null ? null : r + 12 + o)), form, alt));
    });
  }
  return out.sort((a, b) => baseCost(a) - baseCost(b));
}

function baseCost(v, prefer) {
  let c = 0;
  c += Math.max(0, v.max - 10) * 1.5 + Math.max(0, v.pos - 7) * 0.4 + v.pos * 0.12;
  if (v.span > 4) c += 4 + (v.span - 4) * 2;
  c += v.alt * 1.2;
  if (v.form === 'D') c += prefer === 'small' ? -2 : 1.2;
  else if (prefer === 'small') c += 1;
  if (v.form === 'open') c += prefer === 'open' ? -3 : prefer === 'movable' ? 6 : -0.6;
  return c;
}

export function bestVoicing(rootPc, q, prefer) {
  const all = voicingsFor(rootPc, q);
  let best = all[0];
  for (const v of all) if (baseCost(v, prefer) < baseCost(best, prefer)) best = v;
  return best;
}

// Choose a voicing for every chord so the hand moves as little as possible.
// chords: [{ rootPc, q, frets? }] — an explicit `frets` is always respected.
// prefer: undefined | 'open' | 'movable' | 'small'
export function voiceProgression(chords, prefer) {
  const cands = chords.map((c) => {
    if (c.frets) return [describe(parseFrets(c.frets), 'custom')];
    const list = voicingsFor(c.rootPc, c.q);
    return list.length ? list : [describe([null, null, null, null, null, null], 'custom')];
  });
  const n = cands.length;
  if (!n) return [];
  const cost = cands.map((list) => list.map(() => Infinity));
  const back = cands.map((list) => list.map(() => -1));
  cands[0].forEach((v, j) => { cost[0][j] = baseCost(v, prefer); });
  for (let i = 1; i < n; i++) {
    cands[i].forEach((v, j) => {
      const own = baseCost(v, prefer);
      cands[i - 1].forEach((u, k) => {
        const total = cost[i - 1][k] + own + Math.abs(u.pos - v.pos) * 0.9;
        if (total < cost[i][j]) {
          cost[i][j] = total;
          back[i][j] = k;
        }
      });
    });
  }
  let j = cost[n - 1].indexOf(Math.min(...cost[n - 1]));
  const picked = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    picked[i] = cands[i][j];
    j = back[i][j];
  }
  return picked;
}

// Interval label under each string ('R', '3', 'b7' …) for a voicing of a chord.
export function voicingLabels(frets, rootPc, q) {
  const labels = q != null && QUALITIES[q] ? toneLabels(q) : { 0: 'R' };
  return frets.map((f, i) => (f == null ? null : labels[mod12(OPEN_MIDI[i] + f - rootPc)] ?? '·'));
}

// The three closed triad grips on the G-B-e strings, lowest position first.
export function topTriads(rootPc, minor = false) {
  const third = minor ? 3 : 4;
  // Chord tone on the G, B and e strings for each inversion.
  const inversions = [
    [0, third, 7], // root position: root on the G string
    [third, 7, 0], // 1st inversion: root on the high e string
    [7, 0, third], // 2nd inversion: root on the B string
  ];
  return inversions.map((tones) => {
    const frets = [3, 4, 5].map((string, i) => mod12(rootPc + tones[i] - OPEN_MIDI[string]));
    // Pull the three notes into one hand position, then keep it on the neck.
    const low = Math.min(...frets);
    const close = frets.map((f) => (f - low > 6 ? f - 12 : f));
    const shift = Math.min(...close) < 0 ? 12 : 0;
    return describe([null, null, null, ...close.map((f) => f + shift)], 'custom');
  }).sort((a, b) => a.pos - b.pos);
}
