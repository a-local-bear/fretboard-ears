// App state, screens and input handling. Full re-render via innerHTML, skipped when nothing changed.

import {
  ROUNDS, POSITIONS, LEVELS, noteColor, degreeName, degreeWord, letterName, keyName, keyLetter, degreeIndex,
  buildContext, pickKey, placePosition, positionsOf, resolutionOf, newestOf,
} from './data.js';
import { buildDeck } from './deck.js';
import { buildPhraseDeck } from './phrase.js';
import { noteWeights, buildAdaptiveDeckFor } from './adaptive.js';
import { planSession, blockLabel } from './session.js';
import { isPassed, bestScore, recordBest, levelAfter } from './progress.js';
import {
  loadSettings, saveSettings, loadProgress, saveProgress, loadKey, saveKey, loadPosition, savePosition, appendLog, requestPersistence,
  loadStats, loadLog,
} from './storage.js';
import { STAGES, stageOf, tipOf, levelDone, nextLevel, pathCount } from './path.js';
import {
  streaks, heatmap, totals, degreeAccuracy, topConfusions, triesAfterMiss, avgResponseMs, trend,
} from './stats.js';
import { progressHTML } from './charts.js';
import {
  ensureAudio, prerender, playNote, playReference, playArpeggio, stopAll, droneActive, now, setSound, setNoteLimit, quietAt, callAt,
} from './audio.js';
import { GAP_OPTIONS, spoken, revealTimeline } from './listen.js';
import { fretboardSVG } from './fretboard.js';
import { startMic, stopMic, micActive, micSupported } from './mic.js';
import { matchDegree, SHARP_NAMES } from './pitch.js';
import { referenceFor } from './reference.js';

const CORRECT_DELAY = 1100;
const PHRASE_STEP = 0.6; // seconds between the notes of a phrase
const RESOLVE_STEP = 0.75; // seconds per quarter note of the resolution (80 bpm)
const MIC_NOTE_LIMIT = 1.6; // seconds the app's notes may ring while the mic listens
const VERTICAL_BELOW = 640;

