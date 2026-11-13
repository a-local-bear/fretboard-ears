// Staff notation renderer.  Produces an <svg> from a list of measures.
//
// All layout maths is done in "staff spaces" (the distance between two staff
// lines) with y = 0 on the top line, then scaled by `sp` pixels on output.
// Glyph outlines come from the Bravura font (see glyphs.js) and are placed
// according to the SMuFL registration rules.

import { s, r2 } from './dom.js';
import { GLYPHS, UNITS_PER_SPACE, ENGRAVING } from './glyphs.js';
import { KEY_SIG_STEPS, markAccidentals, measureBeats, pitchName } from './theory.js';
import { clamp } from './util.js';

const HEAD = { w: 'noteheadWhole', h: 'noteheadHalf', q: 'noteheadBlack', e: 'noteheadBlack', s: 'noteheadBlack' };
const REST = { w: 'restWhole', h: 'restHalf', q: 'restQuarter', e: 'rest8th', s: 'rest16th' };
const ACC = { '#': 'accidentalSharp', b: 'accidentalFlat', n: 'accidentalNatural' };
// horizontal room each duration gets (staff spaces) before stretching
const ADVANCE = { s: 2.1, e: 2.6, 'e.': 3.0, q: 3.3, 'q.': 4.0, h: 4.7, 'h.': 5.5, w: 6.3 };

const PAD_L = 0.9;        // barline -> first note
const PAD_R = 0.5;        // room before the next barline
const CLEF_X = 0.7;
const STEM_T = ENGRAVING.stem;
const STEM_LEN = 3.5;
const BEAM_STEM = 3.25;   // shortest stem inside a beamed group
const BEAM_T = ENGRAVING.beam;
const BEAM_STEP = ENGRAVING.beam + ENGRAVING.beamGap;
const MIN_SCALE = 0.8;
const yOf = (step) => (8 - step) / 2;
const box = (name) => GLYPHS[name].box;
const widthOf = (name) => box(name)[2];

/**
 * @param {object} spec
 *   measures   array of measures; each event is {pitch|null, dur, tie}
 *   keySig     sharps (+) / flats (-) in the key signature
 *   timeSig    [beats, unit] or null for none
 *   width      available width in px (systems wrap to fit)
 *   sp         pixels per staff space
 *   endBar     'final' | 'single' | 'none'
 *   counts     null | 'beats' | 'eighths'  — counting aid under the staff
 *   labels     true to print note names under the notes
 *   stretch    false keeps natural spacing
 *   minWidth   px; pad a short staff out to this width (content is centred)
 *   range      [lowStep, highStep] to reserve vertical room (keeps a series of staves the same height)
 *   explicit   print the sign on every altered note (before the bar-line rule has been taught)
 */
