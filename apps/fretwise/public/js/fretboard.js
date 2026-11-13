// Interactive fretboard diagram (SVG).
//
// The neck is drawn the way tablature is: string 1 (high E) at the top, the nut
// on the left.  Both can be flipped (settings: "low E on top", "left-handed").

import { s, r2 } from './dom.js';

const INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const STRING_W = [0, 1.1, 1.4, 1.8, 2.3, 2.9, 3.5];

/**
 * @param {object} o
 *   frets       [low, high] inclusive; low = 0 shows the nut and the open strings
 *   width       available width in px
 *   onTap       (string, fret, event) => void
 *   leftHanded  mirror horizontally
 *   lowOnTop    put string 6 at the top
 */
export function createFretboard(o = {}) {
  const [lo, hi] = o.frets ?? [0, 4];
  const hasNut = lo === 0;
  const firstFret = Math.max(1, lo);
  const cols = hi - firstFret + 1;
  const avail = o.width ?? 340;
  const openW = hasNut ? 50 : 26;      // room left of the board: string numbers (+ open-string targets)
  const padR = 8;
  const fretW = Math.min(66, Math.max(22, (avail - openW - padR) / cols));
  const rowH = o.compact ? 30 : 36;
  const padT = 8, edge = rowH / 2 + 1;
  const boardX = openW, boardW = cols * fretW;
  const boardY = padT, boardH = 5 * rowH + 2 * edge;
  const W = openW + boardW + padR, H = padT + boardH + 24;

  const markR = Math.min(13, Math.max(8, fretW * 0.44)); // dots shrink on a crowded neck
  const mirror = Boolean(o.leftHanded);
  const X = (x) => r2(mirror ? W - x : x);
  const RX = (x, w) => r2(mirror ? W - x - w : x);
  const row = (string) => (o.lowOnTop ? 6 - string : string - 1);
  const stringY = (string) => r2(boardY + edge + row(string) * rowH);
  const colX = (fret) => (fret === 0 ? openW - 25 : boardX + (fret - firstFret + 0.5) * fretW); // centre of a cell

  const parts = [];
  parts.push(s('rect', { class: 'fb-board', x: RX(boardX, boardW), y: boardY, width: r2(boardW), height: boardH, rx: 5 }));
  // position markers on the fingerboard
  for (let f = firstFret; f <= hi; f++) {
    const cx = X(colX(f)), mid = boardY + boardH / 2;
    if (INLAYS.has(f)) parts.push(s('circle', { class: 'fb-inlay', cx, cy: mid, r: 6 }));
    if (f === 12 || f === 24) {
      parts.push(s('circle', { class: 'fb-inlay', cx, cy: r2(mid - rowH), r: 6 }));
      parts.push(s('circle', { class: 'fb-inlay', cx, cy: r2(mid + rowH), r: 6 }));
    }
  }
  // fret wires (and the nut)
  for (let k = hasNut ? 1 : 0; k <= cols; k++) {
    parts.push(s('rect', { class: 'fb-fret', x: RX(boardX + k * fretW - 1.5, 3), y: boardY, width: 3, height: boardH, rx: 1.5 }));
  }
  if (hasNut) parts.push(s('rect', { class: 'fb-nut', x: RX(boardX - 4, 7), y: boardY - 1, width: 7, height: boardH + 2, rx: 2 }));
  // strings
  for (let st = 1; st <= 6; st++) {
    const y = stringY(st);
    const x0 = hasNut ? boardX : boardX - 8;
    parts.push(s('rect', {
      class: st >= 4 ? 'fb-string fb-wound' : 'fb-string',
      x: RX(x0, boardW + (boardX - x0) + padR - 2), y: r2(y - STRING_W[st] / 2), width: r2(boardW + (boardX - x0) + padR - 2), height: STRING_W[st], rx: 1,
    }));
    parts.push(s('text', { class: 'fb-snum', x: X(9), y: r2(y + 4), 'text-anchor': 'middle', 'font-size': 12 }, String(st)));
    if (hasNut) parts.push(s('circle', { class: 'fb-open', cx: X(colX(0)), cy: y, r: 9 }));
  }
  // fret numbers
  for (let f = firstFret; f <= hi; f++) {
    parts.push(s('text', { class: 'fb-num', x: X(colX(f)), y: boardY + boardH + 17, 'text-anchor': 'middle', 'font-size': 12 }, String(f)));
  }
  if (hasNut) parts.push(s('text', { class: 'fb-num', x: X(colX(0)), y: boardY + boardH + 17, 'text-anchor': 'middle', 'font-size': 11 }, 'open'));

  const markLayer = s('g', { class: 'fb-marks' });
  const cellLayer = s('g', { class: 'fb-cells' });
  let enabled = true;
  const inRange = (st, f) => st >= 1 && st <= 6 && ((hasNut && f === 0) || (f >= firstFret && f <= hi));
  for (let st = 1; st <= 6; st++) {
    for (let f = hasNut ? 0 : firstFret; f <= hi; f++) {
      if (f > 0 && f < firstFret) continue;
      const w = f === 0 ? openW - 16 : fretW;
      const x = f === 0 ? 16 : boardX + (f - firstFret) * fretW;
      const cell = s('rect', {
        class: 'fb-cell', x: RX(x, w), y: r2(stringY(st) - rowH / 2), width: r2(w), height: rowH,
        'data-s': st, 'data-f': f, fill: 'transparent', 'pointer-events': 'all',
      });
      cell.addEventListener('click', (ev) => { if (enabled && o.onTap) o.onTap(st, f, ev); });
      cellLayer.append(cell);
    }
  }

  const svg = s('svg', {
    class: 'fretboard', viewBox: `0 0 ${r2(W)} ${H}`, width: r2(W), height: H, role: 'img', 'aria-label': 'guitar fretboard',
  }, parts, markLayer, cellLayer);

  const marks = new Map();
  const api = {
    el: svg,
    frets: [lo, hi],
    inRange,
    /** show a dot; kind: 'pick' | 'good' | 'bad' | 'hint' | 'show'; label is optional text inside it */
    mark(st, f, kind = 'pick', label = '') {
      if (!inRange(st, f)) return null;
      api.unmark(st, f);
      const g = s('g', { class: `fb-mark is-${kind}` },
        s('circle', { cx: X(colX(f)), cy: stringY(st), r: r2(markR) }),
        label ? s('text', { x: X(colX(f)), y: r2(stringY(st) + markR * 0.36), 'text-anchor': 'middle', 'font-size': markR >= 12 ? 13 : 10 }, label) : null);
      markLayer.append(g);
      marks.set(`${st}:${f}`, g);
      return g;
    },
    unmark(st, f) { const g = marks.get(`${st}:${f}`); if (g) { g.remove(); marks.delete(`${st}:${f}`); } },
    clear() { for (const g of marks.values()) g.remove(); marks.clear(); },
    /** a dot that disappears again */
    flash(st, f, kind, ms = 650) {
      const g = api.mark(st, f, kind);
      if (g) setTimeout(() => { if (marks.get(`${st}:${f}`) === g) api.unmark(st, f); }, ms);
    },
    setEnabled(v) { enabled = v; svg.classList.toggle('is-off', !v); },
    /** the tappable cell element, for tests and keyboard helpers */
    cell(st, f) { return cellLayer.querySelector(`[data-s="${st}"][data-f="${f}"]`); },
  };
  return api;
}

/** the smallest sensible window of frets that shows every note of a set */
export function fretWindow(notes, { min = 4 } = {}) {
  const frets = notes.map((n) => n.f);
  let lo = Math.min(...frets), hi = Math.max(...frets);
  if (lo <= 2) lo = 0; else lo -= 1;
  if (hi - lo < min) hi = lo + min;
  return [lo, hi];
}
