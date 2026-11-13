// Melody grid: time runs left → right, pitch bottom → top.  Under every chord
// its chord tones are tinted, so "land on a chord tone" is something you can
// see.  Below the grid the same line is shown as guitar tab.

import { tapNote } from '../audio/audio.js';
import { compile, player } from '../audio/engine.js';
import { h, icon, s, select, uid } from '../dom.js';
import { MELODY_HI, MELODY_LO, assignFrets, bestPosition, generateMelody, parseMelody, tonicMidi } from '../music/melody.js';
import { DEGREE_LABELS, SCALES, makeKey, mod12, noteName, parseProgression, toneLabels } from '../music/theory.js';
import { chordSpans, createAndOpen, melodyToMidi, newSection, resolveChords } from '../songs.js';
import { keyOptions, tempoControl } from './progression.js';
import { tabView } from './tab.js';

const CW = 21; // column width
const RH = 20; // row height
const HEAD = 24;
const LABEL_W = 54;

export const MELODY_SCALES = ['major', 'majorPent', 'minor', 'minorPent', 'dorian', 'mixolydian', 'lydian', 'blues'];
const LENGTHS = [{ d: 1, label: '1/16' }, { d: 2, label: '1/8' }, { d: 4, label: '1/4' }, { d: 6, label: '3/8' }, { d: 8, label: '1/2' }, { d: 16, label: 'bar' }];

