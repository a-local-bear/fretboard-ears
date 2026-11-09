// App state, screens and input handling. Full re-render via innerHTML, skipped when nothing changed.

import {
  CHAPTERS, ROUNDS, FAMILIES, noteColor, solfegeName, letterName, keyName, keyLetter, degreeIndex,
  chapterById, levelsFor, buildContext, pickKey, placeChapter, positionsOf, resolutionOf,
} from './data.js';
import { buildDeck } from './deck.js';
import {
  isPassed, bestScore, recordScore, nextLevel, playedCount,
} from './progress.js';
import {
  loadSettings, saveSettings, loadProgress, saveProgress, loadKey, saveKey, appendLog, requestPersistence,
  loadStats, loadLog,
} from './storage.js';
import {
  streaks, heatmap, totals, degreeAccuracy, topConfusions, triesAfterMiss, avgResponseMs, trend,
} from './stats.js';
import {
  ensureAudio, prerender, playNote, playReference, playOver, playArpeggio, stopAll, droneActive, now, setSound, setNoteLimit, quietAt,
} from './audio.js';
import { fretboardSVG } from './fretboard.js';
import { startMic, stopMic, micActive, micSupported } from './mic.js';
import { matchDegree, SHARP_NAMES } from './pitch.js';
import { referenceFor } from './reference.js';
import { chordsFor, voicing, pickOverChord } from './harmony.js';

const CORRECT_DELAY = 1100;
const RESOLVE_STEP = 0.75; // seconds per quarter note of the resolution (80 bpm)
const MIC_NOTE_LIMIT = 1.6; // seconds the app's notes may ring while the mic listens
const VERTICAL_BELOW = 640;

