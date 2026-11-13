// The interactive pieces lessons are built from (besides the progression
// player, melody editor and quiz, which live in their own files).

import { auditionChord, playLead, unlock } from '../audio/audio.js';
import { GROOVES, PATTERNS, compile, player } from '../audio/engine.js';
import { h, icon, select, uid } from '../dom.js';
import { tonicMidi } from '../music/melody.js';
import {
  DEGREE_LABELS, MAJOR_KEYS, SCALES, diatonicChords, makeKey, mod12, noteName, notePc,
  palette, parseChord, parseProgression, scaleFor, toneLabels,
} from '../music/theory.js';
import { OPEN_MIDI, bestVoicing, parseFrets, topTriads, voicingMidi, voicingsFor } from '../music/voicings.js';
import { chordSpans, createAndOpen, resolveChords } from '../songs.js';
import { chordDiagram } from './chord-diagram.js';
import { fretboard, markersFor } from './fretboard.js';
import { chordCard, fnClass, grooveOptions, keyOptions, resolveAbs, tempoControl } from './progression.js';
import { parseTab, tabView } from './tab.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function frame(cls, title, ...kids) {
  const root = h('section', { class: `widget ${cls}` });
  if (title) root.append(h('h4', { class: 'widget-title' }, title));
  root.append(...kids.filter(Boolean));
  return root;
}

function segmented(items, value, onChange) {
  const el = h('div', { class: 'segmented' });
  items.forEach((item) => el.append(h('button', {
    type: 'button', class: item.value === value ? 'on' : '',
    onClick: () => {
      [...el.children].forEach((b) => b.classList.remove('on'));
      el.children[items.indexOf(item)].classList.add('on');
      onChange(item.value);
    },
  }, item.label)));
  return el;
}

function playButton(id, start) {
  const btn = h('button', { class: 'btn btn-play', type: 'button' });
  const set = (on) => {
    btn.replaceChildren(icon(on ? 'stop' : 'play'), on ? 'Stop' : 'Play');
    btn.classList.toggle('on', on);
  };
  btn.addEventListener('click', () => {
    if (player.owner === id) {
      player.stop();
    } else {
      start(() => set(false));
      set(true);
    }
  });
  set(false);
  return btn;
}

const legend = () => h('div', { class: 'legend' },
  h('span', { class: 'legend-item fn-T' }, 'home'),
  h('span', { class: 'legend-item fn-S' }, 'away'),
  h('span', { class: 'legend-item fn-D' }, 'tension'));

// ----------------------------------------------------------- chord gallery ----

// opts: { title, caption, prefer, items: [{ name, frets?, note?, root? }] }
export function chordGallery(opts) {
  const row = h('div', { class: 'chord-row gallery' });
  for (const item of opts.items) {
    const parsed = parseChord(item.name) || { rootPc: 0, q: null };
    const frets = item.frets ? parseFrets(item.frets) : bestVoicing(parsed.rootPc, parsed.q, item.prefer || opts.prefer).frets;
    const rootPc = item.root ? notePc(item.root) : parsed.rootPc;
    row.append(h('button', {
      class: 'chord-card', type: 'button', onClick: () => auditionChord(voicingMidi(frets), { slow: true }),
    },
    h('span', { class: 'cc-name' }, item.name),
    chordDiagram(frets, { rootPc, q: parsed.q }),
    item.note ? h('span', { class: 'cc-beats' }, item.note) : null));
  }
  return frame('gallery-widget', opts.title, row, opts.caption ? h('p', { class: 'widget-caption', html: opts.caption }) : null);
}

// ------------------------------------------------------------ key explorer ----