const S = {
  screen: 'menu', // menu | home | levels | explore | play | listen | results | summary | settings | stats
  stage: 0, // index into STAGES: the stage open on the levels screen
  level: 0, // index into LEVELS
  keyPc: loadKey(), // tonic of the fixed-key levels (0 = C … 11 = B)
  positionId: loadPosition(), // where on the neck the player answers (levels of more than one octave use the whole neck)
  ctx: null, // buildContext() of the level being explored or played: key, mode, position, pool, dots
  deck: [],
  round: 0,
  answers: [], // one per round: { len, notes: [{ heard, answered }] }, the FIRST answer to each position
  pos: 0, // index in the phrase of the note being answered (always 0 for single-note levels)
  fresh: false, // the dots of the previous position are still lit; clear them on the next answer
  phase: 'listen', // listen → (retry after a miss) → feedback once the right note is found
  tries: 0, // taps in the current round
  states: {}, // degree → dot state for the current round
  posStates: {}, // 'string,fret' → dot state, for lighting one position of a note (the resolution)
  resolution: [], // note ids of the resolution being played, shown in the feedback line
  noteAt: 0, // context time of the current mystery note
  noteMs: null, // ms from the mystery note sounding to the first tap (null if unknown)
  stats: null, // snapshot for the stats screen, taken when it opens
  result: null, // { score, newBest, passed }
  confirmReset: false,
  session: null, // daily practice: { plan, i, scores: [{ label, name, score }], streak?, done? } while one is running
  ls: null, // passive listening: { n (rounds played), phase: prompt | think | reveal, paused } while it runs
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
const level = () => LEVELS[S.level];
const stageName = () => STAGES[stageOf(level())].name;
const degrees = () => S.ctx.pool; // note ids: semitones above the tonic
const midiOfNote = (d) => S.ctx.tonic + d;
const noteText = (d) => (S.settings.labels === 'letters' ? letterName(d, S.ctx.keyPc, S.ctx.mode) : degreeName(d));
/** Every note name the UI shows goes through here so it always carries its colour (.deg, --c). */
const coloredName = (d, text = noteText(d)) => `<span class="deg" style="--c:${noteColor(d)}">${esc(text)}</span>`;
const noteName = (d) => coloredName(d);
/** The note ids to find this round: a phrase (an array), or a single note as a one-element array. */
const targets = () => [].concat(S.deck[S.round]);
/** A round is right only if every note was right on the first try. */
const roundOk = (a) => a.notes.length === a.len && a.notes.every((n) => n.heard === n.answered);
const roundBad = (a) => a.notes.some((n) => n.heard !== n.answered);
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

const btn = (action, label, cls = '', extra = '', disabled = false) =>
  `<button class="btn ${cls}" data-action="${action}" data-focus-key="${action}${extra ? '-' + esc(extra) : ''}" ${extra ? `data-arg="${esc(extra)}"` : ''}${disabled ? ' disabled' : ''}>${label}</button>`;

const topbar = (title, back, sub = '') => `
  <header class="topbar">
    ${back ? `<button class="iconbtn" data-action="${back}" data-focus-key="back" aria-label="Back">←</button>` : '<span class="brandmark" aria-hidden="true"></span>'}
    ${sub ? `<div class="titles"><span class="tsub">${sub}</span><h1>${title}</h1></div>` : `<h1>${title}</h1>`}
    ${S.screen === 'home' ? `<button class="iconbtn" data-action="settings" data-focus-key="settings" aria-label="Settings">⚙</button>` : '<span class="iconbtn-spacer"></span>'}
  </header>`;

const board = (opts = {}) => fretboardSVG({
  dots: degrees().flatMap((id) => S.ctx.positions.get(id).map((pos) => ({ id, pos }))),
  frame: S.ctx.frame, labelOf: noteText, nameOf: degreeWord, hidden: S.settings.labels === 'hidden',
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
  return r === 'do' ? 'Hear root' : r === 'drone' ? 'Hear drone' : 'Hear key';
};

/**
 * The position picker: where on the neck the player answers. The choice is kept for every level; on
 * a level screen the board follows it at once. `label` adds the caption above the chips.
 */
const positionChips = (label = true) => `<div class="keybar">${label ? '<span class="keylabel" id="poslabel">Position</span>' : ''}
      <div class="poschips" role="group" ${label ? 'aria-labelledby="poslabel"' : 'aria-label="Position"'}>${POSITIONS.map((p) =>
    `<button class="keychip ${p.id === S.positionId ? 'on' : ''}" data-action="position" data-arg="${p.id}" data-focus-key="position-${p.id}" aria-pressed="${p.id === S.positionId}" title="${esc(p.desc)}">${esc(p.name)}</button>`).join('')}</div></div>`;

const SCREENS = {
  /** The site's main menu: the apps that live here. Songcraft and Woozy are pages of their own. */
  menu() {
    return `${topbar('Fretboard Ears')}
    <main class="screen home">
      <p class="lede">Train your ear, then write your own songs.</p>
      <ol class="chapters">
        <li><button class="chapter" data-action="home" data-focus-key="app-ears">
          <span class="cnum">1</span>
          <span class="cbody"><span class="cname">Ear training</span><span class="cdesc">Hear a note in a key and play it on your guitar</span></span>
          <span class="cmeta"></span>
        </button></li>
        <li><a class="chapter" href="songcraft/" data-focus-key="app-songcraft">
          <span class="cnum">2</span>
          <span class="cbody"><span class="cname">Songcraft</span><span class="cdesc">Write chord progressions, and indie, pop and jazzy riffs that fit them</span></span>
          <span class="cmeta"></span>
        </a></li>
        <li><a class="chapter" href="woozy/" data-focus-key="app-woozy">
          <span class="cnum">3</span>
          <span class="cbody"><span class="cname">Woozy</span><span class="cdesc">A course in bedroom-pop chords and melodies, and a studio to write whole songs</span></span>
          <span class="cmeta">New</span>
        </a></li>
      </ol>
    </main>`;
  },

  /** The path: the stages of the ladder, and the next level one tap away. */
  home() {
    return `${topbar('Ear training', 'menu')}
    <main class="screen home">
      <p class="lede">Hear a note in a key, then play it on your guitar.</p>
      ${nextUpHTML()}
      <div class="actions">${btn('practise', 'Daily practice', 'primary')}</div>
      <ol class="chapters">
        ${STAGES.map((st, i) => {
          const { done, total } = pathCount(S.progress, st.levels);
          return `<li><button class="chapter" data-action="stage" data-arg="${i}" data-focus-key="stage-${i}">
            <span class="cnum">${i + 1}</span>
            <span class="cbody"><span class="cname">${esc(st.name)}</span><span class="cdesc">${esc(st.desc)}</span></span>
            <span class="cmeta">${done}/${total}</span>
          </button></li>`;
        }).join('')}
      </ol>
      <div class="actions">${btn('stats', 'Practice stats', 'ghost')}</div>
    </main>`;
  },

  /** One stage: what it is for, the position and key to play in, and its levels as a checklist. */
  levels() {
    const st = STAGES[S.stage];
    const nx = nextLevel(S.progress);
    const fixedKey = st.levels.some((l) => !l.random);
    const keys = Array.from({ length: 12 }, (_, pc) => `<button class="keychip ${pc === S.keyPc ? 'on' : ''}" data-action="key" data-arg="${pc}" data-focus-key="key-${pc}" aria-pressed="${pc === S.keyPc}">${esc(keyLetter(pc))}</button>`).join('');
    return `${topbar(esc(st.name), 'home', `Stage ${S.stage + 1} of ${STAGES.length}`)}
    <main class="screen levels">
      <p class="hint stagedesc"><b>${esc(st.desc)}</b> ${esc(st.about)}</p>
      ${positionChips()}
      <p class="keynote">Where you answer: the box with its root on that string, or anywhere on the neck. Levels of more than one octave always use the whole neck.</p>
      ${fixedKey ? `<div class="keybar"><span class="keylabel" id="keylabel">Key</span><div class="keychips" role="group" aria-labelledby="keylabel">${keys}</div></div>
      <p class="keynote">The first levels stay in ${esc(keyName(S.keyPc, 'major'))}. After the whole octave, every level picks a new key each time you start it.</p>`
    : '<p class="keynote">Every level here picks a new key each time you start it.</p>'}
      <ol class="steps">
        ${st.levels.map((l) => {
          const best = bestScore(S.progress, l.id);
          const ok = levelDone(l, S.progress);
          const now = l === nx;
          const notes = buildContext(S.positionId, l, l.random ? 0 : S.keyPc, l.mode ?? 'major').pool.filter((d) => d <= 12);
          const kind = [l.tag, l.neck ? 'Whole neck' : ''].filter(Boolean).join(' · ');
          return `<li><button class="step ${ok ? 'done' : ''} ${now ? 'now' : ''}" data-action="level" data-arg="${l.idx}" data-focus-key="level-${l.idx}"${now ? ' aria-current="step"' : ''}>
            <span class="smark" aria-hidden="true">${ok ? '✓' : now ? '▶' : '·'}</span>
            <span class="cbody"><span class="sname">${esc(l.name)}</span>${kind ? `<span class="cdesc">${esc(kind)}</span>` : ''}
              <span class="lnotes">${notes.map((d) => `<i style="--c:${noteColor(d)}"></i>`).join('')}</span>
              <span class="stip">${esc(tipOf(l.id))}</span></span>
            <span class="cmeta">${best != null ? `Best ${best}/${ROUNDS}` : now ? 'Next' : 'Not played'}</span>
          </button></li>`;
        }).join('')}
      </ol>
    </main>`;
  },

  explore() {
    const lv = level();
    const ds = degrees();
    const newest = lv.newest != null ? newestOf(lv, ds) : ds[ds.length - 1];
    const intro = lv.newest != null
      ? `New note: <b>${coloredName(newest, degreeName(newest))}</b>, the ${degreeWord(newest)}${S.settings.labels === 'letters' ? ` (${coloredName(newest, letterName(newest, S.ctx.keyPc, S.ctx.mode))})` : ''}.`
      : `${ds.length} notes, ${ds.length > 8 ? 'from ' : ''}<b>${noteName(ds[0])}</b> to <b>${noteName(newest)}</b>.`;
    const phrase = lv.len > 1 ? `Each round plays ${lv.len} notes in a row: play them back one by one, in order.` : '';
    const where = S.ctx.positions.get(newest).length > 1 ? 'Every position of a note counts as that note.' : '';
    return `${topbar(esc(lv.name), 'levels', esc(stageName()))}
    <main class="screen explore fit">
      <p class="keyline">${esc(keyLabel())}${lv.neck ? ' · whole neck' : ''}</p>
      <p class="hint pathtip">${esc(tipOf(lv.id))}</p>
      <p class="lede">${intro} ${where} ${phrase} ${S.mic === 'on' ? 'Tap the dots to hear each one, or play them to check the mic hears you' : 'Tap the dots to hear each one'}, then start.</p>
      ${lv.neck ? '' : positionChips(false)}
      ${micBar()}
      <div class="boardwrap">${board({ states: S.states })}</div>
      <div class="actions">
        ${btn('reference', refLabel(), 'ghost')}
        ${btn('listen', 'Listen hands-free', 'ghost')}
        ${btn('start', 'Start', 'primary')}
      </div>
    </main>`;
  },

  play() {
    const score = S.answers.filter(roundOk).length;
    const pips = Array.from({ length: ROUNDS }, (_, i) => {
      const a = S.answers[i];
      const cls = a ? (roundOk(a) ? 'ok' : roundBad(a) ? 'bad' : 'now') : i === S.round ? 'now' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
    const seq = targets();
    const cur = S.answers[S.round];
    const notePips = seq.length < 2 ? '' : `<div class="pips notepips" aria-label="Note ${S.pos + 1} of ${seq.length}">${seq.map((_, i) => {
      const n = cur?.notes[i];
      const cls = n ? (n.heard === n.answered ? 'ok' : 'bad') : i === S.pos && S.phase !== 'feedback' ? 'now' : '';
      return `<i class="${cls}"></i>`;
    }).join('')}</div>`;
    return `${topbar(esc(level().name), S.session ? 'home' : 'levels', esc(stageName()))}
    <main class="screen play fit">
      ${S.session ? `<p class="keyline">${esc(blockLabel(S.session.i, S.session.plan))}</p>` : ''}
      <div class="roundbar" aria-label="Round ${Math.min(S.round + 1, ROUNDS)} of ${ROUNDS}, ${score} correct">
        <span class="pips">${pips}</span>
        <span class="count">${Math.min(S.round + 1, ROUNDS)}/${ROUNDS}</span>
      </div>
      ${notePips}
      <p class="prompt">${promptText()}</p>
      ${micBar()}
      <div class="boardwrap">${board({ states: S.states, posStates: S.posStates, disabled: S.phase === 'feedback' })}</div>
      <div class="actions">
        ${btn('reference', refLabel(), 'ghost')}
        ${btn('replay', 'Replay', 'primary')}
      </div>
    </main>`;
  },

  listen() {
    const ls = S.ls;
    const seq = targets();
    const names = seq.map(noteName).join(' → ');
    const many = seq.length > 1;
    let text;
    if (ls.paused) text = 'Paused.';
    else if (ls.phase === 'prompt') text = many ? `Listen to the ${seq.length} notes…` : 'Listen…';
    else if (ls.phase === 'think') text = `Your turn: play ${many ? 'them' : 'it'} on the guitar.`;
    else {
      const rest = S.resolution.length > 1 ? ` → ${S.resolution.slice(1).map(noteName).join(' → ')}` : '';
      text = `It was ${names}${rest}`;
    }
    const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, label]) =>
      `<button role="radio" aria-checked="${S.settings[key] === v}" class="${S.settings[key] === v ? 'on' : ''}" data-action="set" data-arg="${key}:${v}" data-focus-key="set-${key}-${v}">${label}</button>`).join('')}</div>`;
    return `${topbar(esc(level().name), 'explore', esc(stageName()))}
    <main class="screen play listen fit">
      <p class="keyline">${esc(keyLabel())} · round ${ls.n} · not scored</p>
      <p class="prompt" aria-live="polite">${text}</p>
      <div class="boardwrap">${board({ states: S.states, disabled: true })}</div>
      <div class="actions">
        ${btn('explore', 'Stop', 'ghost')}
        ${btn('listenpause', ls.paused ? 'Resume' : 'Pause', 'primary')}
      </div>
      <section class="lsopts">
        <span class="keylabel">Time to play</span>
        ${seg('listenGap', GAP_OPTIONS.map((g) => [g, `${g} s`]))}
        <span class="keylabel">Say the answer</span>${seg('listenSpeak', [['on', 'On'], ['off', 'Off']])}
        <p class="hint">Plays the level on its own: ${{ cadence: 'the cadence, ', do: 'the root, ', drone: 'the drone, ', none: '' }[referenceFor(listenRef(), 0)]}the ${many ? 'notes' : 'note'}, a pause for you to play ${many ? 'them' : 'it'}, then the answer${S.settings.resolve === 'on' ? ' resolving to the root' : ''}. The screen stays on; you don't need to look at it.</p>
      </section>
    </main>`;
  },

  results() {
    const { score, newBest, passed } = S.result;
    const counts = new Map();
    for (const n of S.answers.flatMap((a) => a.notes)) {
      if (n.heard === n.answered) continue;
      const k = `${n.heard}>${n.answered}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const confusions = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
      const [h, ans] = k.split('>').map(Number);
      return `<li>Heard <b>${noteName(h)}</b>, answered <b>${noteName(ans)}</b>${n > 1 ? ` ×${n}` : ''}</li>`;
    }).join('');
    const nxt = levelAfter(level());
    // A pass points on to the next level; a miss points back at this one. Either way both are open.
    const onward = passed && nxt;
    return `${topbar(esc(level().name), 'levels', esc(stageName()))}
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
        ${btn('retry', 'Retry', onward ? 'ghost' : 'primary')}
        ${nxt ? btn('next', 'Next level', onward ? 'primary' : 'ghost') : ''}
      </div>
      ${onward ? `<p class="hint pathhint">Next: <b>${esc(nxt.title)}</b></p>` : ''}
    </main>`;
  },

  summary() {
    const { scores, streak } = S.session;
    const total = scores.reduce((s, b) => s + b.score, 0);
    return `${topbar('Session done', 'home')}
    <main class="screen results">
      <div class="scorecard pass">
        <p class="big"><b>${total}</b>/${scores.length * ROUNDS}</p>
        <p class="verdict">${streak} day streak</p>
      </div>
      <ul class="confusions blocks">${scores.map((b, i) => `<li><span class="keyline">${i + 1}/${scores.length} · ${esc(b.label)}</span>
        <span class="bname">${esc(b.name)}</span><b>${b.score}/${ROUNDS}</b></li>`).join('')}</ul>
      <div class="actions">
        ${btn('home', 'Home', 'ghost')}
        ${btn('practise', 'Another session', 'primary')}
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
        ${btn('home', 'Pick a level', 'primary')}
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
        <span class="bname">${esc(degreeName(d.degree))}</span>
        <span class="track"><i style="width:${Math.round(d.acc * 100)}%"></i></span>
        <span class="bval">${pct(d.acc)}</span>
        <span class="bn">${d.heard}</span></li>`).join('');
    const conf = topConfusions(agg, 3).map((c) =>
      `<li>Heard <b>${coloredName(c.heard, degreeName(c.heard))}</b>, answered <b>${coloredName(c.answered, degreeName(c.answered))}</b> <span class="muted">×${c.n}</span></li>`).join('');
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
      <section class="progress"><h2 class="sub">Progress</h2>${progressHTML(agg, at)}</section>
    </main>`;
  },

  settings() {
    const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, label]) =>
      `<button role="radio" aria-checked="${S.settings[key] === v}" class="${S.settings[key] === v ? 'on' : ''}" data-action="set" data-arg="${key}:${v}" data-focus-key="set-${key}-${v}">${label}</button>`).join('')}</div>`;
    return `${topbar('Settings', 'home')}
    <main class="screen settings">
      <section><h2 class="sub">Dot labels</h2>${seg('labels', [['numbers', 'Numbers'], ['letters', 'Letters'], ['hidden', 'Hidden']])}
        <p class="hint">Numbers name each note by its interval from the root: 1, ♭3, 5. Hidden shows plain dots, so you answer by position only.</p></section>
      <section><h2 class="sub">Reference</h2>${seg('ref', [['cadence', 'Cadence'], ['do', 'Root'], ['drone', 'Drone'], ['none', 'Nothing']])}
        <p class="hint">Cadence strums the chords I, IV, V, I of the key. Root plays the root alone. Drone holds the root and fifth under the note until you answer (it plays the root instead while the mic is on, since the mic would hear it). Nothing is the hardest.</p>
        ${seg('refWhen', [['each', 'Every note'], ['level', 'Once per level']])}
        <p class="hint">Once per level plays it before the first note only. Hear key replays it any time.</p></section>
      <section><h2 class="sub">Resolve to the root</h2>${seg('resolve', [['on', 'On'], ['off', 'Off']])}
        <p class="hint">After a correct answer, hear the note walk stepwise to the nearest root.</p></section>
      <section><h2 class="sub">Adaptive practice</h2>${seg('adaptive', [['off', 'Off'], ['on', 'On']])}
        <p class="hint">On deals weak, slow and confused notes more often. Mastered notes still appear.</p></section>
      <section><h2 class="sub">Sound</h2>${seg('sound', [['guitar', 'Electric guitar'], ['synth', 'Synth']])}
        <p class="hint">Electric guitar uses recorded notes. Synth is the original plucked-string sound.</p></section>
      <section><h2 class="sub">Progress</h2>
        ${btn('reset', S.confirmReset ? 'Tap again to erase all scores' : 'Reset progress', S.confirmReset ? 'danger' : 'ghost')}</section>
    </main>`;
  },
};

