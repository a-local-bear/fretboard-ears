// Lessons are written as lists of blocks (see content/); this turns a block
// list into DOM.

import { h, icon } from '../dom.js';
import { createAndOpen, newSection } from '../songs.js';
import { melodyWidget } from './melody-editor.js';
import { progressionWidget } from './progression.js';
import { quizWidget } from './quiz.js';
import {
  buildChallenge, checklist, chordGallery, chordTones, keyExplorer, promptGenerator, rhythmLab, rootMap, scaleExplorer,
  tabWidget, triadMap,
} from './widgets.js';

const CALLOUT_TITLES = { tip: 'Tip', guitar: 'On your guitar', ear: 'Listen for it', warn: 'Careful', why: 'Why it works' };

const RENDER = {
  p: (b) => h('div', { class: 'prose', html: b.html }),
  h: (b) => h('h3', { class: 'lesson-h' }, b.text),
  callout: (b) => h('aside', { class: `callout callout-${b.kind || 'tip'}` },
    h('h4', {}, b.title || CALLOUT_TITLES[b.kind || 'tip']),
    h('div', { class: 'prose', html: b.html })),
  listen: (b) => h('aside', { class: 'callout callout-ear' },
    h('h4', {}, b.title || 'Listening homework'),
    h('ul', { class: 'listen-list' }, b.items.map(([song, what]) => h('li', {}, h('b', {}, song), what ? ` — ${what}` : '')))),
  // A button that drops a ready-made song skeleton into the Studio.
  starter: (b) => h('div', { class: 'starter' }, h('button', {
    class: 'btn btn-play', type: 'button',
    onClick: () => createAndOpen({ ...b.song, sections: b.song.sections.map((sec) => newSection(sec.name, sec.prog, sec.melody || '')) }),
  }, icon('edit', 16), b.label)),
  chords: chordGallery,
  prog: progressionWidget,
  keys: keyExplorer,
  rootmap: rootMap,
  tones: chordTones,
  scale: scaleExplorer,
  rhythm: rhythmLab,
  triads: triadMap,
  tab: tabWidget,
  melody: melodyWidget,
  prompt: promptGenerator,
  checklist,
  build: (b, ctx) => buildChallenge({ ...b, onPass: ctx.onPass }),
  quiz: (b, ctx) => quizWidget({ ...b, onPass: ctx.onPass }),
};

export function renderBlocks(blocks, ctx = {}) {
  const frag = document.createDocumentFragment();
  for (const block of blocks) {
    const render = RENDER[block.t];
    if (!render) throw new Error(`Unknown lesson block type: ${block.t}`);
    try {
      frag.append(render(block, ctx));
    } catch (err) {
      console.error('Lesson block failed', block, err);
      frag.append(h('p', { class: 'block-error' }, `This example failed to load (${err.message}).`));
    }
  }
  return frag;
}