// opts: { key, mode, sevenths, lockSevenths, title, caption }
export function keyExplorer(opts = {}) {
  const id = uid();
  const state = { key: opts.key || 'C', mode: opts.mode || 'major', sevenths: !!opts.sevenths };
  const row = h('div', { class: 'chord-row' });
  const scaleLine = h('p', { class: 'scale-line' });
  let cards = [];
  let chords = [];

  function draw() {
    const key = makeKey(state.key, state.mode);
    const scale = scaleFor(state.mode).iv;
    chords = resolveChords(state.key, state.mode, diatonicChords(scale, state.sevenths).map((c) => ({ ...c, beats: 2 })));
    cards = chords.map((c) => chordCard({ ...c, beats: 4 }));
    row.replaceChildren(...cards);
    scaleLine.innerHTML = `<b>${state.key} ${state.mode} scale:</b> ${scale.map((d) => `<span class="chip">${noteName(key, d)}</span>`).join(' ')}`;
  }

  const bar = h('div', { class: 'toolbar' },
    playButton(id, (done) => {
      player.play(compile({ chords: [...chords, { ...chords[0], beats: 4 }], pattern: 'halves', groove: 'none' }), {
        bpm: 96, loop: false, owner: id,
        onChord: (i) => cards.forEach((el, k) => el.classList.toggle('active', k === i % chords.length)),
        onStop: () => {
          cards.forEach((el) => el.classList.remove('active'));
          done();
        },
      });
    }),
    h('div', { class: 'toolbar-controls' },
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'key'), select(keyOptions(state.mode), state.key, (v) => {
        state.key = v;
        draw();
      })),
      opts.lockSevenths ? null : segmented([{ value: false, label: 'Triads' }, { value: true, label: '7th chords' }], state.sevenths, (v) => {
        state.sevenths = v;
        draw();
      })),
  );
  draw();
  return frame('key-explorer', opts.title, bar, scaleLine, row, legend(), opts.caption ? h('p', { class: 'widget-caption', html: opts.caption }) : null);
}

// ---------------------------------------------------------------- root map ----

// Where the roots of I ii iii IV V vi sit on the two lowest strings.
export function rootMap(opts = {}) {
  const state = { key: opts.key || 'G', sevenths: false };
  const host = h('div');
  let chords = [];

  function draw() {
    chords = resolveChords(state.key, 'major', diatonicChords(SCALES.major.iv, state.sevenths).slice(0, 6).map((c) => ({ ...c, beats: 4 })));
    const markers = [];
    for (const string of [0, 1]) {
      for (let f = 0; f <= 12; f++) {
        const c = chords.find((ch) => ch.rootPc === (OPEN_MIDI[string] + f) % 12);
        if (c) markers.push({ s: string, f, text: c.roman.replace('maj7', '').replace('7', ''), cls: fnClass(c.info) });
      }
    }
    const board = fretboard({
      from: 0, to: 12, markers, silent: true,
      onPick: (string, fret) => {
        if (string > 1) return;
        const c = chords.find((ch) => ch.rootPc === (OPEN_MIDI[string] + fret) % 12);
        if (!c) return;
        const form = string === 0 ? 'E' : 'A';
        const v = voicingsFor(c.rootPc, c.q).find((x) => x.form === form && x.frets[string] === fret) || { frets: c.frets };
        auditionChord(voicingMidi(v.frets));
        info.innerHTML = `<b>${c.roman}</b> = ${c.symbol} — root on the ${string === 0 ? '6th' : '5th'} string, fret ${fret || 'open'}`;
      },
    });
    host.replaceChildren(board.el);
  }

  const info = h('p', { class: 'widget-caption' }, 'Tap a root to hear its chord.');
  const bar = h('div', { class: 'toolbar' }, h('div', { class: 'toolbar-controls' },
    h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'key'), select(keyOptions('major'), state.key, (v) => {
      state.key = v;
      draw();
    })),
    segmented([{ value: false, label: 'Triads' }, { value: true, label: '7th chords' }], false, (v) => {
      state.sevenths = v;
      draw();
    })));
  draw();
  return frame('root-map', opts.title, bar, host, legend(), info);
}