/** Home: the next level of the path, one tap away. */
function nextUpHTML() {
  const nx = nextLevel(S.progress);
  const { done, total } = pathCount(S.progress);
  if (!nx) {
    return `<button class="nextup" data-action="practise" data-focus-key="nextup">
      <span class="keyline">Path complete · ${total}/${total}</span>
      <span class="sname">Keep going with daily practice</span></button>`;
  }
  return `<button class="nextup" data-action="pathnext" data-focus-key="nextup">
      <span class="keyline">Next up · ${done}/${total} done</span>
      <span class="sname">${esc(nx.name)}</span>
      <span class="cdesc">Stage ${stageOf(nx) + 1}, ${esc(STAGES[stageOf(nx)].name)}</span></button>`;
}

function promptText() {
  const seq = targets();
  const a = S.answers[S.round];
  // The notes of the phrase found so far, as coloured names.
  const found = seq.slice(0, S.pos).map(noteName).join(' → ');
  const so = found ? `${found} → ` : '';
  if (S.phase === 'retry') return `${so}Not that one. Keep looking.`;
  if (S.phase !== 'feedback' || !a) {
    if (seq.length > 1) return `${so}Which is note ${S.pos + 1} of ${seq.length}?`;
    return S.mic === 'on' ? 'Which note was that? Play it or tap it.' : 'Which note was that?';
  }
  const lead = roundOk(a) ? 'Yes, ' : 'There it is: ';
  if (seq.length > 1) {
    const rest = S.resolution.length > 1 ? ` → ${S.resolution.slice(1).map(noteName).join(' → ')}` : '.';
    return `${lead}${seq.map(noteName).join(' → ')}${rest}`;
  }
  if (S.resolution.length > 1) return `${lead}${S.resolution.map(noteName).join(' → ')}`;
  return `${lead}${noteName(seq[0])}.`;
}

