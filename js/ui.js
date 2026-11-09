// App state, screens and input handling. Full re-render via innerHTML, skipped when nothing changed.

import {
  CHAPTERS, LEVELS_PER_CHAPTER, ROUNDS, SOLFEGE, LETTERS, DEGREE_COLORS, CHORDS,
  midiOf, levelDegrees, chapterById,
} from './data.js';
import { buildDeck } from './deck.js';
import {
  isPassed, bestScore, recordScore, nextLevel, playedCount,
} from './progress.js';
import {
  loadSettings, saveSettings, loadProgress, saveProgress, appendLog, requestPersistence, loadStats, loadLog,
} from './storage.js';
import {
  streaks, heatmap, totals, degreeAccuracy, topConfusions, triesAfterMiss, avgResponseMs, trend,
} from './stats.js';
import {
  ensureAudio, prerender, playNote, playReference, playArpeggio, stopAll, now, setSound, setNoteLimit, quietAt,
} from './audio.js';
import { fretboardSVG } from './fretboard.js';
import { startMic, stopMic, micActive, micSupported } from './mic.js';
import { matchDegree, SHARP_NAMES } from './pitch.js';

const CORRECT_DELAY = 1100;
const MIC_NOTE_LIMIT = 1.6; // seconds the app's notes may ring while the mic listens
const VERTICAL_BELOW = 640;