// ------------------------------------------------------------- chord tones ----

// Fretboard that follows a progression and shows each chord's tones.
// opts: { key, mode, prog, from, to, bpm, pattern, groove, title, caption }
export function chordTones(opts) {
  const id = uid();
  const mode = opts.mode || 'major';
  const state = { key: opts.key || 'C', index: 0, scale: true, bpm: opts.bpm || 80 };
  const parsed = parseProgression(opts.prog);
  const from = opts.from ?? 0;
  const to = opts.to ?? 12;
  const board = fretboard({ from, to });
  const chips = h('div', { class: 'chip-row' });
  const detail = h('p', { class: 'widget-caption' });
  let chords = [];

  function drawBoard() {
    const key = makeKey(state.key, mode);
    const c = chords[state.index];
    const labels = toneLabels(c.q);
    const byPc = new Map();
    if (state.scale) for (const d of scaleFor(mode).iv) byPc.set(mod12(key.pc + d), { text: '', cls: 'ghost', small: true });
    for (const [semis, label] of Object.entries(labels)) {
      byPc.set(mod12(c.rootPc + Number(semis)), { text: label, cls: label === 'R' ? 'root' : 'tone' });
    }
    board.setMarkers(markersFor(byPc, from, to));
    [...chips.children].forEach((el, i) => el.classList.toggle('on', i === state.index));
    const names = Object.entries(labels).map(([semis, label]) => `${label} = ${noteName(key, c.rootPc + Number(semis) - key.pc)}`);
    detail.innerHTML = `<b>${c.symbol}</b> (${c.roman}): ${names.join(' · ')}`;
  }

  function draw() {
    chords = resolveChords(state.key, mode, parsed);
    chips.replaceChildren(...chords.map((c, i) => h('button', {
      type: 'button', class: `chip-btn ${fnClass(c.info)}`,
      onClick: () => {
        state.index = i;
        drawBoard();
        auditionChord(voicingMidi(c.frets));
      },
    }, h('small', {}, c.roman), c.symbol)));
    drawBoard();
  }

  const start = (done) => {
    player.play(compile({ chords, pattern: opts.pattern || 'ring', groove: opts.groove || 'bedroom' }), {
      bpm: state.bpm, owner: id,
      onChord: (i) => {
        state.index = i;
        drawBoard();
      },
      onStop: done,
    });
  };
  const bar = h('div', { class: 'toolbar' },
    playButton(id, start),
    h('div', { class: 'toolbar-controls' },
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'key'), select(keyOptions(mode), state.key, (v) => {
        state.key = v;
        state.index = 0;
        const was = player.owner === id;
        player.stop();
        draw();
        if (was) bar.querySelector('.btn-play').click();
      })),
      tempoControl(state.bpm, (v) => {
        state.bpm = v;
        if (player.owner === id) player.setBpm(v);
      }),
      h('label', { class: 'check' }, h('input', {
        type: 'checkbox', checked: true,
        onChange: (e) => {
          state.scale = e.target.checked;
          drawBoard();
        },
      }), 'show scale')),
  );
  draw();
  return frame('chord-tones', opts.title, bar, chips, board.el, detail,
    h('p', { class: 'hint' }, 'Press play, then tap notes on the neck to jam along. Big dots are chord tones; small dots are the rest of the scale.'),
    opts.caption ? h('p', { class: 'widget-caption', html: opts.caption }) : null);
}

// ---------------------------------------------------------- scale explorer ----