// ---------- flow ----------

function go(screen) {
  clearTimer();
  if (screen !== 'listen') listenStop();
  stopAll();
  if (screen !== 'settings') S.confirmReset = false;
  if (screen !== 'play') S.session = null; // leaving a session ends it; per-level progress is already saved
  S.screen = screen;
  S.states = {};
  S.posStates = {};
  S.resolution = [];
  render();
  window.scrollTo(0, 0);
}

const levelMidis = () => (S.ctx ? degrees().map(midiOfNote) : []);
const cadenceMidis = () => (S.ctx ? S.ctx.cadence.chords.flat() : []);

/** Open a level's explore screen in a key: the player's for a fixed-key level, a fresh draw otherwise. */
function openLevel(index) {
  S.level = index;
  S.stage = stageOf(level());
  const { keyPc, mode } = pickKey(level(), S.keyPc);
  S.ctx = buildContext(S.positionId, level(), keyPc, mode);
  go('explore');
  if (ensureAudio()) prerender([...levelMidis(), ...cadenceMidis()]);
}

/** Change the position. On a level's explore screen the board moves there, in the same key. */
function setPosition(id) {
  S.positionId = id;
  savePosition(id);
  if (S.screen === 'explore') {
    clearTimer();
    stopAll();
    S.states = {};
    S.ctx = buildContext(id, level(), S.ctx.keyPc, S.ctx.mode);
    if (ensureAudio()) prerender(levelMidis());
  }
  render();
}

