// Entry point: starts the app, decides which screen is showing.

import { h, mount, icon } from './dom.js';
import { store } from './store.js';
import { prefs, applyTheme } from './prefs.js';
import { audio } from './audio.js';
import { mic } from './mic.js';
import { UNITS, lessonById } from './curriculum.js';
import { generateLesson, generatePlacement, generateReview, generateRhythmSet } from './generate.js';
import { completeLesson, completePractice, skipToUnit, isUnlocked, todayXp, streakNow, practisedToday } from './progress.js';
import { runLesson, showResults, showFailed, session } from './lesson.js';
import { homeView, profileView, settingsView } from './views.js';
import { practiceView, sprintView, rhythmView, songsView, songView, tunerView } from './practice.js';
import { toast, mascot } from './ui.js';
import { clamp, dayKey } from './util.js';

const app = document.getElementById('app');
const TABS = [['/', 'Learn', 'house'], ['/practice', 'Practice', 'barbell'], ['/me', 'Me', 'user'], ['/settings', 'Settings', 'gear']];
let current = null; // the screen on show, if it needs cleaning up
let visit = 0;      // bumps on every navigation, so slow async work can tell it is stale
let shellTab = null;

const path = () => window.location.hash.replace(/^#/, '') || '/';

const nav = {
  /** go to a screen; path like '/', '/lesson/u1-1', '/practice' */
  go(to) {
    if (path() === to) route(); else window.location.hash = `#${to}`;
  },
  /** draw the current screen again */
  refresh() { route(); },
  ensureMic,
  runPractice,
  finishSprint,
  startRhythm(lesson) {
    runPractice({ exercises: generateRhythmSet(lesson), xp: 8, heading: 'Rhythm workout done!', back: '/rhythm', listen: false });
  },
};

/** start listening if this device is set to "play my guitar"; true when the microphone is live */
async function ensureMic() {
  if (prefs.get('input') !== 'mic') { mic.stop(); return false; }
  if (mic.on) return true;
  try {
    audio.unlock();
    await mic.start();
    return true;
  } catch {
    toast('The microphone is not available here — using the on-screen fretboard instead.', { icon: 'microphone-slash', ms: 4200 });
    return false;
  }
}

function leave() {
  visit++;
  if (session.active && session.active.close) session.active.close();
  if (current && current.destroy) current.destroy();
  current = null;
  shellTab = null;
  audio.stopAll();
  for (const el of document.querySelectorAll('.modal-wrap')) el.remove();
}

/** a screen inside the frame with the top bar and the tabs */
function shell(view, tab) {
  const el = view && view.el ? view.el : view;
  current = view && view.el ? view : null;
  shellTab = tab;
  const state = store.state;
  const today = dayKey();
  mount(app, h('div', { class: 'shell' },
    h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#/', 'aria-label': 'Fretwise — home' }, mascot('happy', 'mascot-logo'), h('span', null, 'Fretwise')),
      h('div', { class: 'topbar-stats' },
        // hosted as one of the apps of the site: a way back to its main menu
        store.standalone ? h('a', { class: 'chip back-home', href: '../', title: 'Main menu', 'aria-label': 'Back to the main menu' }, icon('arrow-left')) : null,
        store.online ? null : h('span', { class: 'chip chip-warn', title: 'The server cannot be reached; progress is kept on this device for now' }, icon('wifi-high'), 'Offline'),
        h('span', { class: practisedToday(state, today) ? 'chip chip-on' : 'chip', title: 'Day streak' }, icon('fire'), String(streakNow(state, today))),
        h('span', { class: 'chip', title: 'XP earned today' }, icon('lightning'), `${todayXp(state, today)}/${state.settings.goal}`))),
    h('main', { class: 'page' }, el),
    h('nav', { class: 'tabbar', 'aria-label': 'Main' }, TABS.map(([to, label, ic]) =>
      h('a', { class: to === tab ? 'tab is-on' : 'tab', href: `#${to}`, 'aria-current': to === tab ? 'page' : null }, icon(ic), h('span', null, label))))));
  window.scrollTo(0, 0);
}

async function startLesson(lesson) {
  const mine = visit;
  if (lesson.kind === 'rhythm') mic.stop(); else await ensureMic(); // tapping lessons never need the microphone
  if (mine !== visit) return;
  runLesson(app, {
    exercises: generateLesson(lesson, { state: store.state }),
    onComplete(summary) {
      let outcome;
      store.update((st) => { outcome = completeLesson(st, lesson, summary); });
      store.flush();
      showResults(app, {
        heading: lesson.kind === 'song' ? `You played ${lesson.song.title}!` : summary.mistakes === 0 ? 'Flawless!' : 'Lesson complete!',
        sub: lesson.kind === 'checkpoint' ? 'Checkpoint passed.' : outcome.first ? null : 'Every repeat makes it stick a little better.',
        outcome, summary, onContinue: () => nav.go('/'),
      });
    },
    onExit() { nav.go('/'); },
  });
}