// opts: { key, scale, choices: [scaleId], ghost: scaleId, from, to, title, caption, keys }
export function scaleExplorer(opts = {}) {
  const state = { key: opts.key || 'C', scale: opts.scale || 'major', labels: 'degree', ghost: opts.ghost || null };
  const from = opts.from ?? 0;
  const to = opts.to ?? 15;
  const board = fretboard({ from, to });
  const line = h('p', { class: 'scale-line' });
  const choices = opts.choices || Object.keys(SCALES);
  const minorish = (id) => SCALES[id].iv.includes(3) && !SCALES[id].iv.includes(4);

  function draw() {
    const key = makeKey(state.key, minorish(state.scale) ? 'minor' : 'major');
    const iv = SCALES[state.scale].iv;
    const byPc = new Map();
    if (state.ghost && SCALES[state.ghost]) {
      for (const d of SCALES[state.ghost].iv) {
        if (!iv.includes(d)) byPc.set(mod12(key.pc + d), { text: state.labels === 'degree' ? DEGREE_LABELS[d] : noteName(key, d), cls: 'ghost' });
      }
    }
    for (const d of iv) {
      byPc.set(mod12(key.pc + d), { text: state.labels === 'degree' ? (d === 0 ? 'R' : DEGREE_LABELS[d]) : noteName(key, d), cls: d === 0 ? 'root' : 'tone' });
    }
    board.setMarkers(markersFor(byPc, from, to));
    line.innerHTML = `<b>${state.key} ${SCALES[state.scale].name.toLowerCase()}:</b> ${iv.map((d) => `<span class="chip">${noteName(key, d)}<small>${DEGREE_LABELS[d]}</small></span>`).join(' ')}`;
  }

  const playScale = () => {
    const ctx = unlock();
    const tonic = tonicMidi(notePc(state.key));
    const iv = SCALES[state.scale].iv;
    const run = [...iv, 12, ...[...iv].reverse()];
    run.forEach((d, i) => playLead(tonic + d, ctx.currentTime + 0.05 + i * 0.26, 0.3, 0.85));
  };

  const bar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn btn-play', type: 'button', onClick: playScale }, icon('play'), 'Hear it'),
    h('div', { class: 'toolbar-controls' },
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'root'), select(MAJOR_KEYS.map((k) => ({ value: k, label: k })), state.key, (v) => {
        state.key = v;
        draw();
      })),
      choices.length > 1 ? h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'scale'), select(choices.map((c) => ({ value: c, label: SCALES[c].name })), state.scale, (v) => {
        state.scale = v;
        draw();
      })) : null,
      segmented([{ value: 'degree', label: 'Degrees' }, { value: 'note', label: 'Note names' }], 'degree', (v) => {
        state.labels = v;
        draw();
      })),
  );
  draw();
  return frame('scale-explorer', opts.title, bar, line, board.el, opts.caption ? h('p', { class: 'widget-caption', html: opts.caption }) : null);
}

// -------------------------------------------------------------- rhythm lab ----

const COUNT = ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'];
const GLYPH = { D: '↓', d: '↓', U: '↑', u: '↑', x: '×', N: '↓', '.': '' };