/** The deck for the level in S.ctx: weighted by the player's stats when adaptive, else the plain rules. */
function makeDeck(adaptive) {
  const lv = level();
  if (adaptive) {
    const weights = noteWeights(loadStats(), degrees(), { log: loadLog() });
    return buildAdaptiveDeckFor(lv, degrees(), weights, ROUNDS, S.ctx.mode);
  }
  return lv.len > 1 ? buildPhraseDeck(lv, degrees(), ROUNDS, { mode: S.ctx.mode }) : buildDeck(degrees(), ROUNDS, Math.random, lv.newest != null ? newestOf(lv, degrees()) : undefined);
}

function startLevel() {
  S.deck = makeDeck(S.settings.adaptive === 'on');
  S.round = 0;
  S.answers = [];
  S.screen = 'play';
  startRound();
}

/** Daily practice: plan the blocks from progress and stats, then play them back to back. */
function startSession() {
  const log = loadLog();
  const plan = planSession({ progress: S.progress, stats: loadStats(), log });
  S.session = { plan, i: 0, scores: [] };
  startSessionBlock(0);
}

function startSessionBlock(i) {
  const b = S.session.plan[i];
  S.session.i = i;
  S.level = b.level;
  const { keyPc, mode } = pickKey(level(), b.keyPc ?? S.keyPc);
  S.ctx = buildContext(S.positionId, level(), keyPc, mode);
  if (ensureAudio()) prerender([...levelMidis(), ...cadenceMidis()]);
  S.deck = makeDeck(b.adaptive || S.settings.adaptive === 'on');
  S.round = 0;
  S.answers = [];
  S.screen = 'play';
  startRound();
}