// opts: {
//   ctx(): { key, spans, total }   key = makeKey(), spans from chordSpans()
//   notes: [{ s, d, p }]           edited in place
//   onChange(), scale, onScale(id)
// }
export function melodyEditor(opts) {
  const state = { len: 2, res: 2, chromatic: false, scale: opts.scale || 'major', pos: 'auto' };
  const undo = [];
  let rows = [];
  let grid = null;
  let head = null;
  let tab = null;
  let ctx = null;

  const gridHost = h('div', { class: 'mg-wrap' });
  const tabHost = h('div', { class: 'mg-tab' });
  const toolbar = h('div', { class: 'toolbar mg-tools' });
  const root = h('div', { class: 'melody-editor' }, toolbar, gridHost, tabHost);

  function snapshot() {
    undo.push(JSON.stringify(opts.notes));
    if (undo.length > 30) undo.shift();
  }

  function changed() {
    opts.notes.sort((a, b) => a.s - b.s);
    draw();
    drawToolbar(); // Undo becomes available
    opts.onChange?.();
  }

  function computeRows() {
    const scale = SCALES[state.scale].iv;
    const used = new Set(opts.notes.map((n) => n.p));
    const chordRel = new Set();
    for (const sp of ctx.spans) for (const pc of sp.pcs) chordRel.add(mod12(pc - ctx.key.pc));
    const out = [];
    for (let p = MELODY_HI; p >= MELODY_LO; p--) {
      const rel = mod12(p);
      const inScale = scale.includes(rel);
      if (state.chromatic || inScale || chordRel.has(rel) || used.has(p)) out.push({ p, rel, inScale });
    }
    return out;
  }

  function place(step, p) {
    const d = Math.max(1, Math.min(state.len, ctx.total - step));
    for (let i = opts.notes.length - 1; i >= 0; i--) {
      const n = opts.notes[i];
      if (n.s >= step && n.s < step + d) opts.notes.splice(i, 1);
      else if (n.s < step && n.s + n.d > step) n.d = step - n.s;
    }
    opts.notes.push({ s: step, d, p });
  }

  function onGridClick(e) {
    const box = grid.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * Number(grid.getAttribute('width'));
    const y = ((e.clientY - box.top) / box.height) * Number(grid.getAttribute('height')) - HEAD;
    if (y < 0) return;
    const step = Math.floor(x / CW) * state.res;
    const row = rows[Math.floor(y / RH)];
    if (!row || step >= ctx.total || step < 0) return;
    snapshot();
    const hit = opts.notes.findIndex((n) => n.p === row.p && step >= n.s && step < n.s + n.d);
    if (hit >= 0) {
      opts.notes.splice(hit, 1);
    } else {
      place(step, row.p);
      tapNote(tonicMidi(ctx.key.pc) + row.p, 0.8);
    }
    changed();
  }

  function drawGrid() {
    const { key, spans, total } = ctx;
    rows = computeRows();
    const cols = Math.ceil(total / state.res);
    const width = cols * CW + 1;
    const height = HEAD + rows.length * RH + 1;
    const xOf = (step) => (step / state.res) * CW;

    const labels = s('svg', { width: LABEL_W, height, viewBox: `0 0 ${LABEL_W} ${height}`, class: 'mg-labels' });
    grid = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'mg-grid' });

    rows.forEach((row, i) => {
      const y = HEAD + i * RH;
      const cls = row.rel === 0 ? 'mg-row tonic' : row.inScale ? 'mg-row' : 'mg-row out';
      grid.append(s('rect', { x: 0, y, width, height: RH, class: cls }));
      labels.append(s('rect', { x: 0, y, width: LABEL_W, height: RH, class: cls }));
      labels.append(s('text', { x: 8, y: y + 14, class: row.rel === 0 ? 'mg-name tonic' : 'mg-name' }, noteName(key, row.rel)));
      labels.append(s('text', { x: LABEL_W - 6, y: y + 14, class: 'mg-deg', 'text-anchor': 'end' }, DEGREE_LABELS[row.rel]));
    });

    // Chord-tone tint under each chord, with the interval written at its left edge.
    for (const sp of spans) {
      const names = sp.q != null ? toneLabels(sp.q) : {};
      rows.forEach((row, i) => {
        const pc = mod12(key.pc + row.rel);
        if (!sp.pcs.includes(pc)) return;
        const isRoot = pc === sp.rootPc;
        grid.append(s('rect', { x: xOf(sp.start) + 1, y: HEAD + i * RH + 1, width: xOf(sp.len) - 2, height: RH - 2, rx: 3, class: isRoot ? 'mg-tone root' : 'mg-tone' }));
        const label = names[mod12(pc - sp.rootPc)];
        if (label) grid.append(s('text', { x: xOf(sp.start) + 5, y: HEAD + i * RH + 14, class: 'mg-tone-label' }, label));
      });
      grid.append(s('text', { x: xOf(sp.start) + 5, y: 16, class: 'mg-chord' }, sp.symbol));
    }

    for (let c = 0; c <= cols; c++) {
      const step = c * state.res;
      const cls = step % 16 === 0 ? 'mg-vline bar' : step % 4 === 0 ? 'mg-vline beat' : 'mg-vline';
      grid.append(s('line', { x1: c * CW + 0.5, x2: c * CW + 0.5, y1: step % 16 === 0 ? 0 : HEAD, y2: height, class: cls }));
    }
    for (let i = 0; i <= rows.length; i++) grid.append(s('line', { x1: 0, x2: width, y1: HEAD + i * RH + 0.5, y2: HEAD + i * RH + 0.5, class: 'mg-hline' }));

    for (const n of opts.notes) {
      const i = rows.findIndex((r) => r.p === n.p);
      if (i < 0 || n.s >= total) continue;
      const sp = spans.find((x) => n.s >= x.start && n.s < x.start + x.len);
      const isTone = sp && sp.pcs.includes(mod12(key.pc + n.p));
      grid.append(s('rect', {
        x: xOf(n.s) + 1.5, y: HEAD + i * RH + 2.5, width: Math.max(6, xOf(Math.min(n.d, total - n.s)) - 3), height: RH - 5, rx: 4,
        class: isTone ? 'mg-note tone' : rows[i].inScale ? 'mg-note' : 'mg-note out',
      }));
    }

    head = s('line', { x1: 0, x2: 0, y1: 0, y2: height, class: 'mg-head', visibility: 'hidden' });
    grid.append(head);
    grid.addEventListener('click', onGridClick);
    gridHost.replaceChildren(labels, h('div', { class: 'mg-scroll' }, grid));
  }

  function drawTab() {
    const { key, spans, total } = ctx;
    if (!opts.notes.length) {
      tab = null;
      tabHost.replaceChildren(h('p', { class: 'hint' }, 'Tap the grid to place notes — the tab for your line appears here.'));
      return;
    }
    const midi = melodyToMidi(opts.notes, key.pc);
    const pos = state.pos === 'auto' ? bestPosition(midi) : Number(state.pos);
    const placed = assignFrets(midi, pos);
    tab = tabView({ notes: placed, total, chords: spans.map((sp) => ({ step: sp.start, name: sp.symbol })) });
    const positions = [{ value: 'auto', label: `auto (fret ${pos || 'open'})` }, { value: '0', label: 'open position' }];
    for (let f = 2; f <= 12; f++) positions.push({ value: String(f), label: `around fret ${f}` });
    tabHost.replaceChildren(
      h('div', { class: 'mg-tab-head' },
        h('span', { class: 'ctl-label' }, 'tab'),
        h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'play it'), select(positions, state.pos, (v) => {
          state.pos = v;
          drawTab();
        }))),
      tab.el,
    );
  }

  function draw() {
    ctx = opts.ctx();
    drawGrid();
    drawTab();
  }

  function drawToolbar() {
    const lengths = h('div', { class: 'segmented', title: 'Length of the next note you place' });
    for (const l of LENGTHS) {
      if (l.d < state.res) continue;
      lengths.append(h('button', {
        type: 'button', class: l.d === state.len ? 'on' : '',
        onClick: () => {
          state.len = l.d;
          drawToolbar();
        },
      }, l.label));
    }
    const scaleOptions = MELODY_SCALES.map((id) => ({ value: id, label: SCALES[id].name }));
    toolbar.replaceChildren(
      h('span', { class: 'ctl-label' }, 'note'),
      lengths,
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'scale'), select(scaleOptions, state.scale, (v) => {
        state.scale = v;
        opts.onScale?.(v);
        draw();
      })),
      h('label', { class: 'check' }, h('input', {
        type: 'checkbox', checked: state.res === 1,
        onChange: (e) => {
          state.res = e.target.checked ? 1 : 2;
          if (state.len < state.res) state.len = state.res;
          drawToolbar();
          draw();
        },
      }), '16ths'),
      h('label', { class: 'check' }, h('input', {
        type: 'checkbox', checked: state.chromatic,
        onChange: (e) => {
          state.chromatic = e.target.checked;
          draw();
        },
      }), 'all 12 notes'),
      h('span', { class: 'spacer' }),
      h('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', title: 'Generate a motif-based idea you can edit',
        onClick: () => {
          snapshot();
          const idea = generateMelody({ spans: ctx.spans, scale: SCALES[state.scale].iv, total: ctx.total, keyPc: ctx.key.pc });
          opts.notes.splice(0, opts.notes.length, ...idea);
          changed();
        },
      }, icon('dice', 15), 'Idea'),
      h('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', disabled: !undo.length,
        onClick: () => {
          if (!undo.length) return;
          opts.notes.splice(0, opts.notes.length, ...JSON.parse(undo.pop()));
          changed();
        },
      }, 'Undo'),
      h('button', {
        class: 'btn btn-ghost btn-sm', type: 'button',
        onClick: () => {
          if (!opts.notes.length) return;
          snapshot();
          opts.notes.splice(0, opts.notes.length);
          changed();
        },
      }, 'Clear'),
    );
  }

  function setPlayhead(step) {
    tab?.setPlayhead(step);
    if (!head) return;
    if (step == null || step < 0) {
      head.setAttribute('visibility', 'hidden');
      return;
    }
    const x = (step / state.res) * CW + 1;
    head.setAttribute('x1', x);
    head.setAttribute('x2', x);
    head.setAttribute('visibility', 'visible');
  }

  drawToolbar();
  draw();
  return {
    el: root,
    refresh: draw,
    setPlayhead,
    get scale() { return state.scale; },
    replace(notes) {
      snapshot();
      opts.notes.splice(0, opts.notes.length, ...notes);
      changed();
    },
  };
}