const S = {
  screen: 'home', // home | levels | explore | play | results | settings | stats
  chapterId: 'one',
  level: 0,
  deck: [],
  round: 0,
  answers: [], // { heard, answered }
  phase: 'listen', // listen → (retry after a miss) → feedback once the right note is found
  tries: 0, // taps in the current round
  states: {}, // degree → dot state for the current round
  noteAt: 0, // context time of the current mystery note
  noteMs: null, // ms from the mystery note sounding to the first tap (null if unknown)
  stats: null, // snapshot for the stats screen, taken when it opens
  result: null, // { score, newBest, passed }
  confirmReset: false,
  mic: 'off', // off | starting | on | blocked (runtime state; the wish to use it is settings.mic)
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
  syncMic();
  const html = SCREENS[S.screen]();
  if (html === lastHTML) return;
  lastHTML = html;
  lastHearing = ''; // the hearing label was re-created empty
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

const MIC_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

function micBar() {
  if (!micSupported()) return '';
  const on = S.settings.mic;
  const label = !on ? 'Mic off' : S.mic === 'on' ? 'Listening' : S.mic === 'blocked' ? 'Mic blocked' : 'Starting mic…';
  return `<div class="micbar">
      <button class="micbtn ${on && S.mic === 'on' ? 'on' : ''}" data-action="mic" data-focus-key="mic" aria-pressed="${on}">${MIC_ICON}<span>${label}</span></button>
      <span class="hearing" id="hearing"></span>
    </div>
    ${on && S.mic === 'blocked' ? '<p class="micnote">The microphone is blocked. Allow it for this site in your browser settings, then turn the mic off and on again.</p>' : ''}`;
}

const refLabel = () => (S.settings.ref === 'do' ? 'Hear Do' : 'Hear key');

const SCREENS = {
  home() {
    return `${topbar('Fretboard Ears')}
    <main class="screen home">
      <p class="lede">Hear a note in C major, then find it on the neck.</p>
      <ol class="chapters">
        ${CHAPTERS.map((c, i) => {
          const played = playedCount(S.progress, c.id);
          return `<li><button class="chapter" data-action="chapter" data-arg="${c.id}" data-focus-key="chapter-${c.id}">
            <span class="cnum">${i + 1}</span>
            <span class="cbody"><span class="cname">${esc(c.name)}</span><span class="cdesc">${esc(c.desc)}</span></span>
            <span class="cmeta">${played ? `${played}/${LEVELS_PER_CHAPTER} played` : ''}</span>
          </button></li>`;
        }).join('')}
      </ol>
      <div class="actions">${btn('stats', 'Practice stats', 'ghost')}</div>
    </main>`;
  },

  levels() {
    const c = chapter();
    return `${topbar(esc(c.name), 'home')}
    <main class="screen levels">
      <p class="lede">${esc(c.desc)}</p>
      <ol class="levelgrid">
        ${Array.from({ length: LEVELS_PER_CHAPTER }, (_, l) => {
          const best = bestScore(S.progress, c.id, l);
          const ds = levelDegrees(l);
          return `<li><button class="levelcard ${best != null && isPassed(best) ? 'passed' : ''}" data-action="level" data-arg="${l}" data-focus-key="level-${l}">
            <span class="lnum">Level ${l + 1}</span>
            <span class="lnotes">${ds.map((d) => `<i style="--c:${DEGREE_COLORS[d]}"></i>`).join('')}</span>
            <span class="lnames">${esc(noteName(0))} → ${esc(noteName(ds[ds.length - 1]))}</span>
            <span class="lbest">${best == null ? 'Not played' : `Best ${best}/${ROUNDS}`}</span>
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
      <p class="lede">New note: <b>${esc(SOLFEGE[newest])}</b>${S.settings.labels === 'letters' ? ` (${LETTERS[newest]})` : ''}. ${S.mic === 'on' ? 'Tap the dots to hear each one, or play them to check the mic hears you' : 'Tap the dots to hear each one'}, then start.</p>
      ${micBar()}
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
      <p class="prompt">${promptText()}</p>
      ${micBar()}
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
    const canNext = !!nxt;
    return `${topbar(`Level ${S.level + 1}`, 'levels')}
    <main class="screen results">
      <div class="scorecard ${passed ? 'pass' : 'fail'}">
        <p class="big"><b>${score}</b>/${ROUNDS}</p>
        <p class="verdict">${score === ROUNDS ? 'Perfect.' : passed ? 'Well done.' : 'Keep practising.'}</p>
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

  stats() {
    const { agg, log, now: at } = S.stats;
    const tot = totals(agg);
    const topbarHTML = topbar('Practice stats', 'home');
    if (!tot.notes) {
      return `${topbarHTML}
    <main class="screen stats">
      <div class="emptystate">
        <p class="big">No notes yet</p>
        <p class="lede">Play a level and your streak, accuracy and mix-ups will show up here.</p>
        ${btn('home', 'Pick a chapter', 'primary')}
      </div>
    </main>`;
    }
    const { current, best } = streaks(agg.days, at);
    const cols = heatmap(agg.days, at, 16);
    const cells = cols.map((col) => col.map((c) => c
      ? `<i class="hm l${c.level}" title="${c.key}: ${c.count} note${c.count === 1 ? '' : 's'}"></i>`
      : '<i class="hm none"></i>').join('')).join('');
    const pct = (x) => `${Math.round(x * 100)}%`;
    const bars = degreeAccuracy(agg).map((d) => `<li class="bar">
        <span class="bname">${esc(S.settings.labels === 'letters' ? LETTERS[d.degree] : SOLFEGE[d.degree])}</span>
        <span class="track"><i style="--c:${DEGREE_COLORS[d.degree] || '#a8998a'};width:${Math.round(d.acc * 100)}%"></i></span>
        <span class="bval">${pct(d.acc)}</span>
        <span class="bn">${d.heard}</span></li>`).join('');
    const conf = topConfusions(agg, 3).map((c) =>
      `<li>Heard <b>${esc(noteName(c.heard))}</b>, answered <b>${esc(noteName(c.answered))}</b> <span class="muted">×${c.n}</span></li>`).join('');
    const t7 = trend(log, at, 7);
    const t30 = trend(log, at, 30);
    const trendFig = (t, label) => {
      const val = t.recent.acc == null ? '–' : pct(t.recent.acc);
      let note = 'no earlier data';
      if (t.delta != null) {
        const d = Math.round(t.delta * 100);
        note = d === 0 ? 'same as before' : `${d > 0 ? '+' : ''}${d} pts vs earlier`;
      } else if (t.recent.acc == null) note = 'no notes yet';
      return fig(val, label, note);
    };
    const fig = (v, label, note = '') =>
      `<div class="fig"><b>${v}</b><span>${label}</span>${note ? `<small>${note}</small>` : ''}</div>`;
    const miss = triesAfterMiss(agg);
    const ms = avgResponseMs(agg);
    return `${topbarHTML}
    <main class="screen stats">
      <div class="hero">
        <div><b>${current}</b><span>day streak</span><small>best ${best}</small></div>
        <div><b>${tot.notes.toLocaleString()}</b><span>notes</span><small>${tot.days} day${tot.days === 1 ? '' : 's'}${tot.minutes ? `, about ${tot.minutes} min` : ''}</small></div>
      </div>
      <section><h2 class="sub">Last 16 weeks</h2>
        <div class="hmwrap"><div class="heatmap" role="img" aria-label="Practice calendar for the last 16 weeks, ${tot.days} practice days in total">${cells}</div></div>
      </section>
      <section><h2 class="sub">First-try accuracy by note</h2>
        <ul class="bars">${bars}</ul>
      </section>
      ${conf ? `<section><h2 class="sub">Top mix-ups</h2><ul class="confusions">${conf}</ul></section>` : ''}
      <section><h2 class="sub">Lately</h2>
        <div class="figs">
          ${trendFig(t7, 'last 7 days')}
          ${trendFig(t30, 'last 30 days')}
          ${fig(miss == null ? '–' : miss.toFixed(1), 'taps to recover', miss == null ? 'no misses yet' : 'after a miss')}
          ${fig(ms == null ? '–' : `${(ms / 1000).toFixed(1)}s`, 'response time', ms == null ? 'not timed yet' : 'to first tap')}
        </div>
      </section>
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
      <section><h2 class="sub">Sound</h2>${seg('sound', [['guitar', 'Electric guitar'], ['synth', 'Synth']])}
        <p class="hint">Electric guitar uses recorded notes. Synth is the original plucked-string sound.</p></section>
      <section><h2 class="sub">Progress</h2>
        ${btn('reset', S.confirmReset ? 'Tap again to erase all scores' : 'Reset progress', S.confirmReset ? 'danger' : 'ghost')}</section>
    </main>`;
  },
};

function promptText() {
  const a = S.answers[S.answers.length - 1];
  if (S.phase === 'retry') return 'Not that one. Keep looking.';
  if (S.phase !== 'feedback' || !a) return S.mic === 'on' ? 'Which note was that? Play it or tap it.' : 'Which note was that?';
  return a.heard === a.answered
    ? `Yes, ${esc(noteName(a.heard))}.`
    : `There it is: ${esc(noteName(a.heard))}.`;
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
  S.noteMs = null;
  S.noteAt = 0;
  render();
  if (!ensureAudio()) return;
  const doMidi = midiOf(chapter().notes[0]);
  S.noteAt = playReference(S.settings.ref, doMidi);
  playNote(midiOf(chapter().notes[S.deck[S.round]]), S.noteAt);
}

function replay() {
  if (!ensureAudio()) return;
  stopAll();
  const d = S.deck[S.round];
  playNote(midiOf(chapter().notes[d]), now() + 0.03);
}

/**
 * Only the first tap of a round counts. After a miss the player keeps tapping (each wrong dot
 * turns red and plays its note) until they find the right one; then the round moves on.
 */
function answer(d, fromMic = false) {
  if (S.phase !== 'listen' && S.phase !== 'retry') return;
  const heard = S.deck[S.round];
  const ok = d === heard;
  if (S.phase === 'listen') {
    S.answers.push({ heard, answered: d });
    S.tries = 0;
    S.noteMs = S.noteAt ? Math.max(0, Math.round((now() - S.noteAt) * 1000)) : null;
  }
  S.tries++;
  stopAll();
  if (!fromMic) playNote(midiOf(chapter().notes[d]), now() + 0.03);
  if (ok) {
    S.phase = 'feedback';
    S.states = { ...S.states, [d]: 'correct' };
    appendLog([{
      t: Date.now(), ch: S.chapterId, lvl: S.level, heard, answered: S.answers[S.answers.length - 1].answered,
      tries: S.tries, ms: S.noteMs, ref: S.settings.ref, labels: S.settings.labels,
    }]);
    timer = setTimeout(advance, CORRECT_DELAY);
  } else {
    S.phase = 'retry';
    S.states = { ...S.states, [d]: 'wrong' };
  }
  render();
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

// ---------- microphone ----------

const micWanted = () =>
  S.settings.mic && (S.screen === 'explore' || S.screen === 'play') && document.visibilityState === 'visible';

/** Start or stop the mic to match the current screen and setting. Idempotent; called on every render. */
function syncMic() {
  if (!micSupported()) return;
  if (micWanted()) {
    if (!micActive() && S.mic === 'off') startListening();
  } else if (micActive() || S.mic === 'on') {
    stopMic();
    setNoteLimit(null);
    S.mic = S.mic === 'blocked' ? 'blocked' : 'off';
  }
}

async function startListening() {
  const ctx = ensureAudio();
  if (!ctx) return;
  S.mic = 'starting';
  setNoteLimit(MIC_NOTE_LIMIT);
  try {
    await startMic(ctx, { quietAt, onNote: onMicNote, onHear: showHearing });
    S.mic = 'on';
    if (!micWanted()) { stopMic(); setNoteLimit(null); S.mic = 'off'; }
  } catch {
    S.mic = 'blocked';
    setNoteLimit(null);
  }
  render();
}

let lastHearing = '';
function showHearing(info) {
  const text = info ? `${SHARP_NAMES[((info.midi % 12) + 12) % 12]} ${info.cents > 0 ? '+' : ''}${info.cents}¢` : '';
  if (text === lastHearing) return;
  lastHearing = text;
  const el = document.getElementById('hearing');
  if (el) el.textContent = text;
}

function onMicNote(midi) {
  const degreeMidis = [];
  for (const d of degrees()) degreeMidis[d] = midiOf(chapter().notes[d]);
  const { degree } = matchDegree(midi, degreeMidis);
  if (degree == null) return; // not a note of this level
  if (S.screen === 'explore') {
    S.states = { [degree]: 'playing' };
    render();
    clearTimer();
    timer = setTimeout(() => { S.states = {}; render(); }, 600);
  } else if (S.screen === 'play') {
    answer(degree, true);
  }
}

// ---------- input ----------

const ACTIONS = {
  home: () => go('home'),
  settings: () => go('settings'),
  stats: () => { S.stats = { agg: loadStats(), log: loadLog(), now: Date.now() }; go('stats'); },
  levels: () => go('levels'),
  chapter: (arg) => { S.chapterId = arg; go('levels'); },
  level: (arg) => openLevel(Number(arg)),
  start: () => startLevel(),
  reference: () => playReferenceOnly(),
  mic: () => {
    S.settings = { ...S.settings, mic: !S.settings.mic };
    saveSettings(S.settings);
    if (S.mic === 'blocked') S.mic = 'off'; // the next "on" tries again
    render();
  },
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
    if (key === 'sound') {
      setSound(value);
      if (ensureAudio()) prerender([...levelMidis(), ...CHORDS.C, ...CHORDS.F, ...CHORDS.G]);
    }
    render();
  },
  reset: () => {
    clearTimeout(resetTimer);
    if (!S.confirmReset) {
      S.confirmReset = true;
      resetTimer = setTimeout(() => { S.confirmReset = false; render(); }, 3000);
    } else {
      S.confirmReset = false;
      S.progress = { best: {} };
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
      if (nxt) ACTIONS.next();
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
  setSound(S.settings.sound);
  app.addEventListener('click', onClick);
  app.addEventListener('keydown', (e) => {
    const dot = e.target.closest?.('.dot');
    if (dot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); onClick({ target: dot }); }
  });
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => render());
  render();
}