// opts: { key, mode, prog, patterns: [ids], pattern, groove, bpm, title, caption }
export function rhythmLab(opts = {}) {
  const id = uid();
  const mode = opts.mode || 'major';
  const ids = opts.patterns || Object.keys(PATTERNS);
  const state = { pattern: opts.pattern || ids[0], groove: opts.groove || 'bedroom', bpm: opts.bpm || 88 };
  const chords = resolveChords(opts.key || 'A', mode, parseProgression(opts.prog || 'Imaj7 | IVmaj7'));
  const cells = h('div', { class: 'rhythm-grid' });
  const hint = h('p', { class: 'widget-caption' });
  const names = h('div', { class: 'chip-row' }, chords.map((c) => h('span', { class: `chip-btn static ${fnClass(c.info)}` }, h('small', {}, c.roman), c.symbol)));
  let cellEls = [];

  function draw() {
    const pat = PATTERNS[state.pattern];
    cellEls = COUNT.map((label, i) => {
      let glyph = '';
      let cls = 'rg-cell';
      if (pat.arp) {
        const every = pat.every || 2;
        if (i % every === 0) {
          const token = pat.arp[(i / every) % pat.arp.length];
          glyph = token === 'b' ? 'bass' : `str ${token}`;
          cls += ' pick';
        }
      } else {
        const ch = pat.grid[i];
        glyph = GLYPH[ch];
        if (ch !== '.') cls += ch === 'x' ? ' mute' : ch === 'N' ? ' push' : ch === ch.toLowerCase() ? ' soft' : ' hit';
      }
      if (i % 4 === 0) cls += ' beat';
      return h('div', { class: cls }, h('span', { class: 'rg-glyph' }, glyph), h('span', { class: 'rg-count' }, label));
    });
    cells.replaceChildren(...cellEls);
    hint.innerHTML = `<b>${pat.name}.</b> ${pat.hint}${pat.grid?.includes('N') ? ' <span class="chip push">↓ = next chord, early</span>' : ''}`;
    [...buttons.children].forEach((b) => b.classList.toggle('on', b.dataset.id === state.pattern));
  }

  const start = (done) => {
    player.play(compile({ chords, pattern: state.pattern, groove: state.groove }), {
      bpm: state.bpm, owner: id,
      onStep: (step) => cellEls.forEach((el, i) => el.classList.toggle('now', i === step % 16)),
      onChord: (i) => [...names.children].forEach((el, k) => el.classList.toggle('on', k === i)),
      onStop: () => {
        cellEls.forEach((el) => el.classList.remove('now'));
        [...names.children].forEach((el) => el.classList.remove('on'));
        done();
      },
    });
  };
  const play = playButton(id, start);
  const restart = () => {
    draw();
    if (player.owner === id) {
      player.stop();
      play.click();
    }
  };
  const buttons = h('div', { class: 'pattern-buttons' }, ids.map((pid) => h('button', {
    type: 'button', class: 'chip-btn', data: { id: pid },
    onClick: () => {
      state.pattern = pid;
      restart();
    },
  }, PATTERNS[pid].name)));

  const bar = h('div', { class: 'toolbar' }, play, h('div', { class: 'toolbar-controls' },
    tempoControl(state.bpm, (v) => {
      state.bpm = v;
      if (player.owner === id) player.setBpm(v);
    }),
    h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'band'), select(grooveOptions(), state.groove, (v) => {
      state.groove = v;
      restart();
    }))));
  draw();
  return frame('rhythm-lab', opts.title, bar, buttons, names, cells, hint, opts.caption ? h('p', { class: 'widget-caption', html: opts.caption }) : null);
}

// --------------------------------------------------------------- triad map ----

// The three top-string triad grips for a chord, on the neck and as diagrams.
export function triadMap(opts = {}) {
  const state = { root: opts.root || 'G', minor: !!opts.minor };
  const host = h('div');

  function draw() {
    const rootPc = notePc(state.root);
    const q = state.minor ? 'm' : '';
    const shapes = topTriads(rootPc, state.minor);
    const labels = toneLabels(q);
    const markers = [];
    shapes.forEach((v) => v.frets.forEach((f, string) => {
      if (f == null) return;
      const label = labels[mod12(OPEN_MIDI[string] + f - rootPc)];
      markers.push({ s: string, f, text: label, cls: label === 'R' ? 'root' : 'tone' });
    }));
    const board = fretboard({ from: 0, to: 15, markers });
    const names = ['root on the G string', 'root on the high e string', 'root on the B string'];
    const order = shapes.map((v) => {
      const rootString = v.frets.findIndex((f, string) => f != null && mod12(OPEN_MIDI[string] + f - rootPc) === 0 && string >= 3);
      return { v, name: names[[3, 5, 4].indexOf(rootString)] || '' };
    });
    host.replaceChildren(board.el, h('div', { class: 'chord-row gallery' }, order.map(({ v, name }) => h('button', {
      class: 'chord-card', type: 'button', onClick: () => auditionChord(voicingMidi(v.frets), { slow: true }),
    }, h('span', { class: 'cc-name' }, `${state.root}${q}`), chordDiagram(v.frets, { rootPc, q }), h('span', { class: 'cc-beats' }, name)))));
  }

  const bar = h('div', { class: 'toolbar' }, h('div', { class: 'toolbar-controls' },
    h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'chord'), select(MAJOR_KEYS.map((k) => ({ value: k, label: k })), state.root, (v) => {
      state.root = v;
      draw();
    })),
    segmented([{ value: false, label: 'Major' }, { value: true, label: 'Minor' }], state.minor, (v) => {
      state.minor = v;
      draw();
    })));
  draw();
  return frame('triad-map', opts.title, bar, host, opts.caption ? h('p', { class: 'widget-caption', html: opts.caption }) : null);
}

