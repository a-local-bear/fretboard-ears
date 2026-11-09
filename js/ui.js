// App state, screens and input handling. Full re-render via innerHTML, skipped when nothing changed.

import {
  CHAPTERS, LEVELS_PER_CHAPTER, ROUNDS, SOLFEGE, LETTERS, DEGREE_COLORS, CHORDS,
  midiOf, levelDegrees, chapterById,
} from './data.js';
import { buildDeck } from './deck.js';
import {
  isPassed, isUnlocked, chapterUnlocked, bestScore, levelPassed, recordScore, nextLevel, passedCount,
} from './progress.js';
import { loadSettings, saveSettings, loadProgress, saveProgress, appendLog, requestPersistence } from './storage.js';
import { ensureAudio, prerender, playNote, playReference, playArpeggio, stopAll, now } from './audio.js';
import { fretboardSVG } from './fretboard.js';

const CORRECT_DELAY = 1100;
const WRONG_DELAY = 2300;
const VERTICAL_BELOW = 640;

const S = {
  screen: 'home', // home | levels | explore | play | results | settings
  chapterId: 'one',
  level: 0,
  deck: [],
  round: 0,
  answers: [], // { heard, answered }
  phase: 'listen', // listen | feedback
  states: {}, // degree → dot state for the current round
  noteAt: 0, // context time of the current mystery note
  result: null, // { score, newBest, passed }
  confirmReset: false,
  settings: loadSettings(),
  progress: loadProgress(),
  vertical: window.innerWidth < VERTICAL_BELOW,
};

let app;
let lastHTML = '';
let timer = null;
let resetTimer = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const chapter = () => chapterById(S.chapterId);
const degrees = () => levelDegrees(S.level);
const noteName = (d) => (S.settings.labels === 'letters' ? LETTERS[d] : SOLFEGE[d]);
const clearTimer = () => { clearTimeout(timer); timer = null; };

// ---------- rendering ----------

function render() {
  const html = SCREENS[S.screen]();
  if (html === lastHTML) return;
  lastHTML = html;
  const focusKey = document.activeElement?.dataset?.focusKey;
  app.innerHTML = html;
  if (focusKey) app.querySelector(`[data-focus-key="${focusKey}"]`)?.focus();
}

const btn = (action, label, cls = '', extra = '') =>
  `<button class="btn ${cls}" data-action="${action}" data-focus-key="${action}${extra ? '-' + esc(extra) : ''}" ${extra ? `data-arg="${esc(extra)}"` : ''}>${label}</button>`;

const topbar = (title, back) => `
  <header class="topbar">
    ${back ? `<button class="iconbtn" data-action="${back}" data-focus-key="back" aria-label="Back">←</button>` : '<span class="brandmark" aria-hidden="true"></span>'}
    <h1>${title}</h1>
    ${S.screen === 'home' ? `<button class="iconbtn" data-action="settings" data-focus-key="settings" aria-label="Settings">⚙</button>` : '<span class="iconbtn-spacer"></span>'}
  </header>`;

const board = (opts = {}) => fretboardSVG({
  notes: chapter().notes, degrees: degrees(), labels: S.settings.labels, vertical: S.vertical, ...opts,
});

const refLabel = () => (S.settings.ref === 'do' ? 'Hear Do' : 'Hear key');

