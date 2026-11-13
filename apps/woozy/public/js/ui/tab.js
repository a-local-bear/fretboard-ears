// Guitar tab renderer.  Notes are { s, d, string, fret, mark? } with string
// 0 = low E … 5 = high e and s/d in 16th-note steps.

import { h, s } from '../dom.js';

const STEP_W = 11;
const LINE_GAP = 12;
const LEFT = 26;
const SYSTEM_H = LINE_GAP * 5 + 44;

// opts: { notes, total, chords: [{ step, name }], barsPerLine }
export function tabView(opts) {
  const total = Math.max(16, Math.ceil(opts.total / 16) * 16);
  const perLine = (opts.barsPerLine || 4) * 16;
  const systems = Math.ceil(total / perLine);
  const width = LEFT + Math.min(total, perLine) * STEP_W + 12;
  const height = systems * SYSTEM_H + 4;
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'tab' });

  const sysTop = (i) => i * SYSTEM_H + 24;
  const xOf = (step) => LEFT + (step % perLine) * STEP_W + STEP_W / 2 + 2;
  const yOf = (step, string) => sysTop(Math.floor(step / perLine)) + (5 - string) * LINE_GAP;

  for (let sys = 0; sys < systems; sys++) {
    const top = sysTop(sys);
    const steps = Math.min(perLine, total - sys * perLine);
    const right = LEFT + steps * STEP_W + 2;
    for (let line = 0; line < 6; line++) {
      svg.append(s('line', { x1: LEFT - 4, x2: right, y1: top + line * LINE_GAP, y2: top + line * LINE_GAP, class: 'tab-line' }));
      svg.append(s('text', { x: 4, y: top + line * LINE_GAP + 3.5, class: 'tab-name' }, 'eBGDAE'[line]));
    }
    for (let st = 0; st <= steps; st += 16) {
      const x = LEFT + st * STEP_W + (st === 0 ? -4 : 2);
      svg.append(s('line', { x1: x, x2: x, y1: top, y2: top + LINE_GAP * 5, class: 'tab-bar' }));
    }
  }

  for (const c of opts.chords || []) {
    if (c.step >= total) continue;
    svg.append(s('text', { x: xOf(c.step) - 4, y: sysTop(Math.floor(c.step / perLine)) - 10, class: 'tab-chord' }, c.name));
  }

  for (const n of opts.notes || []) {
    if (n.s >= total) continue;
    const x = xOf(n.s);
    const y = yOf(n.s, n.string);
    const text = String(n.fret);
    svg.append(s('rect', { x: x - (text.length > 1 ? 7 : 4.5), y: y - 6, width: text.length > 1 ? 14 : 9, height: 12, class: 'tab-mask' }));
    svg.append(s('text', { x, y: y + 4, class: 'tab-fret', 'text-anchor': 'middle' }, text));
    if (n.mark) svg.append(s('text', { x: x - 9, y: y - 4, class: 'tab-mark', 'text-anchor': 'middle' }, n.mark));
  }

  const head = s('line', { class: 'tab-head', x1: 0, x2: 0, y1: 0, y2: 0, visibility: 'hidden' });
  svg.append(head);
  function setPlayhead(step) {
    if (step == null || step < 0 || step >= total) {
      head.setAttribute('visibility', 'hidden');
      return;
    }
    const top = sysTop(Math.floor(step / perLine));
    const x = xOf(step);
    head.setAttribute('x1', x);
    head.setAttribute('x2', x);
    head.setAttribute('y1', top - 6);
    head.setAttribute('y2', top + LINE_GAP * 5 + 6);
    head.setAttribute('visibility', 'visible');
  }

  return { el: h('div', { class: 'tab-scroll' }, svg), setPlayhead };
}

// "2/5:2 2/7s:2 1/5+3/6:4 r:2" → [{ s, d, string, fret, mark }]
//   string/fret with guitar string numbers (1 = high e, 6 = low E),
//   + joins notes played together, a trailing s/h/p marks slide / hammer-on /
//   pull-off into the note, :n is the length in 8th notes (default 1).
export function parseTab(str) {
  const notes = [];
  let at = 0;
  for (const tok of str.split(/[\s|]+/).filter(Boolean)) {
    const [body, len] = tok.split(':');
    const d = Math.round((len ? Number(len) : 1) * 2);
    if (body !== 'r') {
      for (const part of body.split('+')) {
        const m = /^([1-6])\/(\d+)([shp]?)$/.exec(part);
        if (!m) throw new Error(`Bad tab token: ${tok}`);
        notes.push({ s: at, d, string: 6 - Number(m[1]), fret: Number(m[2]), mark: { s: '/', h: 'h', p: 'p' }[m[3]] || null });
      }
    }
    at += d;
  }
  return { notes, total: at };
}
