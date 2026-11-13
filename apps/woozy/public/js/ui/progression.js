// Playable chord progression: chord cards with diagrams, a transport, and
// key / tempo / strum / band controls.  Used in lessons and the cookbook.

import { auditionChord } from '../audio/audio.js';
import { GROOVES, PATTERNS, compile, player } from '../audio/engine.js';
import { h, icon, select, uid } from '../dom.js';
import { MAJOR_KEYS, MINOR_KEYS, parseChord, parseProgression } from '../music/theory.js';
import { parseFrets, voicingMidi } from '../music/voicings.js';
import { createAndOpen, resolveChords } from '../songs.js';
import { chordDiagram } from './chord-diagram.js';

export const beatsLabel = (beats) =>
  beats === 4 ? '1 bar' : beats % 4 === 0 ? `${beats / 4} bars` : beats === 1 ? '1 beat' : `${beats} beats`;

// CSS class describing a chord's job in the key (colours the card).
export function fnClass(info) {
  if (!info) return '';
  if (info.kind === 'diatonic') return `fn-${info.fn || 'x'}`;
  return `fn-${info.kind}`;
}

// Explicit chords (name + frets) for examples that only make sense as written.
export function resolveAbs(list) {
  return list.map((item) => {
    const parsed = parseChord(item.name) || { rootPc: 0, q: null };
    const frets = parseFrets(item.frets);
    const rootPc = item.root != null ? parseChord(item.root).rootPc : parsed.rootPc;
    return {
      symbol: item.name, roman: item.roman || '', rootPc, q: parsed.q, beats: item.beats ?? 4, frets,
      pcs: [...new Set(voicingMidi(frets).filter((m) => m != null).map((m) => m % 12))], info: null,
    };
  });
}

export function chordCard(c, { onTap, active = false, diagram = true } = {}) {
  return h('button', {
    class: `chord-card ${fnClass(c.info)}${active ? ' active' : ''}`, type: 'button', title: c.info?.why || '',
    onClick: onTap || (() => auditionChord(voicingMidi(c.frets))),
  },
  h('span', { class: 'cc-roman' }, c.roman || ' '),
  h('span', { class: 'cc-name' }, c.symbol),
  diagram ? chordDiagram(c.frets, { rootPc: c.rootPc, q: c.q }) : null,
  c.beats !== 4 ? h('span', { class: 'cc-beats' }, beatsLabel(c.beats)) : null);
}

export const keyOptions = (mode) => (mode === 'minor' ? MINOR_KEYS : MAJOR_KEYS).map((k) => ({ value: k, label: mode === 'minor' ? `${k} minor` : `${k} major` }));
export const patternOptions = () => Object.entries(PATTERNS).map(([value, p]) => ({ value, label: p.name }));
export const grooveOptions = () => Object.entries(GROOVES).map(([value, g]) => ({ value, label: g.name }));

export function tempoControl(bpm, onChange) {
  const out = h('span', { class: 'tempo-val' }, `${bpm}`);
  const range = h('input', {
    type: 'range', min: 50, max: 160, step: 1, value: bpm, class: 'range', 'aria-label': 'Tempo',
    onInput: (e) => {
      out.textContent = e.target.value;
      onChange(Number(e.target.value));
    },
  });
  return h('label', { class: 'tempo' }, h('span', { class: 'ctl-label' }, 'bpm'), range, out);
}