// --------------------------------------------------------- build challenge ----

// "Build a ii–V–I in A."  The learner taps chords from the key's palette.
// opts: { key, mode, sevenths, prompt, borrowed, secondary, check(chords) → { ok, msg }, title }
export function buildChallenge(opts) {
  const id = uid();
  const mode = opts.mode || 'major';
  const keyName = opts.key || 'C';
  const pal = palette(mode, opts.sevenths !== false);
  const groups = [['In the key', pal.diatonic]];
  if (opts.borrowed) groups.push(['Borrowed', pal.borrowed]);
  if (opts.secondary) groups.push(['Secondary & passing', pal.secondary]);
  const chosen = [];
  const strip = h('div', { class: 'chord-row build-strip' });
  const result = h('p', { class: 'quiz-feedback', hidden: true });
  let cards = [];

  const resolved = () => resolveChords(keyName, mode, chosen.map((c) => ({ ...c, beats: 4 })));

  function draw() {
    if (!chosen.length) {
      cards = [];
      strip.replaceChildren(h('p', { class: 'hint' }, 'Tap chords below to build your progression. Tap a chord here to remove it.'));
      return;
    }
    cards = resolved().map((c, i) => chordCard(c, {
      onTap: () => {
        chosen.splice(i, 1);
        result.hidden = true;
        draw();
      },
    }));
    strip.replaceChildren(...cards);
  }

  const paletteEl = h('div', { class: 'palette' }, groups.map(([name, list]) => h('div', { class: 'palette-group' },
    groups.length > 1 ? h('span', { class: 'ctl-label' }, name) : null,
    h('div', { class: 'chip-row' }, resolveChords(keyName, mode, list.map((c) => ({ ...c, beats: 4 }))).map((c, i) => h('button', {
      type: 'button', class: `chip-btn ${fnClass(c.info)}`, title: c.info.why,
      onClick: () => {
        if (chosen.length >= (opts.max || 8)) return;
        chosen.push({ ...list[i] });
        result.hidden = true;
        auditionChord(voicingMidi(c.frets));
        draw();
      },
    }, h('small', {}, c.roman), c.symbol))))));

  const start = (done) => {
    if (!chosen.length) {
      done();
      return;
    }
    player.play(compile({ chords: resolved(), pattern: 'lazy', groove: 'bedroom' }), {
      bpm: 88, owner: id,
      onChord: (i) => cards.forEach((el, k) => el.classList.toggle('active', k === i)),
      onStop: () => {
        cards.forEach((el) => el.classList.remove('active'));
        done();
      },
    });
  };

  const bar = h('div', { class: 'toolbar' },
    playButton(id, start),
    h('button', {
      class: 'btn', type: 'button',
      onClick: () => {
        const verdict = opts.check(resolved());
        result.hidden = false;
        result.className = `quiz-feedback ${verdict.ok ? 'good' : 'bad'}`;
        result.innerHTML = `<b>${verdict.ok ? 'Nice.' : 'Not yet.'}</b> ${verdict.msg}`;
        if (verdict.ok) opts.onPass?.();
      },
    }, icon('check', 16), 'Check'),
    h('button', {
      class: 'btn btn-ghost', type: 'button',
      onClick: () => {
        player.stop();
        chosen.length = 0;
        result.hidden = true;
        draw();
      },
    }, 'Clear'),
    h('span', { class: 'spacer' }),
    h('button', {
      class: 'btn btn-ghost btn-sm', type: 'button',
      onClick: () => {
        if (!chosen.length) return;
        player.stop();
        createAndOpen({ title: opts.title || 'Sketch', key: keyName, mode, prog: chosen.map((c) => ({ ...c, beats: 4 })) });
      },
    }, icon('edit', 15), 'Open in Studio'));

  draw();
  return frame('build', opts.title || 'Build it', h('p', { class: 'quiz-prompt', html: opts.prompt }), strip, bar, result, paletteEl);
}

