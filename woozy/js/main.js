// App shell: top bar, course sidebar, hash router, sound + theme settings.

import { auditionChord, setAudioPrefs, unlock } from './audio/audio.js';
import { player } from './audio/engine.js';
import { MODULES, getLesson } from './content/curriculum.js';
import { h, icon } from './dom.js';
import { initStore, isDone, setPref, store, subscribe } from './store.js';
import { homeView } from './views/home.js';
import { lessonView } from './views/lesson.js';
import { studioEditorView, studioListView } from './views/studio.js';
import { chordLibraryView, cookbookView, scalesView } from './views/tools.js';

const NAV = [
  ['', 'Course'],
  ['studio', 'Studio'],
  ['cookbook', 'Cookbook'],
  ['chords', 'Chords'],
  ['scales', 'Scales'],
];

const view = h('main', { id: 'view' });
const toast = h('div', { class: 'toast', role: 'status', hidden: true });
let toastTimer;
let shownSongRev; // revision of the song open in the Studio, to notice outside changes

function notify(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 9000);
}
const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Course outline' });
const topnav = h('nav', { class: 'topnav', 'aria-label': 'Main' }, NAV.map(([route, label]) => h('a', { href: `#/${route}`, data: { route } }, label)));
const syncDot = h('span', { class: 'sync-dot' });
const themeBtn = h('button', { class: 'icon-btn', type: 'button', onClick: cycleTheme });
const soundPanel = h('div', { class: 'popover sound-panel', hidden: true });
const soundBtn = h('button', {
  class: 'icon-btn', type: 'button', title: 'Sound settings', 'aria-label': 'Sound settings',
  onClick: (e) => {
    e.stopPropagation();
    soundPanel.hidden = !soundPanel.hidden;
  },
}, icon('sound', 20));
const menuBtn = h('button', {
  class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Course outline',
  onClick: () => document.body.classList.toggle('drawer-open'),
}, icon('menu', 22));

function currentRoute() {
  const [name = '', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { name, arg };
}

// ---------------------------------------------------------------- sidebar ----

function drawSidebar() {
  const { name, arg } = currentRoute();
  sidebar.replaceChildren(
    h('nav', { class: 'side-nav' }, NAV.slice(1).map(([route, label]) => h('a', { href: `#/${route}`, class: route === name ? 'active' : '' }, label))),
    h('a', { class: `side-home${name === '' ? ' active' : ''}`, href: '#/' }, 'Course overview'),
    ...MODULES.map((m, mi) => h('div', { class: 'side-module' },
      h('h4', {}, h('span', {}, String(mi + 1)), m.title),
      h('ol', { class: 'side-lessons' }, m.lessons.map((l) => h('li', {}, h('a', {
        href: `#/lesson/${l.id}`,
        class: `${name === 'lesson' && arg === l.id ? 'active' : ''}${isDone(l.id) ? ' done' : ''}`,
      }, h('span', { class: 'side-check' }, isDone(l.id) ? icon('check', 12) : ''), l.title)))))),
  );
}

// ----------------------------------------------------------------- router ----

function render() {
  player.stop();
  const { name, arg } = currentRoute();
  let el;
  let title = '';
  let wide = false;
  try {
    switch (name) {
      case 'lesson':
        el = lessonView(arg);
        title = getLesson(arg)?.title || '';
        break;
      case 'studio':
        el = arg ? studioEditorView(arg) : studioListView();
        title = arg ? store.songs[arg]?.title || 'Studio' : 'Studio';
        shownSongRev = arg ? store.songs[arg]?.rev : undefined;
        wide = true;
        break;
      case 'cookbook':
        el = cookbookView();
        title = 'Progression cookbook';
        wide = true;
        break;
      case 'chords':
        el = chordLibraryView();
        title = 'Chord library';
        wide = true;
        break;
      case 'scales':
        el = scalesView();
        title = 'Scales & keys';
        wide = true;
        break;
      default:
        el = homeView();
    }
  } catch (err) {
    console.error(err);
    el = h('div', { class: 'page' }, h('h1', {}, 'Something broke'), h('p', {}, String(err.message || err)), h('p', {}, h('a', { href: '#/' }, 'Back to the course')));
  }
  view.replaceChildren(el);
  document.body.classList.toggle('wide', wide);
  document.body.classList.remove('drawer-open');
  document.title = title ? `${title} · Woozy` : 'Woozy — bedroom-pop guitar songwriting';
  for (const a of topnav.children) {
    const route = a.dataset.route;
    a.classList.toggle('active', route === name || (route === '' && name === 'lesson'));
  }
  drawSidebar();
  window.scrollTo(0, 0);
}

// --------------------------------------------------------- theme & sound ----

function applyTheme() {
  const { theme } = store.prefs;
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const label = { auto: 'Theme: follows your device', light: 'Theme: light', dark: 'Theme: dark' }[theme];
  themeBtn.title = label;
  themeBtn.setAttribute('aria-label', label);
  themeBtn.replaceChildren(icon(theme === 'dark' ? 'moon' : 'sun', 20), theme === 'auto' ? h('span', { class: 'auto-badge' }, 'A') : null);
}

function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  setPref('theme', order[(order.indexOf(store.prefs.theme) + 1) % order.length]);
  applyTheme();
}