/** the test for jumping ahead to a unit */
function startJump(unit) {
  const LIMIT = 3;
  runLesson(app, {
    exercises: generatePlacement(unit),
    onComplete(summary) {
      if (summary.mistakes > LIMIT) {
        showFailed(app, {
          heading: 'Not this time',
          text: `That was ${summary.mistakes} mistakes; the limit is ${LIMIT}. The lessons before “${unit.title}” will get you there quickly.`,
          onRetry: () => startJump(unit), onExit: () => nav.go('/'),
        });
        return;
      }
      let outcome;
      store.update((st) => { skipToUnit(st, unit); outcome = completePractice(st, { xp: 20, seconds: summary.seconds, mic: summary.mic }); });
      store.flush();
      showResults(app, { heading: `${unit.title} unlocked!`, sub: 'Everything before it now counts as known.', outcome, summary, onContinue: () => nav.go('/') });
    },
    onExit() { nav.go('/'); },
  });
}

/** a practice round outside the course: a fixed XP reward */
async function runPractice({ exercises, xp, heading, sub = null, back = '/practice', listen = true }) {
  leave();
  const mine = visit;
  if (listen) await ensureMic(); else mic.stop();
  if (mine !== visit) return;
  runLesson(app, {
    exercises,
    onComplete(summary) {
      let outcome;
      store.update((st) => { outcome = completePractice(st, { xp, seconds: summary.seconds, mic: summary.mic }); });
      store.flush();
      showResults(app, { heading, sub, outcome, summary, onContinue: () => nav.go(back) });
    },
    onExit() { nav.go(back); },
  });
}

function finishSprint({ score, wrong, mic: usedMic }) {
  if (score === 0) {
    toast('No notes this time — have another go!', { icon: 'timer' });
    nav.go('/sprint');
    return;
  }
  leave();
  const before = store.state.stats.sprintBest;
  let outcome;
  store.update((st) => { outcome = completePractice(st, { xp: clamp(Math.round(score / 2), 2, 15), seconds: 60, sprintScore: score, mic: usedMic }); });
  store.flush();
  showResults(app, {
    heading: `${score} ${score === 1 ? 'note' : 'notes'} in a minute!`,
    sub: outcome.record ? null : `Your best so far is ${before}.`,
    outcome, summary: { mistakes: wrong, total: score + wrong, seconds: 60, bestCombo: 0 }, onContinue: () => nav.go('/practice'),
  });
}

function route() {
  leave();
  const [page, arg] = path().split('/').filter(Boolean);
  if (page !== 'lesson' && page !== 'jump' && page !== 'review' && page !== 'sprint' && page !== 'tuner' && page !== 'song') mic.stop();
  switch (page) {
    case undefined: shell(homeView(nav), '/'); break;
    case 'practice': shell(practiceView(nav), '/practice'); break;
    case 'me': shell(profileView(nav), '/me'); break;
    case 'settings': shell(settingsView(nav), '/settings'); break;
    case 'sprint': shell(sprintView(nav), '/practice'); break;
    case 'rhythm': shell(rhythmView(nav), '/practice'); break;
    case 'songs': shell(songsView(nav), '/practice'); break;
    case 'song': shell(songView(nav, arg), '/practice'); break;
    case 'tuner': shell(tunerView(nav), '/practice'); break;
    case 'lesson': {
      const lesson = lessonById(arg);
      if (lesson && isUnlocked(store.state, lesson)) startLesson(lesson); else nav.go('/');
      break;
    }
    case 'jump': {
      const unit = UNITS.find((u) => u.id === arg);
      if (unit && unit.index > 0 && !isUnlocked(store.state, unit.lessons[0])) startJump(unit); else nav.go('/');
      break;
    }
    case 'review': {
      const exercises = generateReview(store.state);
      if (exercises) runPractice({ exercises, xp: 10, heading: 'Review complete!', sub: 'Those notes will stick a little longer now.' }); else nav.go('/practice');
      break;
    }
    default: nav.go('/');
  }
}

/** fetch progress made on another device, then redraw if a plain screen is showing */
async function sync() {
  if (!store.state || session.active) return;
  const tab = shellTab;
  if (await store.refresh() && tab && shellTab === tab && !session.active && !document.querySelector('.modal-wrap')) route();
}

async function init() {
  applyTheme();
  audio.setEnabled(prefs.get('sound'));
  // Browsers only start audio from inside a tap or key press, and they disagree about
  // which event counts — so keep trying on each of them until the engine is awake.
  const wake = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
  const unlock = () => {
    audio.unlock();
    if (audio.running) for (const type of wake) window.removeEventListener(type, unlock, true);
  };
  for (const type of wake) window.addEventListener(type, unlock, true);
  window.addEventListener('hashchange', route);
  window.addEventListener('focus', sync);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
  window.addEventListener('error', (ev) => { console.error(ev.error || ev.message); });

  // arriving from the http address with "?p=<id>": keep the same progress on the secure address
  const handed = new URLSearchParams(window.location.search).get('p');
  if (handed && /^[a-z0-9][a-z0-9-]{0,47}$/.test(handed)) {
    prefs.set('profile', handed);
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }
  store.loadInfo();
  await store.start();
  route();
}

init();
