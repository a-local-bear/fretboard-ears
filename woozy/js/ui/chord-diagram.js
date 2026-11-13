// Chord box (strings vertical, low E on the left). Each dot shows which chord
// tone it is — R, 3, 5, b7 … — because knowing that is half of writing melodies.

import { s } from '../dom.js';
import { voicingLabels } from '../music/voicings.js';

const SX = 14; // string spacing
const FY = 17; // fret spacing
const LEFT = 20;
const TOP = 20;

export function chordDiagram(frets, { rootPc = null, q = null } = {}) {
  const fretted = frets.filter((f) => f != null && f > 0);
  const max = fretted.length ? Math.max(...fretted) : 1;
  const min = fretted.length ? Math.min(...fretted) : 1;
  const base = max <= 5 ? 1 : min;
  const rows = Math.max(5, max - base + 1);
  const width = LEFT + SX * 5 + 12;
  const height = TOP + FY * rows + 8;
  const labels = rootPc != null ? voicingLabels(frets, rootPc, q) : frets.map(() => null);

  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chord-diagram', role: 'img' });
  const x = (i) => LEFT + i * SX;
  const y = (row) => TOP + row * FY;

  for (let row = 0; row <= rows; row++) {
    svg.append(s('line', { x1: x(0), x2: x(5), y1: y(row), y2: y(row), class: row === 0 && base === 1 ? 'cd-nut' : 'cd-line' }));
  }
  for (let i = 0; i < 6; i++) svg.append(s('line', { x1: x(i), x2: x(i), y1: y(0), y2: y(rows), class: 'cd-line' }));
  if (base > 1) svg.append(s('text', { x: LEFT - 7, y: y(0.5) + 3, class: 'cd-fret', 'text-anchor': 'end' }, `${base}`));

  // A barre: the lowest fret is held on two or more strings and nothing rings open.
  const barreStrings = frets.map((f, i) => (f === min ? i : -1)).filter((i) => i >= 0);
  if (fretted.length && barreStrings.length >= 2 && !frets.includes(0)) {
    const row = min - base + 0.5;
    svg.append(s('rect', {
      x: x(barreStrings[0]) - 5.5, y: y(row) - 5.5, width: x(barreStrings[barreStrings.length - 1]) - x(barreStrings[0]) + 11,
      height: 11, rx: 5.5, class: 'cd-barre',
    }));
  }

  frets.forEach((f, i) => {
    const isRoot = labels[i] === 'R';
    if (f == null) {
      svg.append(s('text', { x: x(i), y: TOP - 6, class: 'cd-mute', 'text-anchor': 'middle' }, '×'));
    } else if (f === 0) {
      svg.append(s('circle', { cx: x(i), cy: TOP - 9, r: 3.6, class: isRoot ? 'cd-open cd-root' : 'cd-open' }));
    } else {
      const cy = y(f - base + 0.5);
      svg.append(s('circle', { cx: x(i), cy, r: 6, class: isRoot ? 'cd-dot cd-root' : 'cd-dot' }));
      if (labels[i]) {
        svg.append(s('text', { x: x(i), y: cy + 2.4, class: 'cd-label', 'text-anchor': 'middle', 'font-size': labels[i].length > 2 ? 5.2 : 6.6 }, labels[i]));
      }
    }
  });
  return svg;
}