function buildSoundPanel() {
  const slider = (name, label, hint) => h('label', { class: 'sound-row' },
    h('span', {}, label, h('small', {}, hint)),
    h('input', {
      type: 'range', class: 'range', min: 0, max: 1, step: 0.01, value: store.prefs[name],
      onInput: (e) => {
        const value = Number(e.target.value);
        setPref(name, value);
        setAudioPrefs({ [name]: value });
      },
    }));
  soundPanel.replaceChildren(
    h('h4', {}, 'Guitar sound'),
    slider('volume', 'Volume', ''),
    slider('wobble', 'Wobble', 'chorus / vibrato'),
    slider('reverb', 'Reverb', 'room'),
    slider('tone', 'Tone', 'dark ↔ bright'),
    h('button', {
      class: 'btn btn-sm', type: 'button',
      onClick: () => auditionChord([null, 45, 52, 56, 61, 64], { slow: true }), // Amaj7, x02120
    }, icon('play', 14), 'Test chord'),
    h('p', { class: 'hint' }, 'No sound on a phone? Check the ring/silent switch, then tap any play button.'),
  );
  soundPanel.addEventListener('click', (e) => e.stopPropagation());
}

function paintSync() {
  syncDot.hidden = store.standalone; // browser storage only: nothing to report
  syncDot.classList.toggle('offline', !store.online);
  syncDot.title = store.online ? 'Saved to the server — shared with your other devices' : 'Server unreachable — saving in this browser for now';
}

// ------------------------------------------------------------------- boot ----

// Hosted as one of the apps inside Fretboard Ears (in its woozy/ folder).
const inFretboardEars = /\/woozy\/(index\.html)?$/.test(location.pathname);

async function boot() {
  await initStore();
  setAudioPrefs({ volume: store.prefs.volume, wobble: store.prefs.wobble, reverb: store.prefs.reverb, tone: store.prefs.tone });

  const app = document.getElementById('app');
  app.replaceChildren(
    h('header', { class: 'topbar' },
      menuBtn,
      inFretboardEars && h('a', { class: 'icon-btn back-home', href: '../', title: 'Fretboard Ears main menu', 'aria-label': 'Back to the Fretboard Ears main menu' }, '←'),
      h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark' }, icon('wave', 20)), 'Woozy'),
      topnav,
      h('div', { class: 'topbar-right' }, syncDot, h('div', { class: 'popover-anchor' }, soundBtn, soundPanel), themeBtn)),
    h('div', { class: 'layout' }, sidebar, view),
    h('div', { class: 'scrim', onClick: () => document.body.classList.remove('drawer-open') }),
    toast,
  );

  applyTheme();
  buildSoundPanel();
  paintSync();
  render();

  window.addEventListener('hashchange', render);
  document.addEventListener('click', () => {
    soundPanel.hidden = true;
  });
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      player.stop();
      soundPanel.hidden = true;
      document.body.classList.remove('drawer-open');
    }
  });
  subscribe((what, detail) => {
    if (what === 'online') paintSync();
    if (what === 'progress') drawSidebar();
    if (what === 'conflict') notify(`“${detail.title}” was changed on another device, so that version is shown. Your edits here were kept as “${detail.copy}”.`);
    if (what === 'songs') render(); // a song was deleted or replaced
    if (what === 'sync') {
      // Another device changed something. Redraw only what it affects, so a
      // lesson or quiz in progress is never reset under the reader.
      const { name, arg } = currentRoute();
      if (name === 'lesson') drawSidebar();
      else if (name === 'studio' && arg) {
        if (store.songs[arg]?.rev !== shownSongRev) render();
      } else if (name === '' || name === 'studio') render();
    }
  });
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('app').textContent = `Woozy could not start: ${err.message}`;
});
