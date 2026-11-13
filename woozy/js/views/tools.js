// Reference tools: progression cookbook, chord library, scales & keys.

import { auditionChord } from '../audio/audio.js';
import { COOKBOOK } from '../content/cookbook.js';
import { h, select } from '../dom.js';
import {
  MAJOR_KEYS, QUALITIES, QUALITY_GROUPS, SCALES, chordNotes, makeKey, mod12, notePc, romanOf,
} from '../music/theory.js';
import { FORM_NAMES, voicingMidi, voicingsFor } from '../music/voicings.js';
import { chordDiagram } from '../ui/chord-diagram.js';
import { progressionWidget } from '../ui/progression.js';
import { keyExplorer, scaleExplorer } from '../ui/widgets.js';

// ---------------------------------------------------------------- cookbook ----

export function cookbookView() {
  const page = h('div', { class: 'page cookbook' },
    h('header', { class: 'lesson-head' },
      h('p', { class: 'eyebrow' }, 'Reference'),
      h('h1', {}, 'Progression cookbook'),
      h('p', { class: 'lesson-summary' }, 'Loops in the style, sorted by mood. Open one to play it, change its key and strum, or send it to the Studio. They are written as numbers, so every one works in every key.')));

  for (const group of COOKBOOK) {
    const list = h('div', { class: 'cook-list' });
    for (const item of group.items) {
      const slot = h('div', { class: 'cook-slot' });
      const row = h('details', { class: 'cook-item' },
        h('summary', {},
          h('span', { class: 'cook-name' }, item.name),
          h('span', { class: 'cook-prog' }, item.prog.split('|').map((bar) => bar.trim().replace(/:\S+/g, '')).join('  ·  ')),
          h('span', { class: 'cook-note' }, item.note)),
        slot);
      row.addEventListener('toggle', () => {
        if (row.open && !slot.firstChild) {
          slot.append(progressionWidget({
            key: item.key || (item.mode === 'minor' ? 'A' : 'C'), mode: item.mode, prog: item.prog, title: item.name,
            pattern: item.pattern || 'lazy', groove: item.groove || 'bedroom', bpm: item.bpm, prefer: item.prefer,
          }));
        }
      });
      list.append(row);
    }
    page.append(h('section', { class: 'cook-group' }, h('h2', {}, group.title), h('p', { class: 'cook-blurb' }, group.blurb), list));
  }
  return page;
}

// ----------------------------------------------------------- chord library ----

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function chordLibraryView() {
  const state = { root: 'C', q: 'maj7' };
  const out = h('div', { class: 'chordlib-out' });

  function draw() {
    const rootPc = notePc(state.root);
    const quality = QUALITIES[state.q];
    const notes = chordNotes(state.root, state.q);
    const voicings = voicingsFor(rootPc, state.q).filter((v) => v.max <= 15);

    // Which major keys contain this chord?
    const homes = [];
    for (const k of MAJOR_KEYS) {
      const key = makeKey(k);
      const inKey = quality.semis.every((sm) => SCALES.major.iv.includes(mod12(rootPc + sm - key.pc)));
      if (inKey) homes.push(`${romanOf(mod12(rootPc - key.pc), state.q)} in ${k}`);
    }

    out.replaceChildren(
      h('div', { class: 'chordlib-summary' },
        h('h2', {}, `${state.root}${quality.symbol}`),
        h('p', {}, h('b', {}, quality.label), ' · formula ', h('span', { class: 'mono' }, quality.iv.join('  ')), ' · notes ', h('span', { class: 'mono' }, notes.join('  '))),
        h('p', { class: 'hint' }, homes.length
          ? `Found in these major keys (and their relative minors): ${homes.join(' · ')}`
          : 'Not found whole in any major key — this one is a colour or passing chord.')),
      h('div', { class: 'chord-row gallery' }, voicings.map((v) => h('button', {
        class: 'chord-card', type: 'button', onClick: () => auditionChord(voicingMidi(v.frets), { slow: true }),
      },
      h('span', { class: 'cc-frets' }, v.frets.map((f) => (f == null ? 'x' : f)).join(v.frets.some((f) => f > 9) ? ' ' : '')),
      chordDiagram(v.frets, { rootPc, q: state.q }),
      h('span', { class: 'cc-beats' }, FORM_NAMES[v.form])))),
    );
  }

  const qualityOptions = QUALITY_GROUPS.map((g) => ({
    group: g.name,
    options: g.ids.map((id) => ({ value: id, label: `${QUALITIES[id].symbol || 'major'} — ${QUALITIES[id].label}` })),
  }));
  const bar = h('div', { class: 'toolbar' }, h('div', { class: 'toolbar-controls' },
    h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'root'), select(ROOTS.map((r) => ({ value: r, label: r })), state.root, (v) => {
      state.root = v;
      draw();
    })),
    h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'chord'), select(qualityOptions, state.q, (v) => {
      state.q = v;
      draw();
    }))));
  draw();

  return h('div', { class: 'page' },
    h('header', { class: 'lesson-head' },
      h('p', { class: 'eyebrow' }, 'Reference'),
      h('h1', {}, 'Chord library'),
      h('p', { class: 'lesson-summary' }, 'Every way this app knows to play a chord. Tap a shape to hear it; the dots show which chord tone each finger holds.')),
    h('section', { class: 'widget' }, bar, out));
}

// ------------------------------------------------------------ scales & keys ----

export function scalesView() {
  return h('div', { class: 'page' },
    h('header', { class: 'lesson-head' },
      h('p', { class: 'eyebrow' }, 'Reference'),
      h('h1', {}, 'Scales & keys'),
      h('p', { class: 'lesson-summary' }, 'Any scale across the neck, and the chord family of any key.')),
    scaleExplorer({ key: 'A', scale: 'majorPent', title: 'Scale on the neck', caption: 'Tap any note to hear it. Switch to note names if you are finding your way around a new key.' }),
    keyExplorer({ key: 'C', sevenths: true, title: 'Chords of a major key' }),
    keyExplorer({ key: 'A', mode: 'minor', sevenths: true, title: 'Chords of a minor key' }));
}