// opts: { title, caption, key, mode, prog | abs | variants: [{ label, prog|abs,
//         voicings, prefer, mode, pattern, groove, bpm, caption }], bpm, pattern,
//         groove, prefer, studio }
export function progressionWidget(opts) {
  const variants = opts.variants || [{ prog: opts.prog, abs: opts.abs, voicings: opts.voicings }];
  const id = uid();
  const pickFor = (v, name, fallback) => v[name] ?? opts[name] ?? fallback;
  const state = {
    v: 0,
    key: opts.key || 'C',
    bpm: pickFor(variants[0], 'bpm', 84),
    pattern: pickFor(variants[0], 'pattern', 'lazy'),
    groove: pickFor(variants[0], 'groove', 'bedroom'),
  };
  const homeKey = state.key;

  const root = h('section', { class: 'widget prog' });
  const cards = h('div', { class: 'chord-row' });
  const caption = h('p', { class: 'widget-caption' });
  const playBtn = h('button', { class: 'btn btn-play', type: 'button', onClick: toggle });
  let cardEls = [];

  function current() {
    const v = variants[state.v];
    const mode = pickFor(v, 'mode', 'major');
    if (v.abs) return { chords: resolveAbs(v.abs), mode, abs: true };
    const parsed = parseProgression(v.prog);
    const chords = resolveChords(state.key, mode, parsed, {
      voicings: state.key === homeKey ? v.voicings : null,
      prefer: pickFor(v, 'prefer', undefined),
    });
    return { chords, mode, parsed };
  }

  function drawCards() {
    const { chords } = current();
    cardEls = chords.map((c) => {
      const card = chordCard(c);
      card.style.flexGrow = String(Math.max(1, c.beats / 2));
      return card;
    });
    cards.replaceChildren(...cardEls);
    const text = variants[state.v].caption ?? opts.caption;
    caption.innerHTML = text || '';
    caption.hidden = !text;
  }

  function setPlaying(on) {
    playBtn.replaceChildren(icon(on ? 'stop' : 'play'), on ? 'Stop' : 'Play');
    playBtn.classList.toggle('on', on);
    if (!on) cardEls.forEach((el) => el.classList.remove('active'));
  }

  function play() {
    const { chords } = current();
    player.play(compile({ chords, pattern: state.pattern, groove: state.groove }), {
      bpm: state.bpm,
      owner: id,
      onChord: (i) => cardEls.forEach((el, k) => el.classList.toggle('active', k === i)),
      onStop: () => setPlaying(false),
    });
    setPlaying(true);
  }

  function toggle() {
    if (player.owner === id) player.stop();
    else play();
  }

  const refresh = () => {
    drawCards();
    if (player.owner === id) play();
  };

  // ---- toolbar
  const bar = h('div', { class: 'toolbar' }, playBtn);
  if (variants.length > 1) {
    const seg = h('div', { class: 'segmented', role: 'tablist' });
    variants.forEach((v, i) => {
      seg.append(h('button', {
        type: 'button', class: i === 0 ? 'on' : '',
        onClick: () => {
          state.v = i;
          state.bpm = pickFor(v, 'bpm', state.bpm);
          state.pattern = pickFor(v, 'pattern', state.pattern);
          state.groove = pickFor(v, 'groove', state.groove);
          [...seg.children].forEach((b, k) => b.classList.toggle('on', k === i));
          drawToolbarControls();
          refresh();
        },
      }, v.label));
    });
    bar.append(seg);
  }
  const controls = h('div', { class: 'toolbar-controls' });
  bar.append(controls);

  function drawToolbarControls() {
    const { mode, abs } = current();
    controls.replaceChildren(
      abs ? null : h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'key'), select(keyOptions(mode), state.key, (v) => {
        state.key = v;
        refresh();
      })),
      tempoControl(state.bpm, (v) => {
        state.bpm = v;
        if (player.owner === id) player.setBpm(v);
      }),
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'strum'), select(patternOptions(), state.pattern, (v) => {
        state.pattern = v;
        refresh();
      })),
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'band'), select(grooveOptions(), state.groove, (v) => {
        state.groove = v;
        refresh();
      })),
    );
  }

  const foot = h('div', { class: 'widget-foot' }, caption);
  if (opts.studio !== false && !variants.every((v) => v.abs)) {
    foot.append(h('button', {
      class: 'btn btn-ghost btn-sm', type: 'button',
      onClick: () => {
        const { parsed, mode, abs } = current();
        if (abs) return;
        player.stop();
        createAndOpen({
          title: opts.title || 'Sketch', key: state.key, mode, bpm: state.bpm, groove: state.groove, pattern: state.pattern, prog: parsed,
        });
      },
    }, icon('edit', 15), 'Open in Studio'));
  }

  if (opts.title) root.append(h('h4', { class: 'widget-title' }, opts.title));
  root.append(bar, cards, foot);
  setPlaying(false);
  drawToolbarControls();
  drawCards();
  return root;
}