/** A block of the session is done: next block straight away, or the summary after the last. */
function sessionAdvance(score) {
  const ss = S.session;
  ss.scores.push({ label: ss.plan[ss.i].label, name: level().title, score });
  if (ss.i + 1 < ss.plan.length) return startSessionBlock(ss.i + 1);
  ss.streak = streaks(loadStats().days, Date.now()).current;
  S.screen = 'summary';
  S.states = {};
  stopAll();
  render();
  window.scrollTo(0, 0);
}

function startRound() {
  clearTimer();
  stopAll();
  S.phase = 'listen';
  S.pos = 0;
  S.fresh = false;
  S.states = {};
  S.posStates = {};
  S.resolution = [];
  S.noteMs = null;
  S.noteAt = 0;
  render();
  if (!ensureAudio()) return;
  // Response time counts from the last note of the phrase sounding.
  S.noteAt = playPhrase(playReference(referenceFor(S.settings, S.round), S.ctx.tonic, S.ctx.cadence.chords));
}

/** Play the round's whole phrase from time `at`; returns when its last note sounds. */
function playPhrase(at) {
  const seq = targets();
  seq.forEach((d, i) => playNote(midiOfNote(d), at + i * PHRASE_STEP));
  return at + (seq.length - 1) * PHRASE_STEP;
}

