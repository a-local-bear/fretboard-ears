// SVG fretboard as a string. Horizontal (high e on top, like tab) or vertical (nut at top, low E left).

import { STRING_NAMES, SOLFEGE, LETTERS, DEGREE_COLORS } from './data.js';

const INLAYS = [3, 5, 7, 9, 15, 17];

/**
 * @param {object} o
 * @param {Array<[number,number]>} o.notes    chapter notes, Do → Do'
 * @param {number[]} o.degrees                degrees shown as dots
 * @param {'solfege'|'letters'|'hidden'} o.labels
 * @param {boolean} o.vertical
 * @param {Record<number,string>} [o.states]  degree → 'correct' | 'wrong' | 'reveal' | 'playing'
 * @param {boolean} [o.disabled]
 */
export function fretboardSVG({ notes, degrees, labels, vertical, states = {}, disabled = false }) {
  const frets = notes.map((n) => n[1]);
  const lo = Math.max(0, Math.min(...frets) - 1);
  const hi = Math.max(...frets) + 1;
  const cells = hi - lo;

  // Geometry in viewBox units. "along" = direction of the neck, "across" = strings.
  const cell = vertical ? 64 : 76;
  const gap = vertical ? 50 : 38;
  const padAcross = vertical ? 30 : 36;
  const padAlongStart = vertical ? 34 : 40;
  const padAlongEnd = 14;
  const labelBand = 24;
  const boardAlong = cells * cell;
  const boardAcross = 5 * gap;
  const along0 = padAlongStart;
  const across0 = padAcross;
  const W = vertical ? padAcross * 2 + boardAcross + labelBand : padAlongStart + boardAlong + padAlongEnd;
  const H = vertical ? padAlongStart + boardAlong + padAlongEnd : padAcross * 2 + boardAcross + labelBand;
  const offX = vertical ? labelBand : 0;

  // Map (along, across) to (x, y).
  const P = (a, c) => (vertical ? [offX + c, a] : [a, c]);
  const stringAcross = (s) => across0 + (vertical ? s : 5 - s) * gap;
  const wireAlong = (f) => along0 + (f - lo) * cell;
  const cellAlong = (f) => wireAlong(f) - cell / 2;
  const r = vertical ? 17 : 15.5;
  const fnum = (n) => Math.round(n * 10) / 10;

  let s = `<svg class="fretboard ${vertical ? 'vertical' : 'horizontal'}" viewBox="0 0 ${W} ${H}" role="group" aria-label="Fretboard">`;

  // Board
  const [bx, by] = P(along0, across0 - 14);
  const [bw, bh] = vertical ? [boardAcross + 28, boardAlong] : [boardAlong, boardAcross + 28];
  s += `<rect class="wood" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3"/>`;

  // Inlays
  for (let f = lo + 1; f <= hi; f++) {
    const a = cellAlong(f);
    if (f === 12) {
      for (const c of [across0 + gap * 1, across0 + gap * 4]) {
        const [x, y] = P(a, c - gap / 2);
        s += `<circle class="inlay" cx="${fnum(x)}" cy="${fnum(y)}" r="6"/>`;
      }
    } else if (INLAYS.includes(f)) {
      const [x, y] = P(a, across0 + 2.5 * gap);
      s += `<circle class="inlay" cx="${fnum(x)}" cy="${fnum(y)}" r="6"/>`;
    }
  }

  // Fret wires (nut when the window starts at 0)
  for (let f = lo; f <= hi; f++) {
    const a = wireAlong(f);
    const [x1, y1] = P(a, across0 - 14);
    const [x2, y2] = P(a, across0 + boardAcross + 14);
    s += `<line class="${f === 0 ? 'nut' : 'wire'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }

  // Strings (thicker for low strings)
  for (let st = 0; st < 6; st++) {
    const c = stringAcross(st);
    const [x1, y1] = P(along0, c);
    const [x2, y2] = P(along0 + boardAlong, c);
    s += `<line class="string" stroke-width="${(2.6 - st * 0.32).toFixed(2)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    const [lx, ly] = vertical ? P(along0 - 18, c) : P(along0 - 22, c);
    s += `<text class="sname" x="${lx}" y="${ly}">${STRING_NAMES[st]}</text>`;
  }

  // Fret numbers
  for (let f = lo + 1; f <= hi; f++) {
    const [x, y] = vertical ? [offX / 2 + 2, cellAlong(f)] : [cellAlong(f), across0 + boardAcross + 14 + labelBand / 2 + 4];
    s += `<text class="fnum" x="${fnum(x)}" y="${fnum(y)}">${f}</text>`;
  }

  // Dots
  for (const d of degrees) {
    const [st, f] = notes[d];
    const [x, y] = P(cellAlong(f), stringAcross(st));
    const state = states[d] || '';
    const hidden = labels === 'hidden';
    const fill = hidden ? 'var(--dot-neutral)' : DEGREE_COLORS[d];
    const text = hidden ? '' : labels === 'letters' ? LETTERS[d] : SOLFEGE[d];
    const name = SOLFEGE[d];
    s += `<g class="dot ${state}${hidden ? ' neutral' : ''}" data-action="tap" data-degree="${d}" transform="translate(${fnum(x)} ${fnum(y)})"` +
      ` role="button" tabindex="${disabled ? -1 : 0}" aria-label="${hidden ? `String ${STRING_NAMES[st]}, fret ${f}` : name}">` +
      `<circle class="ring" r="${r + 5}"/>` +
      `<circle class="disc" r="${r}" style="--c:${fill}"/>` +
      (text ? `<text class="dlabel" y="0.5" font-size="${text.length > 2 ? 10.5 : 12}">${text}</text>` : '') +
      `</g>`;
  }
  return s + '</svg>';
}