export function renderStaff(spec) {
  const sp = spec.sp ?? 10;
  const keySig = spec.keySig ?? 0;
  const timeSig = spec.timeSig ?? null;
  const endBar = spec.endBar ?? 'final';
  const availSp = Math.max(12, (spec.width ?? 340) / sp);
  const barBeats = timeSig ? measureBeats(timeSig) : null;
  const px = (v) => r2(v * sp);
  markAccidentals(spec.measures, keySig, { explicit: Boolean(spec.explicit) });

  // ---- 1. measure-level layout (unstretched) -----------------------------
  const events = [];
  let clock = 0;
  const bars = spec.measures.map((measure, mi) => {
    const bar = { index: mi, events: [], t0: clock };
    let cursor = PAD_L;
    for (const ev of measure) {
      const accW = ev.acc ? widthOf(ACC[ev.acc]) + 0.28 : 0;
      const e = {
        ev, bar, index: events.length, t: clock, beats: ev.dur.beats, rest: !ev.pitch,
        step: ev.pitch ? ev.pitch.step : null,
        off: cursor + accW - PAD_L,
        headW: widthOf(ev.pitch ? HEAD[ev.dur.base] : REST[ev.dur.base]),
      };
      cursor += ADVANCE[ev.dur.code] + accW;
      clock += ev.dur.beats;
      events.push(e);
      bar.events.push(e);
    }
    bar.t1 = clock;
    const only = bar.events.length === 1 ? bar.events[0] : null;
    if (only && only.rest && (only.ev.dur.base === 'w' || (barBeats && Math.abs(only.beats - barBeats) < 1e-9))) {
      only.measureRest = true;
      only.headW = widthOf('restWhole');
    }
    bar.inner = cursor - PAD_L;
    bar.natural = PAD_L + bar.inner + PAD_R;
    return bar;
  });
  const totalBeats = clock;

  // ---- 2. break into systems ---------------------------------------------
  const keyW = keySig ? Math.abs(keySig) * 1.05 + 0.45 : 0;
  const prefixOf = (first) => CLEF_X + widthOf('gClef') + 0.55 + keyW + (first && timeSig ? 2.5 : 0);
  const tailW = endBar === 'final' ? ENGRAVING.thinBar + ENGRAVING.barGap + ENGRAVING.thickBar : endBar === 'single' ? ENGRAVING.thinBar : 0;
  const systems = [];
  for (let i = 0; i < bars.length;) {
    const prefix = prefixOf(systems.length === 0);
    let j = i, used = 0;
    while (j < bars.length) {
      const w = bars[j].natural;
      if (j > i && prefix + (used + w) * MIN_SCALE > availSp - 0.3) break;
      used += w;
      j++;
    }
    systems.push({ index: systems.length, bars: bars.slice(i, j), prefix });
    i = j;
  }

  systems.forEach((sys, k) => {
    const last = k === systems.length - 1;
    const inner = sys.bars.reduce((a, b) => a + b.inner, 0);
    const fixed = sys.prefix + sys.bars.length * (PAD_L + PAD_R) + (last ? tailW : ENGRAVING.thinBar);
    let f = inner > 0 ? (availSp - 0.3 - fixed) / inner : 1;
    if (spec.stretch === false) f = Math.min(1, Math.max(MIN_SCALE, f));
    else if (!last) f = clamp(f, MIN_SCALE, 1.9);
    else if (systems.length === 1) f = clamp(f, MIN_SCALE, spec.maxStretch ?? 1.3);
    else f = clamp(f, MIN_SCALE, Math.max(1.25, systems[k - 1].f * 1.15));
    sys.f = f;
    let x = sys.prefix;
    for (const bar of sys.bars) {
      bar.sys = sys;
      bar.x0 = x;
      for (const e of bar.events) e.x = x + PAD_L + e.off * f;
      x += PAD_L + bar.inner * f + PAD_R;
      bar.x1 = x;
      // a rest that fills the whole measure sits in the middle of it
      const only = bar.events[0];
      if (only.measureRest) only.x = (bar.x0 + bar.x1 - only.headW) / 2;
    }
    sys.width = x + (last ? tailW : ENGRAVING.thinBar / 2);
  });

  // pad a short single-system staff (flash cards) and centre its content
  if (spec.minWidth && systems.length === 1) {
    const sys = systems[0];
    const extra = spec.minWidth / sp - sys.width;
    if (extra > 0) {
      for (const bar of sys.bars) { bar.x0 += extra / 2; bar.x1 += extra / 2; for (const e of bar.events) e.x += extra / 2; }
      sys.bars[0].x0 -= extra / 2;
      sys.bars.at(-1).x1 += extra / 2;
      sys.width += extra;
    }
  }

  // ---- 3. draw each system (coordinates relative to its own top line) -----
  const ext = { top: Math.min(0, 3 - box('gClef')[3]), bottom: Math.max(4, 3 - box('gClef')[1]) };
  const grow = (y) => { if (y < ext.top) ext.top = y; if (y > ext.bottom) ext.bottom = y; };
  const rect = (x, y, w, hgt, cls) => s('rect', { x: px(x), y: px(y), width: px(w), height: px(hgt), fill: 'currentColor', class: cls });
  const glyph = (name, x, y, cls) => s('path', {
    d: GLYPHS[name].d, fill: 'currentColor', class: cls,
    transform: `translate(${px(x)} ${px(y)}) scale(${Math.round((sp / UNITS_PER_SPACE) * 1e5) / 1e5})`,
  });
  const noteEls = new Array(events.length);

  const stemCenter = (e, up) => (up ? e.x + e.headW - STEM_T / 2 : e.x + STEM_T / 2);

  function beamGroups(bar) {
    const groups = [];
    let cur = [], beat = -1;
    const flush = () => { if (cur.length > 1) groups.push(cur); cur = []; };
    for (const e of bar.events) {
      const short = !e.rest && (e.ev.dur.base === 'e' || e.ev.dur.base === 's');
      const b = Math.floor(e.t - bar.t0 + 1e-6);
      if (!short || b !== beat) flush();
      beat = b;
      if (short) cur.push(e);
    }
    flush();
    return groups;
  }

  function drawSystem(sys) {
    const layer = [];
    for (let i = 0; i < 5; i++) layer.push(rect(0, i - ENGRAVING.staffLine / 2, sys.width, ENGRAVING.staffLine, 'staff-line'));
    layer.push(glyph('gClef', CLEF_X, 3, 'clef'));

    let kx = CLEF_X + widthOf('gClef') + 0.45;
    if (keySig) {
      const kind = keySig > 0 ? 'sharp' : 'flat';
      const name = keySig > 0 ? 'accidentalSharp' : 'accidentalFlat';
      for (let i = 0; i < Math.abs(keySig); i++) {
        const y = yOf(KEY_SIG_STEPS[kind][i]);
        layer.push(glyph(name, kx, y, 'keysig'));
        grow(y - box(name)[3]);
        kx += 1.05;
      }
      kx += 0.3;
    }
    if (sys.index === 0 && timeSig) {
      const digits = (n) => String(n).split('').map((d) => 'timeSig' + d);
      const rowW = (names) => names.reduce((a, n) => a + box(n)[2] - box(n)[0], 0);
      const top = digits(timeSig[0]), bottom = digits(timeSig[1]);
      const colW = Math.max(rowW(top), rowW(bottom));
      for (const [names, y] of [[top, 1], [bottom, 3]]) {
        let x = kx + (colW - rowW(names)) / 2;
        for (const n of names) { layer.push(glyph(n, x - box(n)[0], y, 'timesig')); x += box(n)[2] - box(n)[0]; }
      }
    }

    for (const bar of sys.bars) {
      // stems and beams first, so every note knows where its stem ends
      const stems = new Map(); // event -> {up, tip, beamed}
      for (const group of beamGroups(bar)) {
        const above = Math.max(...group.map((e) => e.step - 4)), below = Math.max(...group.map((e) => 4 - e.step));
        const up = below > above;
        const first = group[0], last = group.at(-1);
        const x0 = stemCenter(first, up), x1 = stemCenter(last, up);
        const slope = x1 > x0 ? -clamp((last.step - first.step) * 0.25, -1, 1) / (x1 - x0) : 0;
        const lean = (e) => slope * (stemCenter(e, up) - x0);
        let y0 = up
          ? Math.min(...group.map((e) => yOf(e.step) - lean(e))) - BEAM_STEM
          : Math.max(...group.map((e) => yOf(e.step) - lean(e))) + BEAM_STEM;
        // ledger-line notes: the beam still reaches the middle of the staff
        y0 = up ? Math.min(y0, ...group.map((e) => 2 - lean(e))) : Math.max(y0, ...group.map((e) => 2 - lean(e)));
        const beamY = (x) => y0 + slope * (x - x0);
        const dir = up ? 1 : -1; // towards the noteheads
        const slab = (xa, xb, level) => {
          const o = level * BEAM_STEP * dir;
          const ya = beamY(xa) + o, yb = beamY(xb) + o;
          const pts = up
            ? [[xa, ya], [xb, yb], [xb, yb + BEAM_T], [xa, ya + BEAM_T]]
            : [[xa, ya - BEAM_T], [xb, yb - BEAM_T], [xb, yb], [xa, ya]];
          layer.push(s('polygon', { points: pts.map(([x, y]) => `${px(x)},${px(y)}`).join(' '), fill: 'currentColor', class: 'beam' }));
        };
        slab(x0 - STEM_T / 2, x1 + STEM_T / 2, 0);
        // second beam for sixteenth notes (full between neighbours, a stub when alone)
        for (let i = 0; i < group.length; i++) {
          if (group[i].ev.dur.base !== 's') continue;
          let j = i;
          while (j + 1 < group.length && group[j + 1].ev.dur.base === 's') j++;
          const xa = stemCenter(group[i], up), xb = stemCenter(group[j], up);
          if (j > i) slab(xa - STEM_T / 2, xb + STEM_T / 2, 1);
          else if (i === 0) slab(xa - STEM_T / 2, xa + 1.0, 1);
          else slab(xa - 1.0, xa + STEM_T / 2, 1);
          i = j;
        }
        for (const e of group) { const tip = beamY(stemCenter(e, up)); stems.set(e, { up, tip, beamed: true }); grow(tip); }
      }

      for (const e of bar.events) {
        const base = e.ev.dur.base;
        const g = s('g', { class: e.rest ? 'nt rest' : 'nt', 'data-i': e.index });
        noteEls[e.index] = g;
        if (e.rest) {
          const shape = e.measureRest ? 'w' : base;
          g.append(glyph(REST[shape], e.x, shape === 'w' ? 1 : 2));
          if (e.ev.dur.dots && !e.measureRest) g.append(glyph('augmentationDot', e.x + e.headW + 0.35, 1.5));
          e.cx = e.x + e.headW / 2;
          e.cy = 2;
          layer.push(g);
          continue;
        }
        const y = yOf(e.step);
        e.cx = e.x + e.headW / 2;
        e.cy = y;
        const ledger = (st) => g.append(rect(e.x - ENGRAVING.ledgerExt, yOf(st) - ENGRAVING.ledger / 2, e.headW + 2 * ENGRAVING.ledgerExt, ENGRAVING.ledger, 'ledger'));
        for (let st = -2; st >= e.step; st -= 2) ledger(st);
        for (let st = 10; st <= e.step; st += 2) ledger(st);
        if (e.ev.acc) {
          const name = ACC[e.ev.acc];
          g.append(glyph(name, e.x - 0.28 - widthOf(name), y));
          grow(y - box(name)[3]);
          grow(y - box(name)[1]);
        }
        g.append(glyph(HEAD[base], e.x, y));
        grow(y - 0.5);
        grow(y + 0.5);
        if (e.ev.dur.dots) g.append(glyph('augmentationDot', e.x + e.headW + 0.45, y - (e.step % 2 === 0 ? 0.5 : 0)));
        if (base !== 'w') {
          let stem = stems.get(e);
          if (!stem) {
            const up = e.step < 4;
            stem = { up, tip: up ? Math.min(y - STEM_LEN, 2) : Math.max(y + STEM_LEN, 2), beamed: false };
          }
          e.stemUp = stem.up;
          const sx = stem.up ? e.x + e.headW - STEM_T : e.x;
          const from = stem.up ? y - 0.168 : y + 0.168;
          g.append(rect(sx, Math.min(from, stem.tip), STEM_T, Math.abs(stem.tip - from), 'stem'));
          grow(stem.tip);
          if (!stem.beamed && (base === 'e' || base === 's')) {
            const name = `flag${base === 'e' ? '8th' : '16th'}${stem.up ? 'Up' : 'Down'}`;
            const anchor = GLYPHS[name].anchors[stem.up ? 'stemUpNW' : 'stemDownSW'];
            g.append(glyph(name, sx, stem.tip + anchor[1]));
          }
        } else {
          e.stemUp = e.step < 4;
        }
        layer.push(g);
      }

      // barline at the end of the measure
      const lastBar = bar.index === bars.length - 1;
      if (!lastBar) layer.push(rect(bar.x1 - ENGRAVING.thinBar / 2, 0, ENGRAVING.thinBar, 4, 'barline'));
      else if (endBar === 'single') layer.push(rect(bar.x1, 0, ENGRAVING.thinBar, 4, 'barline'));
      else if (endBar === 'final') {
        layer.push(rect(bar.x1, 0, ENGRAVING.thinBar, 4, 'barline'));
        layer.push(rect(bar.x1 + ENGRAVING.thinBar + ENGRAVING.barGap, 0, ENGRAVING.thickBar, 4, 'barline'));
      }
    }
    return layer;
  }

  const layers = systems.map(drawSystem);

  // ties (drawn after every notehead has a position)
  const tie = (sys, xa, xb, y, below) => {
    const d = below ? 1 : -1;
    const y0 = y + d * 0.75;
    const bulge = clamp(0.45 + (xb - xa) * 0.07, 0.5, 1.1) * d;
    const thick = ENGRAVING.beam * 0.44 * d;
    const c1 = xa + (xb - xa) * 0.25, c2 = xa + (xb - xa) * 0.75;
    const P = (x, yy) => `${px(x)} ${px(yy)}`;
    layers[sys.index].push(s('path', {
      class: 'tie', fill: 'currentColor',
      d: `M${P(xa, y0)}C${P(c1, y0 + bulge)} ${P(c2, y0 + bulge)} ${P(xb, y0)}C${P(c2, y0 + bulge + thick)} ${P(c1, y0 + bulge + thick)} ${P(xa, y0)}Z`,
    }));
    grow(y0 + bulge + thick);
  };
  events.forEach((e, i) => {
    const next = events[i + 1];
    if (!e.ev.tie || e.rest || !next || next.rest || next.ev.pitch.midi !== e.ev.pitch.midi) return;
    const below = e.stemUp;
    if (next.bar.sys === e.bar.sys) tie(e.bar.sys, e.x + e.headW + 0.15, next.x - 0.15, e.cy, below);
    else {
      tie(e.bar.sys, e.x + e.headW + 0.15, e.bar.sys.width - 0.2, e.cy, below);
      tie(next.bar.sys, next.bar.sys.prefix - 0.2, next.x - 0.15, next.cy, below);
    }
  });

  // ---- 4. time <-> x mapping, counting aid, labels ------------------------
  for (const sys of systems) {
    sys.t0 = sys.bars[0].t0;
    sys.t1 = sys.bars.at(-1).t1;
    sys.anchors = [];
    for (const bar of sys.bars) {
      for (const e of bar.events) sys.anchors.push([e.t, e.cx]);
      sys.anchors.push([bar.t1, bar.x1]);
    }
    // a measure-filling rest is centred, which would bend time; pin the bar start instead
    for (const bar of sys.bars) {
      if (bar.events[0].measureRest) sys.anchors.find((p) => p[0] === bar.t0)[1] = bar.x0 + PAD_L + 0.6;
    }
  }
  const locate = (t) => {
    const sys = systems.find((q) => t < q.t1 - 1e-9) || systems.at(-1);
    const a = sys.anchors;
    // the last anchor at or before t (a bar's first note wins over the barline before it)
    let i = 0;
    while (i + 1 < a.length && a[i + 1][0] <= t + 1e-9) i++;
    if (i + 1 >= a.length) return { sys, x: a[i][1] };
    const span = a[i + 1][0] - a[i][0];
    return { sys, x: span > 0 ? a[i][1] + clamp((t - a[i][0]) / span, 0, 1) * (a[i + 1][1] - a[i][1]) : a[i][1] };
  };

  let below = ext.bottom + 0.5;
  const text = (x, y, str, cls) => s('text', { x: px(x), y: px(y), class: cls, 'text-anchor': 'middle', 'font-size': px(1.35) }, str);
  if (spec.labels) {
    const y = below + 1.3;
    for (const e of events) if (!e.rest) layers[e.bar.sys.index].push(text(e.cx, y, pitchName(e.ev.pitch), 'lbl'));
    below = y + 0.5;
  }
  if (spec.counts && timeSig) {
    const y = below + 1.3;
    const step = spec.counts === 'eighths' ? 0.5 : 1;
    for (let t = 0; t < totalBeats - 1e-9; t += step) {
      const bar = bars.find((b) => t < b.t1 - 1e-9);
      const inBar = t - bar.t0;
      const onBeat = Math.abs(inBar - Math.round(inBar)) < 1e-9;
      const { sys, x } = locate(t);
      layers[sys.index].push(text(x, y, onBeat ? String(Math.round(inBar) + 1) : '+', onBeat ? 'count' : 'count count-off'));
    }
    below = y + 0.5;
  }

  // ---- 5. assemble --------------------------------------------------------
  const above = Math.max(1.75, -ext.top + 0.45, spec.range ? (spec.range[1] - 8) / 2 + 1 : 0);
  below = Math.max(below, 4 + 2.1, spec.range ? 4 - spec.range[0] / 2 + 1 : 0);
  const sysH = above + below;
  const width = Math.max(...systems.map((q) => q.width)) + 0.3;
  const height = sysH * systems.length;
  const playhead = s('rect', { class: 'playhead', x: 0, y: 0, width: px(0.28), height: px(4 + 2.4), rx: px(0.14), style: { display: 'none' } });
  const svg = s('svg', {
    class: 'staff', viewBox: `0 0 ${px(width)} ${px(height)}`, width: px(width), height: px(height),
    role: 'img', 'aria-label': 'music notation',
  }, systems.map((sys, k) => s('g', { class: 'system', transform: `translate(${px(0.15)} ${px(k * sysH + above)})` }, layers[k])), playhead);

  const stateOf = new Array(events.length).fill('');
  const api = {
    el: svg,
    width: width * sp,
    height: height * sp,
    totalBeats,
    systems: systems.length,
    /** one entry per event, in reading order */
    notes: events.map((e) => ({ index: e.index, t: e.t, beats: e.beats, rest: e.rest, pitch: e.ev.pitch, el: noteEls[e.index] })),
    /** '' | 'active' | 'good' | 'bad' | 'dim' */
    setState(index, state = '') {
      const e = events[index];
      if (!e || stateOf[index] === state) return;
      stateOf[index] = state;
      noteEls[index].setAttribute('class', (e.rest ? 'nt rest' : 'nt') + (state ? ` is-${state}` : ''));
    },
    setAll(state = '') { for (let i = 0; i < events.length; i++) api.setState(i, state); },
    /** move the playhead to a time in beats (null hides it) */
    playhead(t) {
      if (t == null) { playhead.style.setProperty('display', 'none'); return; }
      const { sys, x } = locate(clamp(t, 0, totalBeats));
      playhead.style.removeProperty('display');
      playhead.setAttribute('x', px(x + 0.15 - 0.14));
      playhead.setAttribute('y', px(sys.index * sysH + above - 1.2));
    },
  };
  return api;
}