function replay() {
  if (!ensureAudio()) return;
  stopAll(undefined, true); // a drone keeps holding under the replayed phrase
  playPhrase(now() + 0.03);
}

/**
 * Only the first tap on each note of the phrase counts. After a miss the player keeps tapping (each
 * wrong dot turns red and plays its note) until they find the right one; then the next note of the
 * phrase is up, or the round moves on after the last. One log entry is written per note.
 */
function answer(d, fromMic = false, pos = null) {
  if (S.phase !== 'listen' && S.phase !== 'retry') return;
  const seq = targets();
  const p = S.pos;
  const heard = seq[p];
  const ok = d === heard;
  if (S.fresh) { S.states = {}; S.fresh = false; }
  if (S.phase === 'listen') {
    (S.answers[S.round] ||= { len: seq.length, notes: [] }).notes.push({ heard, answered: d });
    S.tries = 0;
    S.noteMs = S.noteAt ? Math.max(0, Math.round((now() - S.noteAt) * 1000)) : null;
  }
  S.tries++;
  S.resolution = [];
  // The drone holds through wrong taps and the phrase; finding its last note (feedback) ends it.
  stopAll(undefined, !(ok && p === seq.length - 1));
  if (!fromMic) playNote(midiOfNote(d), now() + 0.03);
  if (ok) {
    const first = S.answers[S.round].notes[p].answered;
    S.states = { ...S.states, [d]: 'correct' };
    appendLog([{
      t: Date.now(), ch: S.ctx.positionId, lvl: S.level, // ch: the position (once the chapter), lvl: the index in LEVELS
      heard: degreeIndex(heard, S.ctx.mode), answered: degreeIndex(first, S.ctx.mode),
      tries: S.tries, ms: S.noteMs, ref: referenceFor(S.settings, S.round), labels: S.settings.labels,
      // Added with keys and modes: the level id, the key's tonic (0 = C), the mode, and the exact notes
      // as semitones above the tonic (heard/answered store chromatic and higher-octave notes as 8 + that).
      lid: level().id, key: S.ctx.keyPc, mode: S.ctx.mode, hs: heard, as: first,
      // Added with sequence levels: the note's index in the phrase and the phrase length (0 and 1 for single notes).
      seq: p, len: seq.length,
    }]);
    if (p < seq.length - 1) {
      // Next note of the phrase; its dots start clean and its response time from now.
      S.pos++;
      S.phase = 'listen';
      S.fresh = true;
      S.noteAt = now();
      S.noteMs = null;
    } else {
      // Only the last note of a phrase resolves to the root.
      S.phase = 'feedback';
      const wait = S.settings.resolve === 'on' ? playResolution(d, fromMic, pos) : 0;
      timer = setTimeout(advance, CORRECT_DELAY + wait);
    }
  } else {
    S.phase = 'retry';
    S.states = { ...S.states, [d]: 'wrong' };
  }
  render();
}

/**
 * Play the answered note walking stepwise to the nearest root, one quarter note per step, lighting
 * one dot per step: the position nearest the previous one (the answered dot to start with).
 * A tapped answer already sounded as the first note; a mic answer is the player's own, so only
 * the steps after it are played. Returns the ms the walk adds after the answer. The notes are
 * scheduled voices, so quietAt() keeps the mic from hearing them; advance() and stopAll() cut them.
 */