const SCREENS = {
  home() {
    const total = CHAPTERS.length * LEVELS_PER_CHAPTER;
    return `${topbar('Fretboard Ears')}
    <main class="screen home">
      <p class="lede">Hear a note in C major, then find it on the neck.</p>
      <p class="tally"><b>${passedCount(S.progress)}</b> of ${total} levels passed</p>
      <ol class="chapters">
        ${CHAPTERS.map((c, i) => {
          const open = chapterUnlocked(S.progress, c.id);
          let passed = 0;
          for (let l = 0; l < LEVELS_PER_CHAPTER; l++) if (levelPassed(S.progress, c.id, l)) passed++;
          return `<li><button class="chapter ${open ? '' : 'locked'}" data-action="chapter" data-arg="${c.id}" data-focus-key="chapter-${c.id}" ${open ? '' : 'disabled'}>
            <span class="cnum">${i + 1}</span>
            <span class="cbody"><span class="cname">${esc(c.name)}</span><span class="cdesc">${esc(c.desc)}</span></span>
            <span class="cmeta">${open ? `${passed}/${LEVELS_PER_CHAPTER}` : 'Locked'}</span>
          </button></li>`;
        }).join('')}
      </ol>
    </main>`;
  },

  levels() {
    const c = chapter();
    return `${topbar(esc(c.name), 'home')}
    <main class="screen levels">
      <p class="lede">${esc(c.desc)}</p>
      <ol class="levelgrid">
        ${Array.from({ length: LEVELS_PER_CHAPTER }, (_, l) => {
          const open = isUnlocked(S.progress, c.id, l);
          const best = bestScore(S.progress, c.id, l);
          const ds = levelDegrees(l);
          return `<li><button class="levelcard ${open ? '' : 'locked'} ${best != null && isPassed(best) ? 'passed' : ''}" data-action="level" data-arg="${l}" data-focus-key="level-${l}" ${open ? '' : 'disabled'}>
            <span class="lnum">Level ${l + 1}</span>
            <span class="lnotes">${ds.map((d) => `<i style="--c:${DEGREE_COLORS[d]}"></i>`).join('')}</span>
            <span class="lnames">${esc(noteName(0))} → ${esc(noteName(ds[ds.length - 1]))}</span>
            <span class="lbest">${open ? (best == null ? 'Not played' : `Best ${best}/${ROUNDS}`) : 'Locked'}</span>
          </button></li>`;
        }).join('')}
      </ol>
    </main>`;
  },

  explore() {
    const ds = degrees();
    const newest = ds[ds.length - 1];
    return `${topbar(`Level ${S.level + 1}`, 'levels')}
    <main class="screen explore">
      <p class="lede">New note: <b>${esc(SOLFEGE[newest])}</b>${S.settings.labels === 'letters' ? ` (${LETTERS[newest]})` : ''}. Tap the dots to hear each one, then start.</p>
      <div class="boardwrap">${board({ states: S.states })}</div>
      <div class="actions">
        ${btn('reference', refLabel(), 'ghost')}
        ${btn('start', 'Start', 'primary')}
      </div>
    </main>`;
  },

  play() {
    const score = S.answers.filter((a) => a.heard === a.answered).length;
    const pips = Array.from({ length: ROUNDS }, (_, i) => {
      const a = S.answers[i];
      const cls = a ? (a.heard === a.answered ? 'ok' : 'bad') : i === S.round ? 'now' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
    return `${topbar(`${esc(chapter().name)} · Level ${S.level + 1}`, 'levels')}
    <main class="screen play">
      <div class="roundbar" aria-label="Round ${Math.min(S.round + 1, ROUNDS)} of ${ROUNDS}, ${score} correct">
        <span class="pips">${pips}</span>
        <span class="count">${Math.min(S.round + 1, ROUNDS)}/${ROUNDS}</span>
      </div>
      <p class="prompt">${S.phase === 'feedback' ? feedbackText() : 'Which note was that?'}</p>
      <div class="boardwrap">${board({ states: S.states, disabled: S.phase === 'feedback' })}</div>
      <div class="actions">
        ${btn('reference', refLabel(), 'ghost')}
        ${btn('replay', 'Replay', 'primary')}
      </div>
    </main>`;
  },

  results() {
    const { score, newBest, passed } = S.result;
    const counts = new Map();
    for (const a of S.answers) {
      if (a.heard === a.answered) continue;
      const k = `${a.heard}>${a.answered}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const confusions = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
      const [h, ans] = k.split('>').map(Number);
      return `<li>Heard <b>${esc(noteName(h))}</b>, answered <b>${esc(noteName(ans))}</b>${n > 1 ? ` ×${n}` : ''}</li>`;
    }).join('');
    const nxt = nextLevel(S.chapterId, S.level);
    const canNext = passed && nxt && isUnlocked(S.progress, nxt.chapterId, nxt.level);
    return `${topbar(`Level ${S.level + 1}`, 'levels')}
    <main class="screen results">
      <div class="scorecard ${passed ? 'pass' : 'fail'}">
        <p class="big"><b>${score}</b>/${ROUNDS}</p>
        <p class="verdict">${passed ? (score === ROUNDS ? 'Perfect.' : 'Passed.') : `Not yet. You need 8 to pass.`}</p>
        ${newBest ? '<p class="newbest">New best</p>' : ''}
      </div>
      ${confusions ? `<h2 class="sub">Mix-ups</h2><ul class="confusions">${confusions}</ul>` : ''}
      <div class="actions">
        ${btn('levels', 'Levels', 'ghost')}
        ${btn('retry', 'Retry', canNext ? 'ghost' : 'primary')}
        ${canNext ? btn('next', 'Next level', 'primary') : ''}
      </div>
    </main>`;
  },

  settings() {
    const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, label]) =>
      `<button role="radio" aria-checked="${S.settings[key] === v}" class="${S.settings[key] === v ? 'on' : ''}" data-action="set" data-arg="${key}:${v}" data-focus-key="set-${key}-${v}">${label}</button>`).join('')}</div>`;
    return `${topbar('Settings', 'home')}
    <main class="screen settings">
      <section><h2 class="sub">Dot labels</h2>${seg('labels', [['solfege', 'Solfège'], ['letters', 'Letters'], ['hidden', 'Hidden']])}
        <p class="hint">Hidden shows plain dots, so you answer by position only.</p></section>
      <section><h2 class="sub">Before each note</h2>${seg('ref', [['cadence', 'Cadence'], ['do', 'Do'], ['none', 'Nothing']])}
        <p class="hint">Cadence strums C–F–G–C. Do plays the root. Nothing is the hardest.</p></section>
      <section><h2 class="sub">Levels</h2>
        <button class="toggle" role="switch" aria-checked="${S.progress.unlockAll}" data-action="unlockAll" data-focus-key="unlockAll">
          <span class="knob"></span><span>Unlock all levels</span></button></section>
      <section><h2 class="sub">Progress</h2>
        ${btn('reset', S.confirmReset ? 'Tap again to erase all scores' : 'Reset progress', S.confirmReset ? 'danger' : 'ghost')}</section>
    </main>`;
  },
};

function feedbackText() {
  const a = S.answers[S.answers.length - 1];
  if (!a) return '';
  return a.heard === a.answered
    ? `Yes, ${esc(noteName(a.heard))}.`
    : `That was ${esc(noteName(a.heard))}.`;
}

// ---------- flow ----------

function go(screen) {
  clearTimer();
  stopAll();
  if (screen !== 'settings') S.confirmReset = false;
  S.screen = screen;
  S.states = {};
  render();
  window.scrollTo(0, 0);
}

function levelMidis() {
  return degrees().map((d) => midiOf(chapter().notes[d]));
}

function openLevel(level) {
  S.level = level;
  go('explore');
  if (ensureAudio()) prerender([...levelMidis(), ...CHORDS.C, ...CHORDS.F, ...CHORDS.G]);
}

function startLevel() {
  S.deck = buildDeck(degrees(), ROUNDS);
  S.round = 0;
  S.answers = [];
  S.screen = 'play';
  startRound();
}

function startRound() {
  clearTimer();
  stopAll();
  S.phase = 'listen';
  S.states = {};
  render();
  if (!ensureAudio()) return;
  const doMidi = midiOf(chapter().notes[0]);
  S.noteAt = playReference(S.settings.ref, doMidi);
  playNote(midiOf(chapter().notes[S.deck[S.round]]), S.noteAt);
}

function replay() {
  if (!ensureAudio()) return;
  stopAll();
  const d = S.phase === 'feedback' ? S.answers[S.answers.length - 1].heard : S.deck[S.round];
  playNote(midiOf(chapter().notes[d]), now() + 0.03);
}

function answer(d) {
  if (S.phase !== 'listen') return;
  const heard = S.deck[S.round];
  const ok = d === heard;
  S.answers.push({ heard, answered: d });
  S.phase = 'feedback';
  S.states = ok ? { [d]: 'correct' } : { [d]: 'wrong', [heard]: 'reveal' };
  appendLog([{ t: Date.now(), ch: S.chapterId, lvl: S.level, heard, answered: d, ref: S.settings.ref, labels: S.settings.labels }]);
  stopAll();
  playNote(midiOf(chapter().notes[heard]), now() + 0.03);
  render();
  timer = setTimeout(advance, ok ? CORRECT_DELAY : WRONG_DELAY);
}

function advance() {
  clearTimer();
  S.round++;
  if (S.round < ROUNDS) return startRound();
  const score = S.answers.filter((a) => a.heard === a.answered).length;
  const { progress, newBest } = recordScore(S.progress, S.chapterId, S.level, score);
  S.progress = progress;
  saveProgress(progress);
  S.result = { score, newBest, passed: isPassed(score) };
  S.screen = 'results';
  S.states = {};
  stopAll();
  render();
  if (S.result.passed) {
    const n = chapter().notes;
    playArpeggio([n[0], n[2], n[4], n[7]].map(midiOf));
  }
}

function playReferenceOnly() {
  if (!ensureAudio()) return;
  stopAll();
  playReference(S.settings.ref === 'do' ? 'do' : 'cadence', midiOf(chapter().notes[0]));
}

function tapDot(d) {
  if (S.screen === 'explore') {
    if (!ensureAudio()) return;
    stopAll();
    playNote(midiOf(chapter().notes[d]), now() + 0.02);
    S.states = { [d]: 'playing' };
    render();
    clearTimer();
    timer = setTimeout(() => { S.states = {}; render(); }, 600);
  } else if (S.screen === 'play') {
    answer(d);
  }
}

// ---------- input ----------

const ACTIONS = {
  home: () => go('home'),
  settings: () => go('settings'),
  levels: () => go('levels'),
  chapter: (arg) => { S.chapterId = arg; go('levels'); },
  level: (arg) => openLevel(Number(arg)),
  start: () => startLevel(),
  reference: () => playReferenceOnly(),
  replay: () => replay(),
  tap: (_, el) => tapDot(Number(el.dataset.degree)),
  retry: () => openLevel(S.level),
  next: () => {
    const n = nextLevel(S.chapterId, S.level);
    if (n) { S.chapterId = n.chapterId; openLevel(n.level); }
  },
  set: (arg) => {
    const [key, value] = arg.split(':');
    S.settings = { ...S.settings, [key]: value };
    saveSettings(S.settings);
    render();
  },
  unlockAll: () => {
    S.progress = { ...S.progress, unlockAll: !S.progress.unlockAll };
    saveProgress(S.progress);
    render();
  },
  reset: () => {
    clearTimeout(resetTimer);
    if (!S.confirmReset) {
      S.confirmReset = true;
      resetTimer = setTimeout(() => { S.confirmReset = false; render(); }, 3000);
    } else {
      S.confirmReset = false;
      S.progress = { best: {}, unlockAll: S.progress.unlockAll };
      saveProgress(S.progress);
    }
    render();
  },
};

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el || !app.contains(el) || el.disabled) return;
  ensureAudio();
  requestPersistence();
  ACTIONS[el.dataset.action]?.(el.dataset.arg, el);
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 8 && (S.screen === 'play' || S.screen === 'explore')) {
    if (degrees().includes(n - 1)) { ensureAudio(); tapDot(n - 1); e.preventDefault(); }
    return;
  }
  if (e.key === ' ' || e.key === 'Enter') {
    // A focused button handles Enter/Space itself.
    if (document.activeElement?.closest?.('button, [role="button"]')) return;
    ensureAudio();
    if (S.screen === 'explore') startLevel();
    else if (S.screen === 'play') (S.phase === 'feedback' ? advance() : replay());
    else if (S.screen === 'results') {
      const nxt = nextLevel(S.chapterId, S.level);
      if (S.result.passed && nxt && isUnlocked(S.progress, nxt.chapterId, nxt.level)) ACTIONS.next();
      else ACTIONS.retry();
    } else return;
    e.preventDefault();
  }
}

function onResize() {
  const v = window.innerWidth < VERTICAL_BELOW;
  if (v !== S.vertical) { S.vertical = v; render(); }
}

export function mount(root) {
  app = root;
  app.addEventListener('click', onClick);
  app.addEventListener('keydown', (e) => {
    const dot = e.target.closest?.('.dot');
    if (dot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); onClick({ target: dot }); }
  });
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  render();
}