// ---------------------------------------------------------------------------
// Stand-alone symbols (used in answer buttons and explanations)
// ---------------------------------------------------------------------------
/**
 * kind: a duration code ('w','h','q','e','s','h.','q.'), a rest ('rw','rh','rq','re','rs'),
 *       'ee' (two beamed eighths), 'sharp' | 'flat' | 'natural', or 'clef'.
 */
export function symbolSvg(kind, { sp = 9 } = {}) {
  const px = (v) => r2(v * sp);
  const parts = [];
  const rect = (x, y, w, hgt) => parts.push(s('rect', { x: px(x), y: px(y), width: px(w), height: px(hgt), fill: 'currentColor' }));
  const glyph = (name, x, y) => parts.push(s('path', {
    d: GLYPHS[name].d, fill: 'currentColor',
    transform: `translate(${px(x)} ${px(y)}) scale(${Math.round((sp / UNITS_PER_SPACE) * 1e5) / 1e5})`,
  }));
  let w = 3, top = -4.2, bottom = 1.1;
  const note = (x, base, dotted) => {
    glyph(HEAD[base], x, 0);
    const hw = widthOf(HEAD[base]);
    if (base !== 'w') rect(x + hw - STEM_T, -STEM_LEN, STEM_T, STEM_LEN - 0.168);
    if (base === 'e' || base === 's') glyph(base === 'e' ? 'flag8thUp' : 'flag16thUp', x + hw - STEM_T, -STEM_LEN + GLYPHS[base === 'e' ? 'flag8thUp' : 'flag16thUp'].anchors.stemUpNW[1]);
    if (dotted) glyph('augmentationDot', x + hw + 0.4, 0);
    return hw;
  };
  if (kind === 'ee') {
    const hw = widthOf('noteheadBlack');
    for (const x of [0.4, 3.0]) { glyph('noteheadBlack', x, 0); rect(x + hw - STEM_T, -STEM_LEN, STEM_T, STEM_LEN - 0.168); }
    rect(0.4 + hw - STEM_T, -STEM_LEN, 2.6 + STEM_T, BEAM_T);
    w = 3.4 + hw;
  } else if (kind in ACC || ['sharp', 'flat', 'natural'].includes(kind)) {
    const name = { sharp: 'accidentalSharp', flat: 'accidentalFlat', natural: 'accidentalNatural' }[kind] || ACC[kind];
    glyph(name, 0.4, 0);
    w = widthOf(name) + 0.8; top = -box(name)[3] - 0.3; bottom = -box(name)[1] + 0.3;
  } else if (kind === 'clef') {
    glyph('gClef', 0.3, 0);
    w = widthOf('gClef') + 0.6; top = -box('gClef')[3] - 0.2; bottom = -box('gClef')[1] + 0.2;
  } else if (kind[0] === 'r') {
    const base = kind[1];
    const name = REST[base];
    // whole and half rests are told apart by the line they hang from / sit on
    if (base === 'w' || base === 'h') rect(0.2, -ENGRAVING.staffLine / 2, widthOf(name) + 1.4, ENGRAVING.staffLine);
    glyph(name, 0.9, 0);
    w = widthOf(name) + 1.8; top = -box(name)[3] - 0.5; bottom = -box(name)[1] + 0.5;
    if (base === 'w' || base === 'h') { top = -1.5; bottom = 1.5; }
  } else {
    const base = kind[0], dotted = kind.endsWith('.');
    const hw = note(0.4, base, dotted);
    w = hw + 0.8 + (dotted ? 0.9 : 0) + (base === 'e' || base === 's' ? 0.9 : 0);
    if (base === 'w') { top = -1.1; bottom = 1.1; }
  }
  return s('svg', {
    class: 'symbol', viewBox: `0 ${px(top)} ${px(w)} ${px(bottom - top)}`, width: px(w), height: px(bottom - top), 'aria-hidden': 'true',
  }, parts);
}