function playResolution(d, fromMic, pos) {
  const path = resolutionOf(d, S.ctx.mode, S.ctx.tonic);
  S.resolution = path;
  if (path.length < 2 || !ensureAudio()) return 0;
  const place = placePosition(S.ctx.positionId, S.ctx.keyPc);
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
  const score = S.answers.filter(roundOk).length;
  const { progress, newBest } = recordBest(S.progress, level().id, score);
  S.progress = progress;
  saveProgress(progress);
  if (S.session) return sessionAdvance(score);
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

// ---------- passive listening ----------

const LISTEN_NEXT = 1.6; // seconds of quiet after the answer before the next round
const canSpeak = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
let lsCancels = []; // cancel functions of the pending callAt()s
let lsToken = 0; // bumped on every clear, so a late speech `end` event of an old round does nothing
let wakeLock = null;

/** Settings as listening sees them: the mic is never on here. */
const listenRef = () => ({ ...S.settings, mic: false });
const lsAt = (when, fn) => { lsCancels.push(callAt(when, fn)); };
/** The notes as words to speak: letter names if those are the labels, else root, second, flat third … */
const spokenNames = (seq) => seq.map((d) => (S.settings.labels === 'letters' ? spoken(letterName(d, S.ctx.keyPc, S.ctx.mode)) : degreeWord(d))).join(', ');

function lsClear() {
  lsCancels.forEach((c) => c());
  lsCancels = [];
  lsToken++;
  if (canSpeak()) speechSynthesis.cancel();
}

/** Keep the screen on while listening, so the phone can lie on the music stand. */
async function holdScreen(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      const lock = await navigator.wakeLock.request('screen');
      if (!S.ls || S.ls.paused) { lock.release(); return; }
      wakeLock = lock;
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
    } else if (!on && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch { /* not supported or refused */ }
}

/** Speak `text`, then call `then` (also if speech fails or its end event never comes). */
function say(text, then) {
  const tok = lsToken;
  let done = false;
  const next = () => { if (!done && tok === lsToken) { done = true; then(); } };
  if (!canSpeak()) return next();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9;
  u.onend = next;
  u.onerror = next;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  lsAt(now() + 2 + text.split(/\s+/).length * 0.6, next);
}

function startListen() {
  if (!ensureAudio()) return;
  S.ls = { n: 0, phase: 'prompt', paused: false };
  S.deck = [];
  S.round = -1;
  go('listen');
  holdScreen(true);
  listenRound();
}

function listenStop() {
  if (!S.ls) return;
  lsClear();
  holdScreen(false);
  S.ls = null;
}

/**
 * One round: the reference, then the note(s), then the chosen pause, then the answer. The deck is
 * dealt like a normal level and dealt again when used up.
 */
function listenRound() {
  lsClear();
  stopAll();
  const ls = S.ls;
  S.round++;
  if (S.round >= S.deck.length) { S.deck = makeDeck(S.settings.adaptive === 'on'); S.round = 0; }
  ls.n++;
  ls.phase = 'prompt';
  S.states = {};
  S.posStates = {};
  S.resolution = [];
  render();
  if (!ensureAudio()) return;
  const seq = targets();
  const gap = Number(S.settings.listenGap);
  const think = (at) => {
    lsAt(at, () => { ls.phase = 'think'; render(); });
    lsAt(at + gap, listenReveal);
  };
  think(playPhrase(playReference(referenceFor(listenRef(), ls.n - 1), S.ctx.tonic, S.ctx.cadence.chords)));
}

/** The answer: its name spoken (if chosen), then the note(s) again walking to the root, then the next round. */
function listenReveal() {
  const seq = targets();
  stopAll(); // ends a drone
  S.ls.phase = 'reveal';
  S.resolution = S.settings.resolve === 'on' ? resolutionOf(seq[seq.length - 1], S.ctx.mode, S.ctx.tonic) : [];
  S.states = Object.fromEntries(seq.map((d) => [d, 'correct']));
  render();
  const play = () => {
    const path = S.resolution.length ? S.resolution : [seq[seq.length - 1]];
    const { notes, end } = revealTimeline(seq, path, PHRASE_STEP, RESOLVE_STEP);
    const t0 = now() + 0.05;
    for (const { note, t } of notes) playNote(midiOfNote(note), t0 + t);
    lsAt(t0 + end + LISTEN_NEXT, listenRound);
  };
  if (S.settings.listenSpeak === 'on') say(spokenNames(seq), play);
  else play();
}

function listenPause() {
  const ls = S.ls;
  if (!ls) return;
  if (ls.paused) {
    ls.paused = false;
    holdScreen(true);
    S.round--; // replay the interrupted round
    ls.n--;
    listenRound();
  } else {
    ls.paused = true;
    lsClear();
    stopAll();
    holdScreen(false);
    render();
  }
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
  menu: () => go('menu'),
  settings: () => go('settings'),
  practise: () => startSession(),
  stats: () => { S.stats = { agg: loadStats(), log: loadLog(), now: Date.now() }; go('stats'); },
  levels: () => go('levels'),
  stage: (arg) => { S.stage = Number(arg); go('levels'); },
  pathnext: () => {
    const l = nextLevel(S.progress);
    if (l) openLevel(l.idx);
  },
  level: (arg) => openLevel(Number(arg)),
  key: (arg) => { S.keyPc = Number(arg); saveKey(S.keyPc); render(); },
  position: (arg) => setPosition(arg),
  start: () => startLevel(),
  explore: () => go('explore'),
  listen: () => startListen(),
  listenpause: () => listenPause(),
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
    const n = levelAfter(level());
    if (n) openLevel(n.idx);
  },
  set: (arg) => {
    const [key, value] = arg.split(':');
    S.settings = { ...S.settings, [key]: value };
    saveSettings(S.settings);
    if (key === 'sound') {
      setSound(value);
      if (ensureAudio()) prerender([...levelMidis(), ...cadenceMidis()]);
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
    else if (S.screen === 'listen') listenPause();
    else if (S.screen === 'results') {
      if (S.result.passed && levelAfter(level())) ACTIONS.next();
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
  document.addEventListener('visibilitychange', () => {
    if (S.ls && !S.ls.paused && document.visibilityState === 'visible') holdScreen(true); // the browser drops the wake lock when the page is hidden
    render();
  });
  render();
}