// A self-contained melody example for lessons: backing chords + editable line.
// opts: { title, caption, key, mode, prog, melody, scale, bpm, pattern, groove }
export function melodyWidget(opts) {
  const id = uid();
  const mode = opts.mode || 'major';
  const parsed = parseProgression(opts.prog);
  const variants = opts.variants || [{ label: null, melody: opts.melody || '' }];
  const notes = parseMelody(variants[0].melody);
  const state = { key: opts.key || 'C', bpm: opts.bpm || 84, v: 0 };
  const pattern = opts.pattern || 'ring';
  const groove = opts.groove || 'bedroom';

  const context = () => {
    const chords = resolveChords(state.key, mode, parsed);
    const spans = chordSpans(chords);
    return { key: makeKey(state.key, mode), chords, spans, total: spans.reduce((sum, sp) => sum + sp.len, 0) };
  };
  const arrangement = () => {
    const c = context();
    return compile({ chords: c.chords, pattern, groove, melody: melodyToMidi(notes, c.key.pc) });
  };

  const playBtn = h('button', { class: 'btn btn-play', type: 'button', onClick: toggle });
  const setPlaying = (on) => {
    playBtn.replaceChildren(icon(on ? 'stop' : 'play'), on ? 'Stop' : 'Play');
    playBtn.classList.toggle('on', on);
    if (!on) editor.setPlayhead(null);
  };
  const editor = melodyEditor({
    ctx: context,
    notes,
    scale: opts.scale || (mode === 'minor' ? 'minor' : 'major'),
    onChange: () => {
      if (player.owner === id) player.update(arrangement());
    },
  });

  function play() {
    player.play(arrangement(), {
      bpm: state.bpm, owner: id, onStep: (step) => editor.setPlayhead(step), onStop: () => setPlaying(false),
    });
    setPlaying(true);
  }
  function toggle() {
    if (player.owner === id) player.stop();
    else play();
  }

  const bar = h('div', { class: 'toolbar' }, playBtn);
  if (variants.length > 1) {
    const seg = h('div', { class: 'segmented' });
    variants.forEach((v, i) => seg.append(h('button', {
      type: 'button', class: i === 0 ? 'on' : '',
      onClick: () => {
        state.v = i;
        [...seg.children].forEach((b, k) => b.classList.toggle('on', k === i));
        editor.replace(parseMelody(v.melody));
        caption.innerHTML = v.caption ?? opts.caption ?? '';
      },
    }, v.label)));
    bar.append(seg);
  }
  bar.append(h('div', { class: 'toolbar-controls' },
    h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'key'), select(keyOptions(mode), state.key, (v) => {
      state.key = v;
      editor.refresh();
      if (player.owner === id) play();
    })),
    tempoControl(state.bpm, (v) => {
      state.bpm = v;
      if (player.owner === id) player.setBpm(v);
    }),
    h('button', {
      class: 'btn btn-ghost btn-sm', type: 'button', title: 'Back to the lesson example',
      onClick: () => editor.replace(parseMelody(variants[state.v].melody)),
    }, 'Reset'),
  ));

  const caption = h('p', { class: 'widget-caption', html: variants[0].caption ?? opts.caption ?? '' });
  const foot = h('div', { class: 'widget-foot' }, caption, h('button', {
    class: 'btn btn-ghost btn-sm', type: 'button',
    onClick: () => {
      player.stop();
      const section = newSection('Verse', parsed, notes);
      createAndOpen({ title: opts.title || 'Melody sketch', key: state.key, mode, bpm: state.bpm, groove, pattern, scale: editor.scale, sections: [section] });
    },
  }, icon('edit', 15), 'Open in Studio'));

  const root = h('section', { class: 'widget melody' });
  if (opts.title) root.append(h('h4', { class: 'widget-title' }, opts.title));
  root.append(bar, editor.el, foot);
  setPlaying(false);
  return root;
}