const S = {
  screen: 'home', // home | levels | explore | play | results | settings | stats
  chapterId: 'one',
  level: 0, // index into levelsFor(chapterId)
  keyPc: loadKey(), // tonic of the fixed-key levels (0 = C … 11 = B)
  ctx: null, // buildContext() of the level being explored or played: key, mode, pool, positions
  deck: [],
  round: 0,
  answers: [], // { heard, answered }
  phase: 'listen', // listen → (retry after a miss) → feedback once the right note is found
  tries: 0, // taps in the current round
  states: {}, // degree → dot state for the current round
  posStates: {}, // 'string,fret' → dot state, for lighting one position of a note (the resolution)
  resolution: [], // note ids of the resolution being played, shown in the feedback line
  noteAt: 0, // context time of the current mystery note
  overChord: null, // the chord (harmony.js) the current mystery note sounds over, or null
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
let resolveTimers = [];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const chapter = () => chapterById(S.chapterId);
const level = () => levelsFor(S.chapterId)[S.level];
const degrees = () => S.ctx.pool; // note ids: semitones above the tonic
const midiOfNote = (d) => S.ctx.tonic + d;
const noteText = (d) => (S.settings.labels === 'letters' ? letterName(d, S.ctx.keyPc, S.ctx.mode) : solfegeName(d));
/** Every note name the UI shows goes through here so it always carries its colour (.deg, --c). */
const coloredName = (d, text = noteText(d)) => `<span class="deg" style="--c:${noteColor(d)}">${esc(text)}</span>`;
const noteName = (d) => coloredName(d);
const keyLabel = () => keyName(S.ctx.keyPc, S.ctx.mode);
const clearTimer = () => {
  clearTimeout(timer); timer = null;
  resolveTimers.forEach(clearTimeout); resolveTimers = [];
};

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

const topbar = (title, back, sub = '') => `
  <header class="topbar">
    ${back ? `<button class="iconbtn" data-action="${back}" data-focus-key="back" aria-label="Back">←</button>` : '<span class="brandmark" aria-hidden="true"></span>'}
    ${sub ? `<div class="titles"><span class="tsub">${sub}</span><h1>${title}</h1></div>` : `<h1>${title}</h1>`}
    ${S.screen === 'home' ? `<button class="iconbtn" data-action="settings" data-focus-key="settings" aria-label="Settings">⚙</button>` : '<span class="iconbtn-spacer"></span>'}
  </header>`;

const board = (opts = {}) => fretboardSVG({
  dots: degrees().flatMap((id) => S.ctx.positions.get(id).map((pos) => ({ id, pos }))),
  frame: S.ctx.frame, labelOf: noteText, nameOf: solfegeName, hidden: S.settings.labels === 'hidden',
  vertical: S.vertical, ...opts,
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

const refLabel = () => {
  const r = referenceFor(S.settings, 0);
  return r === 'do' ? 'Hear Do' : r === 'drone' ? 'Hear drone' : 'Hear key';
};

const SCREENS = {
  home() {
    return `${topbar('Fretboard Ears')}
    <main class="screen home">
      <p class="lede">Hear a note in a key, then find it on the neck.</p>
      <ol class="chapters">
        ${CHAPTERS.map((c, i) => {
          const played = playedCount(S.progress, c.id);
          return `<li><button class="chapter" data-action="chapter" data-arg="${c.id}" data-focus-key="chapter-${c.id}">
            <span class="cnum">${i + 1}</span>
            <span class="cbody"><span class="cname">${esc(c.name)}</span><span class="cdesc">${esc(c.desc)}</span></span>
            <span class="cmeta">${played ? `${played}/${levelsFor(c.id).length} played` : ''}</span>
          </button></li>`;
        }).join('')}
      </ol>
      <div class="actions">${btn('stats', 'Practice stats', 'ghost')}</div>
    </main>`;
  },

  levels() {
    const c = chapter();
    const levels = levelsFor(c.id);
    const keys = Array.from({ length: 12 }, (_, pc) => `<button class="keychip ${pc === S.keyPc ? 'on' : ''}" data-action="key" data-arg="${pc}" data-focus-key="key-${pc}" aria-pressed="${pc === S.keyPc}">${esc(keyLetter(pc))}</button>`).join('');
    const sections = [];
    for (const l of levels) {
      const last = sections[sections.length - 1];
      if (last && last.family === l.family) last.levels.push(l);
      else sections.push({ family: l.family, levels: [l] });
    }
    return `${topbar(esc(c.name), 'home')}
    <main class="screen levels">
      <p class="lede">${esc(c.desc)}</p>
      <div class="keybar"><span class="keylabel" id="keylabel">Key</span><div class="keychips" role="group" aria-labelledby="keylabel">${keys}</div></div>
      <p class="keynote">Fixed-key levels play in ${esc(keyName(S.keyPc, 'major'))} or ${esc(keyName(S.keyPc, 'minor'))}. Random-key levels pick their own.</p>
      ${sections.map(({ family, levels: ls }) => `<section class="family">
        <h2 class="sub">${esc(FAMILIES[family].name)}${family === 'major' ? ` <span class="fmode">${esc(keyName(S.keyPc, 'major'))}</span>` : family.startsWith('minor') ? ` <span class="fmode">${esc(keyName(S.keyPc, 'minor'))}</span>` : ''}</h2>
        <ol class="levelgrid">
        ${ls.map((l) => {
          const best = bestScore(S.progress, c.id, l.idx);
          const probe = buildContext(c.id, l, l.random ? 0 : S.keyPc, l.mode ?? 'major');
          const first = probe.pool.filter((d) => d <= 12);
          return `<li><button class="levelcard ${best != null && isPassed(best) ? 'passed' : ''}" data-action="level" data-arg="${l.idx}" data-focus-key="level-${l.idx}">
            <span class="lnum">${esc(l.name)}</span>
            <span class="lnotes">${first.map((d) => `<i style="--c:${noteColor(d)}"></i>`).join('')}</span>
            <span class="lnames">${l.tag ? esc(l.tag) : l.random ? 'New key every time' : first.length ? `${coloredName(first[0], solfegeName(first[0]))} → ${coloredName(probe.pool[probe.pool.length - 1], solfegeName(probe.pool[probe.pool.length - 1]))}` : ''}</span>
            <span class="lbest">${best == null ? 'Not played' : `Best ${best}/${ROUNDS}`}</span>
          </button></li>`;
        }).join('')}
        </ol>
      </section>`).join('')}
    </main>`;
  },

  explore() {
    const ds = degrees();
    const newest = ds[ds.length - 1];
    const intro = level().grow != null
      ? `New note: <b>${coloredName(newest, solfegeName(newest))}</b>${S.settings.labels === 'letters' ? ` (${coloredName(newest, letterName(newest, S.ctx.keyPc, S.ctx.mode))})` : ''}.`
      : `${ds.length} notes, ${ds.length > 8 ? 'from ' : ''}<b>${noteName(ds[0])}</b> to <b>${noteName(newest)}</b>.`;
    const where = S.ctx.positions.get(newest).length > 1 ? 'Every position of a note counts as that note.' : '';
    return `${topbar(esc(level().name), 'levels', esc(chapter().name))}
    <main class="screen explore">
      <p class="keyline">${esc(keyLabel())}</p>
      <p class="lede">${intro} ${where} ${S.mic === 'on' ? 'Tap the dots to hear each one, or play them to check the mic hears you' : 'Tap the dots to hear each one'}, then start.</p>
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
    return `${topbar(esc(level().name), 'levels', esc(chapter().name))}
    <main class="screen play">
      <div class="roundbar" aria-label="Round ${Math.min(S.round + 1, ROUNDS)} of ${ROUNDS}, ${score} correct">
        <span class="pips">${pips}</span>
        <span class="count">${Math.min(S.round + 1, ROUNDS)}/${ROUNDS}</span>
      </div>
      <p class="prompt">${promptText()}</p>
      ${micBar()}
      <div class="boardwrap">${board({ states: S.states, posStates: S.posStates, disabled: S.phase === 'feedback' })}</div>
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
      return `<li>Heard <b>${noteName(h)}</b>, answered <b>${noteName(ans)}</b>${n > 1 ? ` ×${n}` : ''}</li>`;
    }).join('');
    const nxt = nextLevel(S.chapterId, S.level);
    const canNext = !!nxt;
    return `${topbar(esc(level().name), 'levels', esc(chapter().name))}
    <main class="screen results">
      <p class="keyline">${esc(keyLabel())}</p>
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
    const bars = degreeAccuracy(agg).map((d) => `<li class="bar" style="--c:${noteColor(d.degree)}">
        <span class="bname">${esc(solfegeName(d.degree))}</span>
        <span class="track"><i style="width:${Math.round(d.acc * 100)}%"></i></span>
        <span class="bval">${pct(d.acc)}</span>
        <span class="bn">${d.heard}</span></li>`).join('');
    const conf = topConfusions(agg, 3).map((c) =>
      `<li>Heard <b>${coloredName(c.heard, solfegeName(c.heard))}</b>, answered <b>${coloredName(c.answered, solfegeName(c.answered))}</b> <span class="muted">×${c.n}</span></li>`).join('');
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
      <section><h2 class="sub">Reference</h2>${seg('ref', [['cadence', 'Cadence'], ['do', 'Do'], ['drone', 'Drone'], ['none', 'Nothing']])}
        <p class="hint">Cadence strums C–F–G–C. Do plays the root. Drone holds the root and fifth under the note until you answer (it plays Do instead while the mic is on, since the mic would hear it). Nothing is the hardest.</p>
        ${seg('refWhen', [['each', 'Every note'], ['level', 'Once per level']])}
        <p class="hint">Once per level plays it before the first note only. Hear key replays it any time.</p></section>
      <section><h2 class="sub">Note over a chord</h2>${seg('over', [['off', 'Off'], ['main', 'I IV V'], ['any', 'Any chord']])}
        <p class="hint">The cadence plays first as usual, then the note sounds over a random chord, so you hear how the same note changes colour with the harmony. The cadence replaces a drone or Do reference. Each answer is logged with its chord.</p></section>
      <section><h2 class="sub">Resolve to Do</h2>${seg('resolve', [['on', 'On'], ['off', 'Off']])}
        <p class="hint">After a correct answer, hear the note walk stepwise to the nearest Do.</p></section>
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
  const lead = a.heard === a.answered ? 'Yes, ' : 'There it is: ';
  if (S.resolution.length > 1) return `${lead}${S.resolution.map(noteName).join(' → ')}`;
  return `${lead}${noteName(a.heard)}.`;
}

// ---------- flow ----------

function go(screen) {
  clearTimer();
  stopAll();
  if (screen !== 'settings') S.confirmReset = false;
  S.screen = screen;
  S.states = {};
  S.posStates = {};
  S.resolution = [];
  render();
  window.scrollTo(0, 0);
}

const levelMidis = () => (S.ctx ? degrees().map(midiOfNote) : []);
const cadenceMidis = () => (S.ctx ? S.ctx.cadence.chords.flat() : []);
/** Every chord voicing of the level's key, when the mystery note may sound over a chord. */
const overMidis = () => (S.ctx && S.settings.over !== 'off' ? chordsFor(S.ctx.mode).flatMap((c) => voicing(c, S.ctx.keyPc)) : []);

function openLevel(index) {
  S.level = index;
  const { keyPc, mode } = pickKey(level(), S.keyPc);
  S.ctx = buildContext(S.chapterId, level(), keyPc, mode);
  go('explore');
  if (ensureAudio()) prerender([...levelMidis(), ...cadenceMidis(), ...overMidis()]);
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
  S.posStates = {};
  S.resolution = [];
  S.noteMs = null;
  S.noteAt = 0;
  render();
  if (!ensureAudio()) return;
  S.overChord = pickOverChord(S.settings.over, S.ctx.mode);
  const over = S.overChord && voicing(S.overChord, S.ctx.keyPc);
  S.noteAt = playReference(referenceFor(S.settings, S.round), S.ctx.tonic, S.ctx.cadence.chords, { over });
  playNote(midiOfNote(S.deck[S.round]), S.noteAt);
}

function replay() {
  if (!ensureAudio()) return;
  stopAll(undefined, true); // a drone keeps holding under the replayed note
  const d = S.deck[S.round];
  if (S.overChord) playOver(voicing(S.overChord, S.ctx.keyPc), midiOfNote(d));
  else playNote(midiOfNote(d), now() + 0.03);
}

/**
 * Only the first tap of a round counts. After a miss the player keeps tapping (each wrong dot
 * turns red and plays its note) until they find the right one; then the round moves on.
 */
function answer(d, fromMic = false, pos = null) {
  if (S.phase !== 'listen' && S.phase !== 'retry') return;
  const heard = S.deck[S.round];
  const ok = d === heard;
  if (S.phase === 'listen') {
    S.answers.push({ heard, answered: d });
    S.tries = 0;
    S.noteMs = S.noteAt ? Math.max(0, Math.round((now() - S.noteAt) * 1000)) : null;
  }
  S.tries++;
  S.resolution = [];
  stopAll(undefined, !ok); // a wrong tap keeps the drone; the right answer (feedback) ends it
  if (!fromMic) playNote(midiOfNote(d), now() + 0.03);
  if (ok) {
    S.phase = 'feedback';
    S.states = { ...S.states, [d]: 'correct' };
    appendLog([{
      t: Date.now(), ch: S.chapterId, lvl: S.level,
      heard: degreeIndex(heard, S.ctx.mode), answered: degreeIndex(S.answers[S.answers.length - 1].answered, S.ctx.mode),
      tries: S.tries, ms: S.noteMs, ref: referenceFor(S.settings, S.round), labels: S.settings.labels,
      // Added with keys and modes: the level id, the key's tonic (0 = C), the mode, and the exact notes
      // as semitones above the tonic (heard/answered store chromatic and higher-octave notes as 8 + that).
      lid: level().id, key: S.ctx.keyPc, mode: S.ctx.mode, hs: heard, as: S.answers[S.answers.length - 1].answered,
      chord: S.overChord ? S.overChord.numeral : null, // roman numeral the note sounded over (null: none)
    }]);
    const wait = S.settings.resolve === 'on' ? playResolution(d, fromMic, pos) : 0;
    timer = setTimeout(advance, CORRECT_DELAY + wait);
  } else {
    S.phase = 'retry';
    S.states = { ...S.states, [d]: 'wrong' };
  }
  render();
}

/**
 * Play the answered note walking stepwise to the nearest Do, one quarter note per step, lighting
 * one dot per step: the position nearest the previous one (the answered dot to start with).
 * A tapped answer already sounded as the first note; a mic answer is the player's own, so only
 * the steps after it are played. Returns the ms the walk adds after the answer. The notes are
 * scheduled voices, so quietAt() keeps the mic from hearing them; advance() and stopAll() cut them.
 */
function playResolution(d, fromMic, pos) {
  const path = resolutionOf(d, S.ctx.mode, S.ctx.tonic);
  S.resolution = path;
  if (path.length < 2 || !ensureAudio()) return 0;
  const place = placeChapter(S.chapterId, S.ctx.keyPc);
  let at0 = pos ? pos.split(',').map(Number) : S.ctx.positions.get(d)?.[0];
  const t1 = now() + (fromMic ? 0.3 : 0.03 + RESOLVE_STEP);
  path.slice(1).forEach((o, i) => {
    const at = t1 + i * RESOLVE_STEP;
    playNote(midiOfNote(o), at);
    const cands = positionsOf(place, midiOfNote(o));
    if (at0 && cands.length > 1) {
      cands.sort((a, b) => Math.abs(a[1] - at0[1]) + Math.abs(a[0] - at0[0]) - Math.abs(b[1] - at0[1]) - Math.abs(b[0] - at0[0]));
    }
    const p = cands[0];
    if (p) at0 = p;
    const key = p && `${p[0]},${p[1]}`;
    resolveTimers.push(setTimeout(() => {
      S.posStates = key ? { [key]: 'playing' } : {};
      render();
    }, (at - now()) * 1000));
    resolveTimers.push(setTimeout(() => { S.posStates = {}; render(); }, (at - now() + RESOLVE_STEP * 0.9) * 1000));
  });
  return (t1 + (path.length - 2) * RESOLVE_STEP - now()) * 1000;
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
    playArpeggio([0, S.ctx.mode === 'minor' ? 3 : 4, 7, 12].map(midiOfNote));
  }
}

function playReferenceOnly() {
  if (!ensureAudio()) return;
  if (S.screen === 'play' && droneActive()) return; // already sounding under the round
  stopAll();
  const mode = referenceFor({ ...S.settings, refWhen: 'each' }, 0);
  playReference(mode === 'none' ? 'cadence' : mode, S.ctx.tonic, S.ctx.cadence.chords, { droneFor: 3 });
}

function tapDot(d, pos = null) {
  if (S.screen === 'explore') {
    if (!ensureAudio()) return;
    stopAll();
    playNote(midiOfNote(d), now() + 0.02);
    S.states = { [d]: 'playing' };
    render();
    clearTimer();
    timer = setTimeout(() => { S.states = {}; render(); }, 600);
  } else if (S.screen === 'play') {
    answer(d, false, pos);
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
  for (const d of degrees()) degreeMidis[d] = midiOfNote(d);
  const { degree } = matchDegree(midi, degreeMidis, { exact: S.ctx.multiOctave });
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
  key: (arg) => { S.keyPc = Number(arg); saveKey(S.keyPc); render(); },
  start: () => startLevel(),
  reference: () => playReferenceOnly(),
  mic: () => {
    S.settings = { ...S.settings, mic: !S.settings.mic };
    saveSettings(S.settings);
    if (S.mic === 'blocked') S.mic = 'off'; // the next "on" tries again
    render();
  },
  replay: () => replay(),
  tap: (_, el) => tapDot(Number(el.dataset.degree), el.dataset.pos),
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
      if (ensureAudio()) prerender([...levelMidis(), ...cadenceMidis(), ...overMidis()]);
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
  // Mouse/touch clicks have detail > 0; keyboard-activated ones have 0. Drop focus after a pointer
  // click so Space/Enter act on the screen rather than re-pressing this button.
  if (e.detail > 0) el.blur();
  ensureAudio();
  requestPersistence();
  ACTIONS[el.dataset.action]?.(el.dataset.arg, el);
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 8 && (S.screen === 'play' || S.screen === 'explore')) {
    const d = degrees()[n - 1]; // keys 1–8 are the first eight notes of the level
    if (d != null) { ensureAudio(); tapDot(d); e.preventDefault(); }
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
