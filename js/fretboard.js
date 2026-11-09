// SVG fretboard as a string. Horizontal (high e on top, like tab) or vertical (nut at top, low E left).

import { STRING_NAMES, noteColor } from './data.js';

const INLAYS = [3, 5, 7, 9, 15, 17];

/**
 * @param {object} o
 * @param {Array<{id:number, pos:[number,number]}>} o.dots  one per dot; `id` is the note (semitones above the tonic)
 * @param {{lo:number, hi:number}} o.frame  first and last fret column drawn
 * @param {(id:number)=>string} o.labelOf   dot text ('' for none)
 * @param {(id:number)=>string} o.nameOf    spoken name of a note
 * @param {boolean} o.hidden                plain dots, no names or colours
 * @param {boolean} o.vertical
 * @param {Record<number,string>} [o.states]  note id → 'correct' | 'wrong' | 'reveal' | 'playing'
 * @param {Record<string,string>} [o.posStates]  'string,fret' → state, overriding `states` for that one dot
 * @param {boolean} [o.disabled]
 */
export function fretboardSVG({ dots, frame, labelOf, nameOf, hidden = false, vertical, states = {}, posStates = {}, disabled = false }) {
  const { lo, hi } = frame;
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
  s += `<rect class="wood" x="${bx}" y="${by}" width="${bw}" height="${bh}" />`;

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
    s += `<line class="string" stroke-width="${(1.8 - st * 0.2).toFixed(2)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    const [lx, ly] = vertical ? P(along0 - 18, c) : P(along0 - 22, c);
    s += `<text class="sname" x="${lx}" y="${ly}">${STRING_NAMES[st]}</text>`;
  }

  // Fret numbers
  for (let f = lo + 1; f <= hi; f++) {
    const [x, y] = vertical ? [offX / 2 + 2, cellAlong(f)] : [cellAlong(f), across0 + boardAcross + 14 + labelBand / 2 + 4];
    s += `<text class="fnum" x="${fnum(x)}" y="${fnum(y)}">${f}</text>`;
  }

  // Dots
  for (const { id: d, pos: [st, f] } of dots) {
    const [x, y] = P(cellAlong(f), stringAcross(st));
    const state = posStates[`${st},${f}`] || states[d] || '';
    const fill = hidden ? 'var(--dot-neutral)' : noteColor(d);
    const text = hidden ? '' : labelOf(d);
    s += `<g class="dot ${state}${hidden ? ' neutral' : ''}" data-action="tap" data-degree="${d}" data-pos="${st},${f}" transform="translate(${fnum(x)} ${fnum(y)})" style="--c:${fill}"` +
      ` role="button" tabindex="${disabled ? -1 : 0}" aria-label="${hidden ? `String ${STRING_NAMES[st]}, fret ${f}` : nameOf(d)}">` +
      `<circle class="ring" r="${r + 5}"/>` +
      `<circle class="disc" r="${r}"/>` +
      (text ? `<text class="dlabel" y="0.5" font-size="${text.length > 2 ? 10.5 : 12}">${text}</text>` : '') +
      `</g>`;
  }
  return s + '</svg>';
}