// -------------------------------------------------------------- tab player ----

// A lick or melody written as tab, with optional backing chords.
// opts: { title, caption, tab, key, mode, prog | abs, bpm, groove, pattern, strum }
export function tabWidget(opts) {
  const id = uid();
  const { notes, total } = parseTab(opts.tab);
  let chords;
  if (opts.abs) chords = resolveAbs(opts.abs);
  else if (opts.prog) chords = resolveChords(opts.key || 'C', opts.mode || 'major', parseProgression(opts.prog));
  else chords = [{ symbol: '', rootPc: 0, q: null, pcs: [], beats: Math.ceil(total / 16) * 4, frets: [null, null, null, null, null, null] }];
  const spans = chordSpans(chords);
  const length = Math.max(total, spans.reduce((sum, sp) => sum + sp.len, 0));
  const view = tabView({ notes, total: length, chords: spans.filter((sp) => sp.symbol).map((sp) => ({ step: sp.start, name: sp.symbol })) });
  let bpm = opts.bpm || 84;

  const start = (done) => {
    const melody = notes.map((n) => ({ s: n.s, d: n.d, midi: OPEN_MIDI[n.string] + n.fret }));
    const backing = opts.abs || opts.prog;
    player.play(compile({
      chords, melody, guitar: !!backing && opts.strum !== false, pattern: opts.pattern || 'ring', groove: backing ? opts.groove || 'bedroom' : 'none',
    }), {
      bpm, owner: id, loop: opts.loop !== false,
      onStep: (step) => view.setPlayhead(step),
      onStop: () => {
        view.setPlayhead(null);
        done();
      },
    });
  };
  const bar = h('div', { class: 'toolbar' }, playButton(id, start), h('div', { class: 'toolbar-controls' }, tempoControl(bpm, (v) => {
    bpm = v;
    if (player.owner === id) player.setBpm(v);
  })));
  return frame('tab-widget', opts.title, bar, view.el, opts.caption ? h('p', { class: 'widget-caption', html: opts.caption }) : null);
}

// -------------------------------------------------------- prompt generator ----

