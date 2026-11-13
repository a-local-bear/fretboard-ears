// Horizontal fretboard, drawn the way tab is read: high e on top, low E at
// the bottom, nut on the left.  Tap any spot to hear it.

import { tapNote } from '../audio/audio.js';
import { h, s } from '../dom.js';
import { OPEN_MIDI } from '../music/voicings.js';

const FRET_W = 50;
const GAP = 27;
const PAD_L = 40;
const PAD_T = 18;
const PAD_B = 24;
const INLAYS = new Set([3, 5, 7, 9, 12, 15, 17, 19]);

// markers: [{ s: string 0–5 (0 = low E), f: fret, text, cls }]
// opts: { from, to, markers, onPick(string, fret, midi), silent }
export function fretboard(opts = {}) {
  const from = opts.from ?? 0;
  const to = opts.to ?? 12;
  const cells = from === 0 ? to : to - from + 1;
  const width = PAD_L + cells * FRET_W + 10;
  const height = PAD_T + GAP * 5 + PAD_B;
  const x0 = PAD_L;
  const cellOf = (f) => (from === 0 ? f - 1 : f - from);
  const cx = (f) => (f === 0 && from === 0 ? PAD_L - 19 : x0 + (cellOf(f) + 0.5) * FRET_W);
  const cy = (string) => PAD_T + (5 - string) * GAP;

  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'fretboard' });
  svg.append(s('rect', { x: x0, y: PAD_T - 6, width: cells * FRET_W, height: GAP * 5 + 12, class: 'fb-wood', rx: 3 }));

  for (let i = 0; i <= cells; i++) {
    const isNut = i === 0 && from === 0;
    svg.append(s('line', { x1: x0 + i * FRET_W, x2: x0 + i * FRET_W, y1: PAD_T - 6, y2: PAD_T + GAP * 5 + 6, class: isNut ? 'fb-nut' : 'fb-fret' }));
  }
  for (let f = Math.max(1, from); f <= to; f++) {
    if (!INLAYS.has(f)) continue;
    const mid = PAD_T + GAP * 2.5;
    if (f === 12) {
      svg.append(s('circle', { cx: cx(f), cy: mid - GAP, r: 4.5, class: 'fb-inlay' }), s('circle', { cx: cx(f), cy: mid + GAP, r: 4.5, class: 'fb-inlay' }));
    } else {
      svg.append(s('circle', { cx: cx(f), cy: mid, r: 4.5, class: 'fb-inlay' }));
    }
    svg.append(s('text', { x: cx(f), y: height - 6, class: 'fb-num', 'text-anchor': 'middle' }, f));
  }
  if (from > 0 && !INLAYS.has(from)) svg.append(s('text', { x: cx(from), y: height - 6, class: 'fb-num', 'text-anchor': 'middle' }, from));
  for (let string = 0; string < 6; string++) {
    svg.append(s('line', { x1: from === 0 ? x0 - 30 : x0, x2: x0 + cells * FRET_W, y1: cy(string), y2: cy(string), class: 'fb-string', 'stroke-width': 2.6 - string * 0.32 }));
    svg.append(s('text', { x: 4, y: cy(string) + 4, class: 'fb-name' }, 'EADGBe'[string]));
  }

  const markerLayer = s('g');
  const hitLayer = s('g');
  svg.append(markerLayer, hitLayer);

  // Invisible tap targets, one per string/fret.
  for (let string = 0; string < 6; string++) {
    for (let f = from; f <= to; f++) {
      const w = f === 0 ? 30 : FRET_W;
      hitLayer.append(s('rect', {
        x: cx(f) - w / 2, y: cy(string) - GAP / 2, width: w, height: GAP, class: 'fb-hit', 'data-s': string, 'data-f': f,
      }));
    }
  }
  svg.addEventListener('click', (e) => {
    const target = e.target.closest?.('.fb-hit');
    if (!target) return;
    const string = Number(target.dataset.s);
    const fret = Number(target.dataset.f);
    const midi = OPEN_MIDI[string] + fret;
    if (!opts.silent) tapNote(midi);
    opts.onPick?.(string, fret, midi);
  });

  function setMarkers(markers) {
    while (markerLayer.firstChild) markerLayer.firstChild.remove();
    for (const m of markers) {
      if (m.f < from || m.f > to) continue;
      const group = s('g', { class: `fb-marker ${m.cls || ''}` });
      group.append(s('circle', { cx: cx(m.f), cy: cy(m.s), r: m.small ? 7 : 10.5 }));
      if (m.text != null && m.text !== '') {
        const text = String(m.text);
        group.append(s('text', { x: cx(m.f), y: cy(m.s) + 3.6, 'text-anchor': 'middle', 'font-size': text.length > 2 ? 8 : 10 }, text));
      }
      markerLayer.append(group);
    }
  }
  setMarkers(opts.markers || []);

  const el = h('div', { class: 'fb-scroll' }, svg);
  return { el, setMarkers, from, to };
}

// Markers for every place a set of pitch classes lives on the neck.
//   byPc: Map(pc → { text, cls })
export function markersFor(byPc, from = 0, to = 12, strings = [0, 1, 2, 3, 4, 5]) {
  const out = [];
  for (const string of strings) {
    for (let f = from; f <= to; f++) {
      const m = byPc.get((OPEN_MIDI[string] + f) % 12);
      if (m) out.push({ s: string, f, ...m });
    }
  }
  return out;
}
