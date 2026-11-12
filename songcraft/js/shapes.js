// Guitar chord shapes. A shape is six frets from the low E string to the high e; -1 = not played.
// Open-position favourites come from a table; everything else from movable shapes with the root
// on the 6th, 5th or 4th string, taking whichever sits lowest on the neck.

import { mod12 } from './theory.js';

export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64];
const MAX_MIDI = 76; // highest recorded sample (12th fret of the high e string)
const X = -1;

const parse = (s) => [...s].map((ch) => (ch === 'x' ? X : parseInt(ch, 16)));

/** Open shapes worth preferring over a movable one: 'rootPc:quality' → frets. */
const OPEN = Object.fromEntries(Object.entries({
  '0:': 'x32010', '0:7': 'x32310', '0:maj7': 'x32000', '0:add9': 'x32030', '0:6': 'x32210', '0:sus4': 'x33011', '0:maj9': 'x30000',
  '7:': '320003', '7:7': '320001', '7:maj7': '320002', '7:6': '320000', '7:add9': '320203', '7:sus4': '330013', '7:sus2': '300033',
  '2:': 'xx0232', '2:m': 'xx0231', '2:7': 'xx0212', '2:maj7': 'xx0222', '2:m7': 'xx0211', '2:sus2': 'xx0230', '2:sus4': 'xx0233', '2:6': 'xx0202', '2:m6': 'xx0201',
  '5:maj7': 'xx3210', '5:add9': 'xx3213',
  '9:add9': 'x02420', '9:m9': 'x02413',
  '4:add9': '022102', '4:6': '022120', '4:m6': '022020', '4:9': '020102', '4:m9': '020002', '4:sus2': 'x79977',
  '11:7': 'x21202',
}).map(([k, v]) => [k, parse(v)]));

/** Movable shapes: root string (0 = low E, 1 = A, 2 = D), smallest root fret, frets from the root fret r. */
const T = (string, min, f) => ({ string, min, f });
const MOVABLE = {
  '': [T(0, 0, (r) => [r, r + 2, r + 2, r + 1, r, r]), T(1, 0, (r) => [X, r, r + 2, r + 2, r + 2, r])],
  m: [T(0, 0, (r) => [r, r + 2, r + 2, r, r, r]), T(1, 0, (r) => [X, r, r + 2, r + 2, r + 1, r])],
  7: [T(0, 0, (r) => [r, r + 2, r, r + 1, r, r]), T(1, 0, (r) => [X, r, r + 2, r, r + 2, r])],
  maj7: [T(0, 0, (r) => [r, X, r + 1, r + 1, r, X]), T(1, 0, (r) => [X, r, r + 2, r + 1, r + 2, r])],
  m7: [T(0, 0, (r) => [r, r + 2, r, r, r, r]), T(1, 0, (r) => [X, r, r + 2, r, r + 1, r])],
  add9: [T(0, 3, (r) => [r, r - 1, r - 3, r - 1, X, X]), T(1, 3, (r) => [X, r, r - 1, r - 3, r, X])],
  sus2: [T(1, 0, (r) => [X, r, r + 2, r + 2, r, r])],
  sus4: [T(0, 0, (r) => [r, r + 2, r + 2, r + 2, r, r]), T(1, 0, (r) => [X, r, r + 2, r + 2, r + 3, r])],
  dim: [T(1, 0, (r) => [X, r, r + 1, r + 2, r + 1, X]), T(2, 0, (r) => [X, X, r, r + 1, r + 3, r + 1])],
  m7b5: [T(0, 1, (r) => [r, X, r, r, r - 1, X]), T(1, 0, (r) => [X, r, r + 1, r, r + 1, X]), T(2, 0, (r) => [X, X, r, r + 1, r + 1, r + 1])],
  dim7: [T(0, 1, (r) => [r, X, r - 1, r, r - 1, X]), T(1, 1, (r) => [X, r, r + 1, r - 1, r + 1, X]), T(2, 0, (r) => [X, X, r, r + 1, r, r + 1])],
  6: [T(0, 1, (r) => [r, X, r - 1, r + 1, r, X]), T(1, 0, (r) => [X, r, r + 2, r + 2, r + 2, r + 2])],
  m6: [T(0, 1, (r) => [r, X, r - 1, r, r, X]), T(1, 0, (r) => [X, r, r + 2, r + 2, r + 1, r + 2])],
  9: [T(0, 1, (r) => [r, r - 1, r, r - 1, X, X]), T(1, 1, (r) => [X, r, r - 1, r, r, X])],
  maj9: [T(0, 1, (r) => [r, r - 1, r + 1, r - 1, X, X]), T(1, 1, (r) => [X, r, r - 1, r + 1, r, X])],
  m9: [T(0, 2, (r) => [r, r - 2, r, r - 1, X, X]), T(1, 2, (r) => [X, r, r - 2, r, r, X])],
};