const PROMPT_HARMONY = [
  { text: 'Verse on just two chords: Imaj7 and IVmaj7.', prog: 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7' },
  { text: 'Never land on the I chord — loop ii7 → V7 the whole verse.', prog: 'ii7 | V7 | ii7 | V7' },
  { text: 'Use the minor iv exactly once, right before going home.', prog: 'Imaj7 | iii7 | IVmaj7 | iv6' },
  { text: 'Start the loop on IV so it never feels settled.', prog: 'IVmaj7 | V7 | iii7 | vi7' },
  { text: 'Walk down: IVmaj7 → iii7 → ii7 → Imaj7.', prog: 'IVmaj7 | iii7 | ii7 | Imaj7' },
  { text: 'Slip in a III7 to make the vi chord hurt.', prog: 'Imaj7 | V7/vi | vi7 | IVmaj7' },
  { text: 'Float between Imaj7 and bVIImaj7.', prog: 'Imaj7 | Imaj7 | bVIImaj7 | bVIImaj7' },
  { text: 'Minor key, Dorian flavour: i7 → IV7.', prog: 'i7 | IV7 | i7 | IV7', mode: 'minor' },
  { text: 'Minor key: i7 → bVImaj7 → bIIImaj7 → bVII.', prog: 'i7 | bVImaj7 | bIIImaj7 | bVII', mode: 'minor' },
  { text: 'Slide into the last chord from a half-step above.', prog: 'ii9 | V13 | Imaj9:3 bIImaj7:1 | Imaj9' },
];
const PROMPT_MELODY = [
  'Build the whole melody from one three-note motif.',
  'Pentatonic notes only — no 4th, no 7th.',
  'Start every phrase off the beat.',
  'Land on the 3rd of each chord on beat one.',
  'Leave a full bar of silence in every four.',
  'Keep it inside five notes of the scale.',
  'Save the highest note for one moment only.',
  'Play it all on one string, sliding between notes.',
  'Answer each sung line with a two-note guitar reply.',
];
const PROMPT_VIBE = [
  'Sunday afternoon, nothing to do', 'driving home at 2am', 'texting someone you shouldn’t', 'a heatwave in a small flat',
  'missing a city you left', 'the morning after a good party', 'rain on a bus window', 'a crush you’ll never mention',
  'being broke but happy', 'your friend moving away',
];

export function promptGenerator() {
  const out = h('div', { class: 'prompt-card' });
  let current = null;

  function roll() {
    const harmony = pick(PROMPT_HARMONY);
    const mode = harmony.mode || 'major';
    const groove = pick(['bedroom', 'dream', 'soul', 'jangle', 'boom']);
    const base = GROOVES[groove].bpm;
    current = {
      key: pick(mode === 'minor' ? ['A', 'E', 'D', 'B', 'F#', 'C#'] : ['C', 'G', 'D', 'A', 'E', 'F']),
      mode, groove, harmony, bpm: base + Math.round((Math.random() - 0.5) * 16),
      melody: pick(PROMPT_MELODY), vibe: pick(PROMPT_VIBE),
    };
    out.replaceChildren(
      h('p', { class: 'prompt-vibe' }, `“${current.vibe}”`),
      h('ul', { class: 'prompt-list' },
        h('li', {}, h('b', {}, 'Key & feel: '), `${current.key} ${current.mode}, about ${current.bpm} bpm, ${GROOVES[groove].name.toLowerCase()} groove`),
        h('li', {}, h('b', {}, 'Chords: '), current.harmony.text),
        h('li', {}, h('b', {}, 'Melody: '), current.melody)),
    );
  }

  const bar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', type: 'button', onClick: roll }, icon('dice', 16), 'New prompt'),
    h('button', {
      class: 'btn btn-play', type: 'button',
      onClick: () => createAndOpen({
        title: current.vibe.replace(/^./, (c) => c.toUpperCase()), key: current.key, mode: current.mode, bpm: current.bpm,
        groove: current.groove, prog: parseProgression(current.harmony.prog),
      }),
    }, icon('edit', 16), 'Start this song in the Studio'));
  roll();
  return frame('prompt', 'Song prompt generator', out, bar);
}

// --------------------------------------------------------------- checklist ----

export function checklist(opts) {
  const storageKey = `woozy.check.${opts.id}`;
  let done = [];
  try {
    done = JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch { /* ignore */ }
  const list = h('ul', { class: 'checklist' }, opts.items.map((text, i) => h('li', {}, h('label', {}, h('input', {
    type: 'checkbox', checked: done.includes(i),
    onChange: (e) => {
      done = e.target.checked ? [...done, i] : done.filter((x) => x !== i);
      try {
        localStorage.setItem(storageKey, JSON.stringify(done));
      } catch { /* ignore */ }
    },
  }), h('span', { html: text })))));
  return frame('checklist-widget', opts.title, list);
}
