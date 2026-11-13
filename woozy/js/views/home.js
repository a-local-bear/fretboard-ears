// Home: where you are in the course, and the way into everything else.

import { COOKBOOK } from '../content/cookbook.js';
import { LESSONS, MODULES } from '../content/curriculum.js';
import { h, icon } from '../dom.js';
import { isDone, songList } from '../store.js';

export function homeView() {
  const done = LESSONS.filter((l) => isDone(l.id)).length;
  const next = LESSONS.find((l) => !isDone(l.id));
  const songs = songList();
  const minutesLeft = LESSONS.filter((l) => !isDone(l.id)).reduce((sum, l) => sum + l.minutes, 0);

  const hero = h('section', { class: 'hero' },
    h('p', { class: 'eyebrow' }, 'A guitar songwriting course'),
    h('h1', {}, 'Write woozy, jazzy bedroom-pop songs on guitar'),
    h('p', { class: 'hero-lede' },
      'You know your cowboy chords, your barre chords and the notes on the neck. This course turns that into the harmony, rhythm and melody of Mac DeMarco, Steve Lacy, Men I Trust and King Krule — with everything playable, so you hear each idea before you try it on your guitar.'),
    h('div', { class: 'hero-actions' },
      next
        ? h('a', { class: 'btn btn-play btn-lg', href: `#/lesson/${next.id}` }, icon('play'), done ? `Continue: ${next.number} ${next.title}` : 'Start lesson 1')
        : h('a', { class: 'btn btn-play btn-lg', href: '#/studio' }, icon('edit'), 'Course complete — go write'),
      h('a', { class: 'btn btn-lg', href: '#/studio' }, icon('edit'), songs.length ? `Studio (${songs.length} song${songs.length === 1 ? '' : 's'})` : 'Open the Studio')),
    h('div', { class: 'progress-line' },
      h('div', { class: 'progress-bar' }, h('span', { style: { width: `${(done / LESSONS.length) * 100}%` } })),
      h('span', { class: 'progress-text' }, `${done} of ${LESSONS.length} lessons done${minutesLeft ? ` · about ${Math.round(minutesLeft / 60 * 10) / 10} hours of lessons left` : ''}`)));

  const tools = h('section', { class: 'tool-grid' },
    toolCard('#/studio', 'edit', 'Studio', 'Build progressions, write melodies over them, and keep your songs. Synced across your devices.'),
    toolCard('#/cookbook', 'copy', 'Progression cookbook', `${COOKBOOK.reduce((sum, g) => sum + g.items.length, 0)} loops in the style, sorted by mood. Play, transpose, steal.`),
    toolCard('#/chords', 'guitar', 'Chord library', 'Every shape for every chord, with the chord tones labelled.'),
    toolCard('#/scales', 'sound', 'Scales & keys', 'Any scale on the neck, and the chords of any key.'));

  const outline = h('section', { class: 'outline' }, h('h2', {}, 'The course'),
    MODULES.map((m, mi) => {
      const moduleDone = m.lessons.filter((l) => isDone(l.id)).length;
      return h('article', { class: 'module-card' },
        h('header', {},
          h('span', { class: 'module-num' }, String(mi + 1)),
          h('div', {}, h('h3', {}, m.title), h('p', {}, m.blurb)),
          h('span', { class: `module-count${moduleDone === m.lessons.length ? ' complete' : ''}` }, `${moduleDone}/${m.lessons.length}`)),
        h('ol', { class: 'lesson-list' }, m.lessons.map((l, li) => h('li', {},
          h('a', { href: `#/lesson/${l.id}`, class: isDone(l.id) ? 'done' : '' },
            h('span', { class: 'lesson-check' }, isDone(l.id) ? icon('check', 14) : `${mi + 1}.${li + 1}`),
            h('span', { class: 'lesson-title' }, l.title, h('small', {}, l.summary)),
            h('span', { class: 'lesson-min' }, `${l.minutes} min`))))));
    }));

  const how = h('section', { class: 'how' }, h('h2', {}, 'How to use it'),
    h('ul', {},
      h('li', {}, h('b', {}, 'Guitar in your lap. '), 'Every lesson ends with things to play. The app shows and plays the idea; your hands have to learn it.'),
      h('li', {}, h('b', {}, 'Tap everything. '), 'Chord diagrams, fretboards and grids all make sound. Press play, change the key, change the strum.'),
      h('li', {}, h('b', {}, 'Write as you go. '), 'Any example has an “Open in Studio” button. Change one thing and it is yours.'),
      h('li', {}, h('b', {}, 'No sound on a phone? '), 'Tap a play button once (browsers wait for a tap), and check the ring/silent switch.')));

  return h('div', { class: 'page home' }, hero, tools, outline, how);
}

function toolCard(href, iconName, title, text) {
  return h('a', { class: 'tool-card', href }, h('span', { class: 'tool-icon' }, icon(iconName, 22)), h('h3', {}, title), h('p', {}, text));
}