const cache = new Map();

/** The shape to play for a chord with root pitch class `rootPc` (0 = C) and quality `q`. */
export function shapeFor(rootPc, q) {
  const key = `${mod12(rootPc)}:${q}`;
  if (OPEN[key]) return OPEN[key];
  if (cache.has(key)) return cache.get(key);
  let best = null;
  let bestTop = Infinity;
  for (const t of MOVABLE[q] || MOVABLE['']) {
    let r = mod12(rootPc - OPEN_STRINGS[t.string]);
    if (r < t.min) r += 12;
    const frets = t.f(r);
    const top = Math.max(...frets);
    const ok = frets.every((f, s) => f === X || (f >= 0 && OPEN_STRINGS[s] + f <= MAX_MIDI));
    if (ok && top < bestTop) { best = frets; bestTop = top; }
  }
  cache.set(key, best);
  return best;
}

/** MIDI notes of a shape, low string to high. */
export const shapeMidis = (frets) => frets.flatMap((f, s) => (f === X ? [] : [OPEN_STRINGS[s] + f]));

/** "x32010", or "x-10-12-12-11-10" once a fret needs two digits. */
export function shapeText(frets) {
  const parts = frets.map((f) => (f === X ? 'x' : String(f)));
  return parts.some((p) => p.length > 1) ? parts.join('-') : parts.join('');
}

/**
 * Chord box as an SVG string: strings left (low E) to right, the nut or a fret number on top,
 * the root filled in. `rootPc` marks which dots are the root.
 */
export function diagramSVG(frets, rootPc, label = '') {
  const fretted = frets.filter((f) => f > 0);
  const top = fretted.length ? Math.max(...fretted) : 0;
  const low = fretted.length ? Math.min(...fretted) : 0;
  const base = top <= 4 ? 1 : low; // first fret drawn
  const rows = Math.max(4, top - base + 1);
  const gx = 20;
  const gy = 24;
  const x0 = 26;
  const y0 = 30;
  const W = x0 + 5 * gx + 16;
  const H = y0 + rows * gy + 10;
  let s = `<svg class="chordbox" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label ? label + ': ' : ''}${shapeText(frets)}">`;
  for (let i = 0; i <= rows; i++) s += `<line class="${i === 0 && base === 1 ? 'cnut' : 'cfret'}" x1="${x0}" y1="${y0 + i * gy}" x2="${x0 + 5 * gx}" y2="${y0 + i * gy}"/>`;
  for (let i = 0; i < 6; i++) s += `<line class="cstring" x1="${x0 + i * gx}" y1="${y0}" x2="${x0 + i * gx}" y2="${y0 + rows * gy}"/>`;
  if (base > 1) s += `<text class="cbase" x="${x0 - 9}" y="${y0 + gy / 2}">${base}</text>`;
  frets.forEach((f, i) => {
    const x = x0 + i * gx;
    const isRoot = f !== X && mod12(OPEN_STRINGS[i] + f) === mod12(rootPc);
    if (f === X) s += `<text class="cmark" x="${x}" y="${y0 - 12}">×</text>`;
    else if (f === 0) s += `<circle class="copen${isRoot ? ' root' : ''}" cx="${x}" cy="${y0 - 12}" r="5"/>`;
    else s += `<circle class="cdot${isRoot ? ' root' : ''}" cx="${x}" cy="${y0 + (f - base + 0.5) * gy}" r="7.5"/>`;
  });
  return s + '</svg>';
}
