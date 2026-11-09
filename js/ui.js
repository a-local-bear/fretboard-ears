// App state, screens and input handling. Full re-render via innerHTML, skipped when nothing changed.

import {
  OPEN, SCALES, MIN_MIDI, MAX_MIDI, CHAPTERS, ROUNDS, PASS_SCORE, FAMILIES, noteColor, solfegeName, letterName, keyName, keyLetter, degreeIndex,
  chapterById, levelsFor, buildContext, pickKey, placeChapter, positionsOf, resolutionOf, cadenceFor, newestOf,
} from './data.js';
import { buildDeck } from './deck.js';
import { buildSequenceDeck } from './phrase.js';
import { noteWeights, buildAdaptiveDeckFor } from './adaptive.js';
import { planSession, blockLabel } from './session.js';
import {
  isPassed, bestScore, recordScore, recordBest, nextLevel, playedCount,
} from './progress.js';
import {
  loadSettings, saveSettings, loadProgress, saveProgress, loadKey, saveKey, appendLog, requestPersistence,
  loadStats, loadLog, loadBacking, saveBacking, loadGuides, saveGuides,
} from './storage.js';
import { STAGES, STEPS, levelOf, drillOf, stepOf, stepDone, nextStep, pathCount, guideById, guideParagraphs } from './path.js';
import { DRILLS, DRILL_GROUPS, TONIC_LABELS, drillById, buildDrillDeck, tuneDrill } from './drills.js';
import {
  TUNES, PROGRESSIONS, tuneById, progressionById, tuneNotes, tunePhrases, tuneChords, tuneTonic, fitTonic, degName, degColor,
} from './songs.js';
import { loopEvents, cycleSeconds } from './sequencer.js';
import {
  streaks, heatmap, totals, degreeAccuracy, topConfusions, triesAfterMiss, avgResponseMs, trend,
} from './stats.js';
import { progressHTML } from './charts.js';
import {
  ensureAudio, prerender, playNote, playReference, playOver, playArpeggio, startLoop, stopLoop, loopActive, stopAll, droneActive, now, setSound, setNoteLimit, quietAt, callAt,
  strumChord, playChords, playMelody,
} from './audio.js';
import { GAP_OPTIONS, spoken, revealTimeline } from './listen.js';
import { fretboardSVG } from './fretboard.js';
import { startMic, stopMic, micActive, micSupported, setVoice } from './mic.js';
import { matchDegree, SHARP_NAMES, VoiceHold, voiceCue, VOICE } from './pitch.js';
import { referenceFor } from './reference.js';
import {
  chordsFor, chordByNumeral, chordName, chordPcs, voicing, pickOverChord, convertSlots, PRESETS, presetLabel,
  MIN_SLOTS, MAX_SLOTS, TEMPO_RANGE, BARS_OPTIONS,
} from './harmony.js';

const CORRECT_DELAY = 1100;
const PHRASE_STEP = 0.6; // seconds between the notes of a phrase
const RESOLVE_STEP = 0.75; // seconds per quarter note of the resolution (80 bpm)
const MIC_NOTE_LIMIT = 1.6; // seconds the app's notes may ring while the mic listens
const VERTICAL_BELOW = 640;

const S = {
  screen: 'home', // home | levels | explore | play | listen | results | settings | stats | backing | path | guide | drills | drill | songbook | tune | prog
  chapterId: 'one',
  level: 0, // index into levelsFor(chapterId)
  keyPc: loadKey(), // tonic of the fixed-key levels (0 = C … 11 = B)
  ctx: null, // buildContext() of the level being explored or played: key, mode, pool, positions
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
  overChord: null, // the chord (harmony.js) the current mystery note sounds over, or null
  noteMs: null, // ms from the mystery note sounding to the first tap (null if unknown)
  stats: null, // snapshot for the stats screen, taken when it opens
  result: null, // { score, newBest, passed }
  confirmReset: false,
  session: null, // daily practice: { plan, i, scores: [{ label, name, score }], streak?, done? } while one is running
  ls: null, // passive listening: { n (rounds played), phase: prompt | think | reveal, paused } while it runs
  sg: null, // sing-and-find: { pos (note being sung), fails, aided (heard it this note), first[] (sung first try, per note), note (hint) }
  mic: 'off', // off | starting | on | blocked (runtime state; the wish to use it is settings.mic)
  bt: { ...loadBacking(), playing: false, cur: null, sel: 0, flash: null }, // backing track: saved fields + runtime state
  guides: loadGuides(), // ids of the path guides marked done
  guideId: null, // the guide open on the guide screen
  dr: null, // ear drill: { drill, back, phase: intro | listen | retry | feedback | done, deck, round, answers, pos, states, pick (auditioned key), fresh, tonic (MIDI of Do), result }
  sb: { kind: 'tune', id: TUNES[0].id, key: 0, show: false, back: 'songbook' }, // the songbook page open: a tune or a progression
  btBack: 'home', // where the backing track's back button goes (a guide opens it with its loop)
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
/** The note ids to find this round: a phrase (an array), or a single note as a one-element array. */
const targets = () => [].concat(S.deck[S.round]);
/** A round is right only if every note was right on the first try. */
const roundOk = (a) => a.notes.length === a.len && a.notes.every((n) => n.heard === n.answered);
const roundBad = (a) => a.notes.some((n) => n.heard !== n.answered);
const singLevel = () => S.ctx != null && level().family === 'sing';
/** Settings as the reference sees them: singing always uses the mic (so no drone, which it would hear) and plays no note over a chord. */
const refSettings = () => (singLevel() ? { ...S.settings, mic: true, over: 'off' } : S.settings);
/** No usable microphone for singing: unsupported here or refused. The player self-checks instead. */
const singSelf = () => !micSupported() || S.mic === 'blocked';
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
  lastVoice = '';
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
  frame: S.ctx.frame, labelOf: noteText, nameOf: solfegeName, hidden: S.settings.labels === 'hidden',
  vertical: S.vertical, ...opts,
});

const MIC_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

function micBar() {
  if (singLevel()) {
    // Singing needs the mic whatever the setting says, so there is no toggle, only the state.
    const label = S.mic === 'on' ? 'Listening' : S.mic === 'blocked' ? 'Mic blocked' : micSupported() ? 'Starting mic…' : 'No mic';
    return `<div class="micbar"><span class="micstate ${S.mic === 'on' ? 'on' : ''}">${MIC_ICON}<span>${label}</span></span><span class="hearing" id="hearing"></span></div>`;
  }
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
  const r = referenceFor(refSettings(), 0);
  return r === 'do' ? 'Hear Do' : r === 'drone' ? 'Hear drone' : 'Hear key';
};

const SCREENS = {
  home() {
    return `${topbar('Fretboard Ears')}
    <main class="screen home">
      <p class="lede">Hear a note in a key, then find it on the neck.</p>
      ${nextUpHTML()}
      <div class="actions">${btn('practise', 'Daily practice', 'primary')}</div>
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
      <h2 class="sub">Beyond single notes</h2>
      <ol class="chapters">
        <li><button class="chapter" data-action="drills" data-focus-key="drills">
          <span class="cnum">♪</span>
          <span class="cbody"><span class="cname">Ear drills</span><span class="cdesc">Chords, progressions, and the key of a tune</span></span>
          <span class="cmeta">${DRILLS.filter((d) => S.progress.best[d.id] != null).length}/${DRILLS.length} played</span>
        </button></li>
        <li><button class="chapter" data-action="songbook" data-focus-key="songbook">
          <span class="cnum">♫</span>
          <span class="cbody"><span class="cname">Songbook</span><span class="cdesc">Tunes and progressions to learn by ear</span></span>
          <span class="cmeta">${TUNES.length} tunes</span>
        </button></li>
      </ol>
      <div class="actions">${btn('path', 'Path', 'ghost')}${btn('backing', 'Backing track', 'ghost')}${btn('stats', 'Practice stats', 'ghost')}</div>
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
    const newest = level().grow != null ? newestOf(level(), ds) : ds[ds.length - 1];
    const intro = level().grow != null
      ? `New note: <b>${coloredName(newest, solfegeName(newest))}</b>${S.settings.labels === 'letters' ? ` (${coloredName(newest, letterName(newest, S.ctx.keyPc, S.ctx.mode))})` : ''}.`
      : `${ds.length} notes, ${ds.length > 8 ? 'from ' : ''}<b>${noteName(ds[0])}</b> to <b>${noteName(newest)}</b>.`;
    if (singLevel()) {
      const blocked = S.mic === 'blocked'
        ? 'The microphone is blocked, so the app cannot hear you sing. Allow it for this site in your browser settings, then try again, or use self-check below.'
        : !micSupported() ? 'The microphone is not available here (it needs a secure https page and a browser that allows it).' : '';
      return `${topbar(esc(level().name), 'levels', esc(chapter().name))}
    <main class="screen explore">
      <p class="keyline">${esc(keyLabel())}</p>
      ${pathTip()}
      <p class="lede">${intro} Each round shows ${level().len > 1 ? `${level().len} notes` : 'a note'} as text and plays none. <b>Sing</b> ${level().len > 1 ? 'them one by one' : 'it'} (any octave), then <b>find</b> ${level().len > 1 ? 'them' : 'it'} on the neck by tapping or playing. Tap the dots to hear each note first.</p>
      ${micBar()}
      ${blocked ? `<p class="micnote">${blocked}</p><p class="lede"><b>Self-check:</b> sing the note, tap Hear it to compare, then mark yourself right or wrong. Nothing is detected, so it is on your honour.</p>${S.mic === 'blocked' ? `<div class="actions">${btn('micretry', 'Try the mic again', 'ghost')}</div>` : ''}` : ''}
      <div class="boardwrap">${board({ states: S.states })}</div>
      <div class="actions">
        ${btn('reference', refLabel(), 'ghost')}
        ${canSpeak() ? btn('listen', 'Listen hands-free', 'ghost') : ''}
        ${btn('start', blocked ? 'Start with self-check' : 'Start', 'primary')}
      </div>
    </main>`;
    }
    const phrase = level().len > 1 ? `Each round plays ${level().len} notes in a row: play them back one by one, in order.` : '';
    const where = S.ctx.positions.get(newest).length > 1 ? 'Every position of a note counts as that note.' : '';
    return `${topbar(esc(level().name), 'levels', esc(chapter().name))}
    <main class="screen explore">
      <p class="keyline">${esc(keyLabel())}</p>
      ${pathTip()}
      <p class="lede">${intro} ${where} ${phrase} ${S.mic === 'on' ? 'Tap the dots to hear each one, or play them to check the mic hears you' : 'Tap the dots to hear each one'}, then start.</p>
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
      if (S.phase === 'sing') return `<i class="${S.sg.first[i] === true ? 'ok' : S.sg.first[i] === false ? 'bad' : i === S.sg.pos ? 'now' : ''}"></i>`;
      const cls = n ? (n.heard === n.answered ? 'ok' : 'bad') : i === S.pos && S.phase !== 'feedback' ? 'now' : '';
      return `<i class="${cls}"></i>`;
    }).join('')}</div>`;
    return `${topbar(esc(level().name), S.session ? 'home' : 'levels', esc(chapter().name))}
    <main class="screen play">
      ${S.session ? `<p class="keyline">${esc(blockLabel(S.session.i, S.session.plan))}</p>` : ''}
      <div class="roundbar" aria-label="Round ${Math.min(S.round + 1, ROUNDS)} of ${ROUNDS}, ${score} correct">
        <span class="pips">${pips}</span>
        <span class="count">${Math.min(S.round + 1, ROUNDS)}/${ROUNDS}</span>
      </div>
      ${notePips}
      ${singLevel() ? targetHTML() : ''}
      <p class="prompt">${promptText()}</p>
      ${singLevel() && S.phase === 'sing' && !singSelf() ? '<p class="voicelive" id="voicelive"></p>' : ''}
      ${micBar()}
      <div class="boardwrap">${board({ states: S.states, posStates: S.posStates, disabled: S.phase === 'feedback' || S.phase === 'sing' })}</div>
      <div class="actions">
        ${btn('reference', refLabel(), 'ghost')}
        ${btn('replay', singLevel() && S.phase === 'sing' ? 'Hear it' : 'Replay', singLevel() && S.phase === 'sing' && singSelf() ? 'ghost' : 'primary')}
        ${singLevel() && S.phase === 'sing' && singSelf() ? `${btn('selfno', 'Missed it', 'ghost')}${btn('selfyes', 'Got it', 'primary')}` : ''}
      </div>
    </main>`;
  },

  listen() {
    const ls = S.ls;
    const seq = targets();
    const sing = singLevel();
    const names = seq.map(noteName).join(' → ');
    const many = seq.length > 1;
    let text;
    if (ls.paused) text = 'Paused.';
    else if (ls.phase === 'prompt') text = sing ? `Sing ${names}.` : many ? `Listen to the ${seq.length} notes…` : 'Listen…';
    else if (ls.phase === 'think') text = sing ? `Sing ${names}, then play ${many ? 'them' : 'it'}.` : `Your turn: play ${many ? 'them' : 'it'} on the guitar.`;
    else {
      const rest = S.resolution.length > 1 ? ` → ${S.resolution.slice(1).map(noteName).join(' → ')}` : '';
      text = `${sing ? 'Sounds like' : 'It was'} ${names}${rest}`;
    }
    const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, label]) =>
      `<button role="radio" aria-checked="${S.settings[key] === v}" class="${S.settings[key] === v ? 'on' : ''}" data-action="set" data-arg="${key}:${v}" data-focus-key="set-${key}-${v}">${label}</button>`).join('')}</div>`;
    return `${topbar(esc(level().name), 'explore', esc(chapter().name))}
    <main class="screen play listen">
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
        ${sing ? '' : `<span class="keylabel">Say the answer</span>${seg('listenSpeak', [['on', 'On'], ['off', 'Off']])}`}
        <p class="hint">Plays the level on its own: ${{ cadence: 'the cadence, ', do: 'Do, ', drone: 'the drone, ', none: '' }[referenceFor(listenRef(), 0)]}the ${sing ? 'note to sing, spoken' : many ? 'notes' : 'note'}, a pause for you to play ${many ? 'them' : 'it'}, then the answer${S.settings.resolve === 'on' ? ' resolving to Do' : ''}. The screen stays on; you don't need to look at it.</p>
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
    const nxt = nextLevel(S.chapterId, S.level);
    const canNext = !!nxt;
    // On the path and moved past this level: point at the next step.
    const step = STEPS.some((st) => st.kind === 'level' && st.id === level().id) ? nextStep(S.progress, S.guides) : null;
    const onPath = step != null && step.id !== level().id;
    return `${topbar(esc(level().name), 'levels', esc(chapter().name))}
    <main class="screen results">
      <p class="keyline">${esc(keyLabel())}</p>
      <div class="scorecard ${passed ? 'pass' : 'fail'}">
        <p class="big"><b>${score}</b>/${ROUNDS}</p>
        <p class="verdict">${score === ROUNDS ? 'Perfect.' : passed ? 'Well done.' : 'Keep practising.'}</p>
        ${newBest ? '<p class="newbest">New best</p>' : ''}
      </div>
      ${singLevel() ? singSummary() : ''}
      ${confusions ? `<h2 class="sub">Mix-ups</h2><ul class="confusions">${confusions}</ul>` : ''}
      <div class="actions">
        ${btn('levels', 'Levels', 'ghost')}
        ${btn('retry', 'Retry', canNext || onPath ? 'ghost' : 'primary')}
        ${onPath ? btn('pathnext', 'Continue path', 'primary') : canNext ? btn('next', 'Next level', 'primary') : ''}
      </div>
      ${onPath ? `<p class="hint pathhint">Next on your path: <b>${esc(stepName(step))}</b></p>` : ''}
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
      <section class="progress"><h2 class="sub">Progress</h2>${progressHTML(agg, at)}</section>
    </main>`;
  },

  backing() {
    const b = S.bt;
    const chords = btChords();
    const keys = Array.from({ length: 12 }, (_, pc) => `<button class="keychip ${pc === b.key ? 'on' : ''}" data-action="btkey" data-arg="${pc}" data-focus-key="btkey-${pc}" aria-pressed="${pc === b.key}">${esc(keyLetter(pc, b.mode))}</button>`).join('');
    const opts = (action, list, cur) => `<div class="seg" role="radiogroup">${list.map(([v, label]) =>
      `<button role="radio" aria-checked="${cur === v}" class="${cur === v ? 'on' : ''}" data-action="${action}" data-arg="${v}" data-focus-key="${action}-${v}">${label}</button>`).join('')}</div>`;
    const sel = chords[b.sel];
    return `${topbar('Backing track', S.btBack)}
    <main class="screen backing">
      <div class="keybar"><span class="keylabel" id="keylabel">Key</span><div class="keychips" role="group" aria-labelledby="keylabel">${keys}</div>
        ${opts('btmode', [['major', 'Major'], ['minor', 'Minor']], b.mode)}</div>
      <section class="btsec"><h2 class="sub">Progression</h2>
        <div class="slots" id="bt-slots">${chords.map((c, i) => `<button class="slot ${i === b.sel ? 'sel' : ''} ${b.playing && b.cur === i ? 'now' : ''}" data-action="btslot" data-arg="${i}" data-focus-key="btslot-${i}" aria-pressed="${i === b.sel}">
            <span class="snum">${esc(c.numeral)}</span>${coloredName(c.root, chordName(c, b.key, b.mode))}</button>`).join('')}</div>
        <div class="slotctl">
          ${btn('btadd', '+ Chord', 'ghost small')}${btn('btdel', '− Remove', 'ghost small')}
        </div>
        <span class="keylabel">Chord for slot ${b.sel + 1}</span>
        <div class="chordpal" role="group" aria-label="Chord for slot ${b.sel + 1}">${chordsFor(b.mode).map((c) =>
          `<button class="chordpick ${c.numeral === sel.numeral ? 'on' : ''}" data-action="btchord" data-arg="${esc(c.numeral)}" data-focus-key="btchord-${esc(c.numeral)}" aria-pressed="${c.numeral === sel.numeral}"><span class="snum">${esc(c.numeral)}</span>${coloredName(c.root, chordName(c, b.key, b.mode))}</button>`).join('')}</div>
        <span class="keylabel">Presets</span>
        <div class="presets">${PRESETS[b.mode].map((p, i) => `<button class="preset" data-action="btpreset" data-arg="${i}" data-focus-key="btpreset-${i}">${esc(presetLabel(p))}</button>`).join('')}</div>
      </section>
      <section class="btsec"><h2 class="sub">Tempo</h2>
        <label class="tempo"><span class="keylabel"><span id="tempoval">${b.tempo}</span> bpm</span>
          <input type="range" min="${TEMPO_RANGE[0]}" max="${TEMPO_RANGE[1]}" step="1" value="${b.tempo}" data-range="tempo" aria-label="Tempo in beats per minute"></label>
        <span class="keylabel">Bars per chord</span>
        ${opts('btbars', BARS_OPTIONS.map((n) => [String(n), String(n)]), String(b.bars))}
      </section>
      <p class="btnow" id="bt-now">${btNowHTML()}</p>
      <div class="boardwrap" id="bt-board">${btBoard()}</div>
      <div class="actions">${btn('btplay', b.playing ? 'Stop' : 'Play', 'primary')}</div>
    </main>`;
  },

  path() {
    const nx = nextStep(S.progress, S.guides);
    const { done, total } = pathCount(S.progress, S.guides);
    let n = 0;
    return `${topbar('Path', 'home')}
    <main class="screen path">
      <div class="prose"><p>A suggested order through the app, from your first four notes to learning whole songs by ear. Each stage mixes note levels and ear drills, and ends with a guide that shows how to use what you learned on your guitar. A level or drill counts once you score ${PASS_SCORE}/${ROUNDS}.</p>
        <p>By the end you can find the key of a song, follow its chords, take down its melody in solfège, sing it and play it, in any key and anywhere on the neck.</p></div>
      <p class="keyline">${done}/${total} steps done</p>
      ${STAGES.map((st, si) => `<section class="family">
        <h2 class="sub">${si + 1} · ${esc(st.name)}</h2>
        <p class="hint stagedesc"><b>${esc(st.desc)}</b> ${esc(st.about)}</p>
        <ol class="steps">${st.steps.map(() => {
          const step = STEPS[n++];
          const ok = stepDone(step, S.progress, S.guides);
          const now = step === nx;
          const best = step.kind !== 'guide' ? S.progress.best[step.id] : null;
          const meta = step.kind === 'guide' ? (ok ? 'Done' : 'Guide') : best == null ? 'Not played' : `Best ${best}/${ROUNDS}`;
          return `<li><button class="step ${step.kind} ${ok ? 'done' : ''} ${now ? 'now' : ''}" data-action="pathstep" data-arg="${step.n}" data-focus-key="step-${step.n}"${now ? ' aria-current="step"' : ''}>
            <span class="smark" aria-hidden="true">${ok ? '✓' : now ? '▶' : step.kind === 'guide' ? '◆' : step.kind === 'drill' ? '♪' : '·'}</span>
            <span class="cbody"><span class="sname">${esc(stepName(step))}</span>${step.kind === 'level' ? `<span class="cdesc">${esc(chapterById(levelOf(step).chapterId).name)}</span>` : step.kind === 'drill' ? '<span class="cdesc">Ear drill</span>' : ''}${step.tip ? `<span class="stip">${esc(step.tip)}</span>` : ''}</span>
            <span class="cmeta">${now ? 'Next' : meta}</span>
          </button></li>`;
        }).join('')}</ol>
      </section>`).join('')}
    </main>`;
  },

  guide() {
    const g = guideById(S.guideId);
    const ok = S.guides.includes(g.id);
    const loop = g.loop;
    const chords = loop ? loop.slots.map((num) => {
      const c = chordByNumeral(loop.mode, num);
      return `<span class="slot"><span class="snum">${esc(num)}</span>${coloredName(c.root, chordName(c, loop.key, loop.mode))}</span>`;
    }).join('') : '';
    return `${topbar(esc(g.title), 'path', `Guide · stage ${g.stage + 1}`)}
    <main class="screen guide">
      <div class="prose">${guideParagraphs(g).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      ${loop ? `<section class="btsec"><h2 class="sub">The loop</h2>
        <div class="slots">${chords}</div>
        <p class="hint">${esc(keyName(loop.key, loop.mode))} · ${loop.tempo} bpm · ${loop.bars} bar${loop.bars > 1 ? 's' : ''} per chord</p>
        <div class="actions">${btn('guideloop', 'Play this loop', 'ghost')}</div>
      </section>` : ''}
      ${g.examples ? `<section class="btsec"><h2 class="sub">From the songbook</h2>
        <div class="examples">${(g.examples.tunes || []).map((id) => `<button class="preset" data-action="sbtune" data-arg="${id}" data-focus-key="ex-${id}">♫ ${esc(tuneById(id).title)}</button>`).join('')}${(g.examples.progs || []).map((id) => {
          const p = progressionById(id);
          return `<button class="preset" data-action="sbprog" data-arg="${id}" data-focus-key="ex-${id}">${esc(p.name)} <span class="snum">${p.slots.length > 4 ? '12 bars' : esc(p.slots.join(' '))}</span></button>`;
        }).join('')}</div>
        <p class="hint">Open one, play it, and work it out on your guitar before you reveal it.</p>
      </section>` : ''}
      <section class="tries"><h2 class="sub">Things to try</h2>
        <ol>${g.tries.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
        <p class="hint">Spend a few minutes on each, as long as it's fun. There is no score: mark it done when you've tried them all.</p>
      </section>
      <div class="actions">
        ${ok ? btn('guideundo', 'Mark not done', 'ghost') : ''}
        ${btn('guidedone', ok ? 'Continue path' : 'Done, continue', 'primary')}
      </div>
    </main>`;
  },

  drills() {
    return `${topbar('Ear drills', 'home')}
    <main class="screen levels">
      <p class="lede">Chords, progressions, the key of a tune, and phrases of real songs. Each drill is ${ROUNDS} rounds in a new key every time; ${PASS_SCORE} right passes it.</p>
      ${DRILL_GROUPS.map((g) => `<section class="family">
        <h2 class="sub">${esc(g.name)}</h2>
        <p class="hint">${esc(g.desc)}</p>
        <ol class="levelgrid">${DRILLS.filter((d) => d.group === g.id).map((d) => {
          const best = S.progress.best[d.id];
          return `<li><button class="levelcard ${best != null && isPassed(best) ? 'passed' : ''}" data-action="drill" data-arg="${d.id}" data-focus-key="drill-${d.id}">
            <span class="dname">${esc(d.name)}</span>
            <span class="lbest">${best == null ? 'Not played' : `Best ${best}/${ROUNDS}`}</span>
          </button></li>`;
        }).join('')}</ol>
      </section>`).join('')}
      <div class="actions">${btn('songbook', 'Songbook', 'ghost')}</div>
    </main>`;
  },

  drill() {
    const dr = S.dr;
    const d = dr.drill;
    const top = topbar(esc(d.name), dr.back, d.single ? 'Songbook' : 'Ear drill');
    if (dr.phase === 'intro') {
      const best = d.single ? null : S.progress.best[d.id];
      const tip = stepOf(d.id)?.tip;
      return `${top}
    <main class="screen drill">
      <div class="prose">${d.about.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      ${tip ? `<p class="hint pathtip"><b>On the path:</b> ${esc(tip)}</p>` : ''}
      ${best != null ? `<p class="keyline">Best ${best}/${ROUNDS}</p>` : ''}
      <div class="actions">${btn('drstart', 'Start', 'primary')}</div>
    </main>`;
    }
    if (dr.phase === 'done') return `${top}<main class="screen results">${drResultsHTML()}</main>`;
    const r = drRound();
    const score = dr.answers.filter(roundOk).length;
    const pips = Array.from({ length: ROUNDS }, (_, i) => {
      const a = dr.answers[i];
      return `<i class="${a ? (roundOk(a) ? 'ok' : roundBad(a) ? 'bad' : 'now') : i === dr.round ? 'now' : ''}"></i>`;
    }).join('');
    return `${top}
    <main class="screen play drill">
      <div class="roundbar" aria-label="Round ${dr.round + 1} of ${ROUNDS}, ${score} correct">
        <span class="pips">${pips}</span>
        <span class="count">${dr.round + 1}/${ROUNDS}</span>
      </div>
      <p class="prompt" aria-live="polite">${drPrompt()}</p>
      ${drSlotsHTML()}
      ${drChoicesHTML()}
      <div class="actions">
        ${btn('drplay', 'Replay', r.audition ? 'ghost' : 'primary')}
        ${r.audition ? btn('drcommit', 'That\'s home', 'primary', '', dr.pick == null || dr.phase === 'feedback') : ''}
        ${dr.phase === 'feedback' ? btn('drnext', 'Next', 'ghost') : ''}
      </div>
    </main>`;
  },

  songbook() {
    return `${topbar('Songbook', 'home')}
    <main class="screen songbook">
      <p class="lede">Tunes and chord progressions to learn by ear, in any key. Open one, press Play, and work it out on your guitar before you reveal the notes.</p>
      <section class="family"><h2 class="sub">Tunes</h2>
        <ol class="chapters">${TUNES.map((t) => `<li><button class="chapter" data-action="sbtune" data-arg="${t.id}" data-focus-key="sbtune-${t.id}">
          <span class="cnum">${t.mode === 'minor' ? 'min' : 'maj'}</span>
          <span class="cbody"><span class="cname">${esc(t.title)}</span><span class="cdesc">${esc(t.about.split('. ')[0])}.</span></span>
          <span class="cmeta">${tunePhrases(t).length} phrases</span>
        </button></li>`).join('')}</ol>
      </section>
      <section class="family"><h2 class="sub">Progressions</h2>
        <ol class="chapters">${PROGRESSIONS.map((p) => `<li><button class="chapter" data-action="sbprog" data-arg="${p.id}" data-focus-key="sbprog-${p.id}">
          <span class="cnum">${p.mode === 'minor' ? 'min' : 'maj'}</span>
          <span class="cbody"><span class="cname">${esc(p.name)}</span><span class="cdesc">${p.slots.length > 4 ? '12 bars of I, IV and V' : esc(p.slots.join(' – '))}</span></span>
          <span class="cmeta"></span>
        </button></li>`).join('')}</ol>
      </section>
    </main>`;
  },

  tune() {
    const t = tuneById(S.sb.id);
    const { key, show } = S.sb;
    const bars = t.chords.map((bar, i) => `<span class="bar">${bar.split(/\s+/).map((n) => {
      const c = chordByNumeral(t.mode, n);
      return `<span class="bchord"><span class="snum">${esc(n)}</span>${coloredName(c.root, chordName(c, key, t.mode))}</span>`;
    }).join('')}<span class="bnum">${i + 1}</span></span>`).join('');
    const phrases = tunePhrases(t).map((ph, i) => `<li><button class="phrasebtn" data-action="sbphrase" data-arg="${i}" data-focus-key="sbphrase-${i}" aria-label="Play phrase ${i + 1}">▶</button>
      <span class="pnotes">${show ? ph.map((n) => tuneNoteHTML(n.o, key, t.mode)).join(' ') : ph.map(() => '<i class="pdot"></i>').join('')}</span></li>`).join('');
    return `${topbar(esc(t.title), S.sb.back, 'Songbook')}
    <main class="screen tune">
      <p class="lede">${esc(t.about)}</p>
      <div class="keybar"><span class="keylabel" id="keylabel">Key · ${esc(keyName(key, t.mode))}</span><div class="keychips" role="group" aria-labelledby="keylabel">${sbKeys(t.mode)}</div></div>
      <div class="actions">
        ${btn('sbplay', 'Play', 'primary')}${btn('sbmelody', 'Melody only', 'ghost')}${btn('sbchords', 'Chords only', 'ghost')}${btn('sbstop', 'Stop', 'ghost')}
      </div>
      <section class="btsec"><h2 class="sub">Melody</h2>
        <p class="hint">${show ? 'Tap ▶ to hear a phrase on its own.' : 'Try it first: find Do on your guitar, then work out each phrase by ear. Tap ▶ to hear one phrase, and reveal the notes to check.'}</p>
        <ol class="phrases">${phrases}</ol>
        <div class="actions">${btn('sbshow', show ? 'Hide notes' : 'Show notes', 'ghost')}${btn('sbpractise', 'Practise its phrases', 'ghost')}</div>
      </section>
      <section class="btsec"><h2 class="sub">Chords, one box per bar</h2>
        <div class="tunebars">${bars}</div>
        <p class="hint">${t.meter} beats per bar${t.pickup ? `, starting with ${t.pickup === 1 ? 'one beat' : `${t.pickup} beats`} before the first bar` : ''}. Strum each chord as it arrives while you sing the melody.</p>
      </section>
    </main>`;
  },

  prog() {
    const p = progressionById(S.sb.id);
    const { key } = S.sb;
    const slots = p.slots.map((n) => {
      const c = chordByNumeral(p.mode, n);
      return `<span class="slot"><span class="snum">${esc(n)}</span>${coloredName(c.root, chordName(c, key, p.mode))}</span>`;
    }).join('');
    return `${topbar(esc(p.name), S.sb.back, 'Songbook')}
    <main class="screen guide prog">
      <p class="lede">${esc(p.about)}</p>
      <div class="keybar"><span class="keylabel" id="keylabel">Key · ${esc(keyName(key, p.mode))}</span><div class="keychips" role="group" aria-labelledby="keylabel">${sbKeys(p.mode)}</div></div>
      <section class="btsec"><h2 class="sub">The chords</h2>
        <div class="slots ${p.slots.length > 4 ? 'twelve' : ''}">${slots}</div>
        <p class="hint">Change the key and the chord names move; the numerals stay the same. That is why musicians talk about progressions in numerals.</p>
        <div class="actions">${btn('sbprogplay', 'Play', 'primary')}${p.slots.length <= 4 ? btn('sbalong', 'Loop it on the backing track', 'ghost') : ''}${btn('sbstop', 'Stop', 'ghost')}</div>
      </section>
      <section class="btsec"><h2 class="sub">Hear it in</h2>
        <ul class="songlist">${p.songs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        <p class="hint">Find a recording, find its home chord on your guitar, and play the progression along with it. The song may be in another key: move the key here until it matches.</p>
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
      <section><h2 class="sub">Adaptive practice</h2>${seg('adaptive', [['off', 'Off'], ['on', 'On']])}
        <p class="hint">On deals weak, slow and confused notes more often. Mastered notes still appear.</p></section>
      <section><h2 class="sub">Sound</h2>${seg('sound', [['guitar', 'Electric guitar'], ['synth', 'Synth']])}
        <p class="hint">Electric guitar uses recorded notes. Synth is the original plucked-string sound.</p></section>
      <section><h2 class="sub">Progress</h2>
        ${btn('reset', S.confirmReset ? 'Tap again to erase all scores' : 'Reset progress', S.confirmReset ? 'danger' : 'ghost')}</section>
    </main>`;
  },
};

/** A path step's short name: the level's title or the guide's. */
const stepName = (step) => (step.kind === 'guide' ? step.title : step.kind === 'drill' ? drillOf(step).name : levelOf(step).title);

/** On a level's explore screen: what its path step is for, when it is on the path. */
function pathTip() {
  const tip = S.ctx && stepOf(level().id)?.tip;
  return tip ? `<p class="hint pathtip"><b>On the path:</b> ${esc(tip)}</p>` : '';
}

/** Home: the next step of the path, one tap away. */
function nextUpHTML() {
  const nx = nextStep(S.progress, S.guides);
  const { total } = pathCount(S.progress, S.guides);
  if (!nx) {
    return `<button class="nextup" data-action="path" data-focus-key="nextup">
      <span class="keyline">Path complete · ${total}/${total}</span>
      <span class="sname">Keep going with daily practice</span></button>`;
  }
  const where = nx.kind === 'level' ? `${chapterById(levelOf(nx).chapterId).name} · ` : nx.kind === 'drill' ? 'Ear drill · ' : 'Guide · ';
  return `<button class="nextup" data-action="pathnext" data-focus-key="nextup">
      <span class="keyline">Next up · step ${nx.n + 1}/${total}</span>
      <span class="sname">${esc(stepName(nx))}</span>
      <span class="cdesc">${esc(where)}stage ${nx.stage + 1}, ${esc(STAGES[nx.stage].name)}</span></button>`;
}

/** Open a path step: a level's explore screen, or a guide. */
function openStep(step) {
  if (!step) return go('path');
  if (step.kind === 'guide') { S.guideId = step.id; return go('guide'); }
  if (step.kind === 'drill') return openDrill(drillOf(step), 'path');
  const l = levelOf(step);
  S.chapterId = l.chapterId;
  openLevel(l.idx);
}

/** The round's target as large coloured text; the note being sung or found is marked. */
function targetHTML() {
  const seq = targets();
  const at = S.phase === 'sing' ? S.sg.pos : S.pos;
  const names = seq.map((d, i) => `<span class="tnote ${S.phase === 'feedback' || i === at ? 'cur' : i < at ? 'past' : ''}">${noteName(d)}</span>`);
  return `<p class="target" aria-label="Target">${names.join('<span class="tsep"> → </span>')}</p>`;
}

function singSummary() {
  const notes = S.answers.flatMap((a) => a.notes).filter((n) => n.sung != null);
  const ok = notes.filter((n) => n.sung).length;
  return `<p class="keyline">Sung on the first try: <b>${ok}</b> of ${notes.length} notes</p>`;
}

function singPrompt() {
  const n = targets().length;
  const which = n > 1 ? ` note ${S.sg.pos + 1} of ${n}` : '';
  if (singSelf()) return `Sing${which}, tap Hear it to compare, then mark yourself.`;
  if (S.mic !== 'on') return 'Starting the microphone…';
  if (S.sg.note === 'again') return `Not quite. Sing${which} again.`;
  if (S.sg.note === 'heard') return `Listen, then sing${which} again.`;
  return `Sing${which}.`;
}

function promptText() {
  if (singLevel() && S.phase === 'sing') return singPrompt();
  const seq = targets();
  const a = S.answers[S.round];
  if (singLevel() && S.phase === 'listen') {
    const how = S.mic === 'on' ? 'Tap it or play it.' : 'Tap it.';
    return seq.length > 1 ? `Now find note ${S.pos + 1} of ${seq.length}. ${how}` : `Now find it on the neck. ${how}`;
  }
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
  btStop();
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
/** Every chord voicing of the level's key, when the mystery note may sound over a chord. */
const overMidis = () => (S.ctx && S.settings.over !== 'off' ? chordsFor(S.ctx.mode).flatMap((c) => voicing(c, S.ctx.keyPc)) : []);

function openLevel(index) {
  S.level = index;
  const { keyPc, mode } = pickKey(level(), S.keyPc);
  S.ctx = buildContext(S.chapterId, level(), keyPc, mode);
  go('explore');
  if (ensureAudio()) prerender([...levelMidis(), ...cadenceMidis(), ...overMidis()]);
}

/** The deck for the level in S.ctx: weighted by the player's stats when adaptive, else the plain rules. */
function makeDeck(adaptive) {
  const lv = level();
  if (adaptive) {
    const weights = noteWeights(loadStats(), degrees(), { log: loadLog() });
    return buildAdaptiveDeckFor(lv, degrees(), weights, ROUNDS, S.ctx.mode);
  }
  return lv.len > 1 ? buildSequenceDeck(lv, degrees(), ROUNDS, S.ctx.mode) : buildDeck(degrees(), ROUNDS, Math.random, lv.grow != null ? newestOf(lv, degrees()) : undefined);
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
  S.chapterId = b.chapterId;
  S.level = b.level;
  const { keyPc, mode } = pickKey(level(), b.keyPc ?? S.keyPc);
  S.ctx = buildContext(S.chapterId, level(), keyPc, mode);
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
  ss.scores.push({ label: ss.plan[ss.i].label, name: `${chapter().name} · ${level().name}`, score });
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
  if (singLevel()) {
    // Sing first: the cadence sets the key, the target is only shown, and nothing else is played.
    S.phase = 'sing';
    S.overChord = null;
    S.sg = { pos: 0, fails: 0, aided: false, first: [], note: '' };
    voiceHold.reset(targetPc(), -Infinity);
    render();
    if (ensureAudio()) playReference(referenceFor(refSettings(), S.round), S.ctx.tonic, S.ctx.cadence.chords);
    return;
  }
  render();
  if (!ensureAudio()) return;
  // With "note over a chord" on, a chord is struck after the reference and the phrase sounds over it.
  S.overChord = pickOverChord(S.settings.over, S.ctx.mode);
  const over = S.overChord && voicing(S.overChord, S.ctx.keyPc);
  // Response time counts from the last note of the phrase sounding.
  S.noteAt = playPhrase(playReference(referenceFor(S.settings, S.round), S.ctx.tonic, S.ctx.cadence.chords, { over }));
}

// ---------- sing and find ----------

const voiceHold = new VoiceHold();
const targetPc = () => (((midiOfNote(targets()[S.sg.pos]) % 12) + 12) % 12);
let lastVoice = '';

/** One analysis frame of the voice (fractional MIDI or null) while a note is being sung. */
function onVoiceFrame(midi, t) {
  if (S.screen !== 'play' || S.phase !== 'sing' || !S.sg) return;
  const r = voiceHold.push(midi, t);
  showVoice(midi, r);
  if (r.done) singAccepted();
  else if (r.failed) singMissed();
}

function showVoice(midi, r) {
  const el = document.getElementById('voicelive');
  if (!el) return;
  let html = '';
  if (midi != null && r.cents != null) {
    const nearest = Math.round(midi);
    const off = (((nearest - S.ctx.tonic) % 12) + 12) % 12; // the note sung, named in the key, any octave
    const cue = voiceCue(r.cents);
    const filled = Math.min(3, Math.floor((r.held / VOICE.holdMs) * 3));
    html = `${coloredName(off)} <span class="cue ${cue === 'in tune' ? 'good' : ''}">${cue}</span>${cue === 'in tune' ? ` <span class="holddots">${'●'.repeat(filled)}${'○'.repeat(3 - filled)}</span>` : ''}`;
  }
  if (html === lastVoice) return;
  lastVoice = html;
  el.innerHTML = html;
}

/** The sung note held steady: first-try if no failed attempt and no "Hear it" came before. */
function singAccepted() {
  S.sg.first[S.sg.pos] = !S.sg.aided;
  nextSing();
}

/** An attempt ended without landing on the note; the second miss plays the note. */
function singMissed() {
  S.sg.aided = true;
  S.sg.fails++;
  S.sg.note = 'again';
  if (S.sg.fails >= 2) return hearIt();
  render();
}

/** Play the current target note (the only time the app sounds in the sing step) and sing again. */
function hearIt() {
  if (!S.sg) return;
  S.sg.aided = true;
  S.sg.fails = 0;
  S.sg.note = 'heard';
  voiceHold.reset(targetPc(), -Infinity);
  if (ensureAudio()) {
    stopAll();
    playNote(midiOfNote(targets()[S.sg.pos]), now() + 0.03);
  }
  render();
}

function nextSing() {
  const n = targets().length;
  if (S.sg.pos < n - 1) {
    S.sg.pos++;
    S.sg.fails = 0;
    S.sg.aided = false;
    S.sg.note = '';
    voiceHold.reset(targetPc(), performance.now() + 500); // let the last note die away
  } else {
    // All sung: now find them on the fretboard.
    S.phase = 'listen';
    S.pos = 0;
    S.fresh = false;
    S.noteAt = now();
    S.noteMs = null;
  }
  lastVoice = '';
  render();
}

/** Self-check: the player marks their own attempt. */
function selfMark(ok) {
  if (S.phase !== 'sing' || !S.sg) return;
  S.sg.first[S.sg.pos] = ok && !S.sg.aided;
  nextSing();
}

/** Play the round's whole phrase from time `at`; returns when its last note sounds. */
function playPhrase(at, from = 0) {
  const seq = targets();
  seq.slice(from).forEach((d, i) => playNote(midiOfNote(d), at + i * PHRASE_STEP));
  return at + (seq.length - 1 - from) * PHRASE_STEP;
}

function replay() {
  if (singLevel() && S.phase === 'sing') return hearIt();
  if (!ensureAudio()) return;
  stopAll(undefined, true); // a drone keeps holding under the replayed phrase
  if (S.overChord) {
    // Strike the chord again with the first note over it, then the rest of the phrase.
    const at = playOver(voicing(S.overChord, S.ctx.keyPc), midiOfNote(targets()[0]));
    playPhrase(at + PHRASE_STEP, 1);
  } else playPhrase(now() + 0.03);
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
    (S.answers[S.round] ||= { len: seq.length, notes: [] }).notes.push({ heard, answered: d, sung: singLevel() ? S.sg.first[p] : undefined });
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
      t: Date.now(), ch: S.chapterId, lvl: S.level,
      heard: degreeIndex(heard, S.ctx.mode), answered: degreeIndex(first, S.ctx.mode),
      tries: S.tries, ms: S.noteMs, ref: referenceFor(refSettings(), S.round), labels: S.settings.labels,
      // Added with keys and modes: the level id, the key's tonic (0 = C), the mode, and the exact notes
      // as semitones above the tonic (heard/answered store chromatic and higher-octave notes as 8 + that).
      lid: level().id, key: S.ctx.keyPc, mode: S.ctx.mode, hs: heard, as: first,
      // Added with sequence levels: the note's index in the phrase and the phrase length (0 and 1 for single notes).
      seq: p, len: seq.length,
      // Added with sing-and-find: whether the note was sung correctly on the first try (no miss, no "Hear it").
      ...(singLevel() ? { sung: S.sg.first[p] === true } : {}),
      chord: S.overChord ? S.overChord.numeral : null, // roman numeral the note sounded over (null: none)
    }]);
    if (p < seq.length - 1) {
      // Next note of the phrase; its dots start clean and its response time from now.
      S.pos++;
      S.phase = 'listen';
      S.fresh = true;
      S.noteAt = now();
      S.noteMs = null;
    } else {
      // Only the last note of a phrase resolves to Do.
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
  const score = S.answers.filter(roundOk).length;
  const { progress, newBest } = recordScore(S.progress, S.chapterId, S.level, score);
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
  const mode = referenceFor({ ...refSettings(), refWhen: 'each' }, 0);
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
const spokenNames = (seq) => seq.map((d) => spoken(S.settings.labels === 'letters' ? letterName(d, S.ctx.keyPc, S.ctx.mode) : solfegeName(d))).join(', ');

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
 * One round: the reference, then the note(s) (a sing level speaks the target instead), then the
 * chosen pause, then the answer. The deck is dealt like a normal level and dealt again when used up.
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
  if (singLevel()) {
    S.overChord = null;
    const at = playReference(referenceFor(listenRef(), ls.n - 1), S.ctx.tonic, S.ctx.cadence.chords);
    lsAt(at, () => say(`Sing ${spokenNames(seq)}`, () => think(now())));
    return;
  }
  S.overChord = pickOverChord(S.settings.over, S.ctx.mode);
  const over = S.overChord && voicing(S.overChord, S.ctx.keyPc);
  think(playPhrase(playReference(referenceFor(listenRef(), ls.n - 1), S.ctx.tonic, S.ctx.cadence.chords, { over })));
}

/** The answer: its name spoken (if chosen), then the note(s) again walking to Do, then the next round. */
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
  if (S.settings.listenSpeak === 'on' && !singLevel()) say(spokenNames(seq), play);
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
  } else if (S.screen === 'backing' && pos) {
    btTap(pos);
  }
}

// ---------- backing track ----------

const btChords = () => S.bt.slots.map((n) => chordByNumeral(S.bt.mode, n));
const btSettled = () => ({ key: S.bt.key, mode: S.bt.mode, slots: S.bt.slots, tempo: S.bt.tempo, bars: S.bt.bars });
const btTimers = new Set();
const ALL_SAMPLE_MIDIS = Array.from({ length: MAX_MIDI - MIN_MIDI + 1 }, (_, i) => MIN_MIDI + i);

/** The chord whose tones the fretboard emphasises: the one playing, else the slot being edited. */
const btShown = () => btChords()[S.bt.playing && S.bt.cur != null ? S.bt.cur : S.bt.sel] || btChords()[0];

function btNowHTML() {
  const { playing, cur, key, mode } = S.bt;
  const c = playing && cur != null ? btChords()[cur] : null;
  if (!c) return playing ? 'Starting…' : 'Press Play, or tap a dot to hear the note.';
  return `<span class="snum">${esc(c.numeral)}</span> ${coloredName(c.root, chordName(c, key, mode))}`;
}

/** The scale across the first twelve frets, the current chord's tones emphasised and the rest dimmed. */
function btBoard() {
  const { key, mode, flash } = S.bt;
  const shown = btShown();
  const tones = new Set(chordPcs(shown));
  const dots = [];
  for (let st = 0; st < 6; st++) {
    for (let f = 0; f <= 12; f++) {
      const pc = (((OPEN[st] + f - key) % 12) + 12) % 12;
      if (SCALES[mode].includes(pc) || tones.has(pc)) dots.push({ id: pc, pos: [st, f] });
    }
  }
  const states = {};
  for (const { id } of dots) states[id] = tones.has(id) ? 'chord' : 'dim';
  const label = (id) => (S.settings.labels === 'letters' ? letterName(id, key, mode) : solfegeName(id));
  return fretboardSVG({
    dots, frame: { lo: 0, hi: 12 }, labelOf: label, nameOf: solfegeName, vertical: S.vertical,
    states, posStates: flash ? { [flash]: 'playing' } : {},
  });
}

/** Update the live parts of the screen in place (no full render, so a slider drag or focus survives). */
function btPaint() {
  if (S.screen !== 'backing') return;
  document.querySelectorAll('#bt-slots .slot').forEach((el, i) => el.classList.toggle('now', S.bt.playing && S.bt.cur === i));
  const nowEl = document.getElementById('bt-now');
  if (nowEl) nowEl.innerHTML = btNowHTML();
  const board = document.getElementById('bt-board');
  if (board) board.innerHTML = btBoard();
  lastHTML = SCREENS.backing();
}

function btStop() {
  if (!S.bt.playing && !loopActive()) return;
  stopLoop();
  btTimers.forEach(clearTimeout);
  btTimers.clear();
  S.bt.playing = false;
  S.bt.cur = null;
}

function btStart() {
  if (!ensureAudio()) return;
  prerender(ALL_SAMPLE_MIDIS);
  const { key, tempo, bars } = S.bt;
  S.bt.playing = true;
  S.bt.cur = null;
  startLoop({
    chords: btChords().map((c) => voicing(c, key)), bpm: tempo, bars,
    onChord: (index, time) => {
      const id = setTimeout(() => {
        btTimers.delete(id);
        if (!S.bt.playing) return;
        S.bt.cur = index;
        btPaint();
      }, Math.max(0, (time - now()) * 1000));
      btTimers.add(id);
    },
  });
}

/** After any edit: save it, and restart the loop from the top if it was running. */
function btChanged() {
  saveBacking(btSettled());
  S.bt.sel = Math.min(S.bt.sel, S.bt.slots.length - 1);
  if (S.bt.playing) { btStop(); btStart(); }
  render();
}

function btTap(pos) {
  if (!ensureAudio()) return;
  const [st, f] = pos.split(',').map(Number);
  playNote(OPEN[st] + f, now() + 0.01, 0.9); // over the track: nothing is stopped
  S.bt.flash = pos;
  btPaint();
  const id = setTimeout(() => { btTimers.delete(id); if (S.bt.flash === pos) { S.bt.flash = null; btPaint(); } }, 450);
  btTimers.add(id);
}

const BT_ACTIONS = {
  backing: () => { S.btBack = 'home'; go('backing'); if (ensureAudio()) prerender(ALL_SAMPLE_MIDIS); },
  btkey: (arg) => { S.bt.key = Number(arg); btChanged(); },
  btmode: (arg) => {
    if (arg === S.bt.mode) return;
    S.bt.slots = convertSlots(S.bt.slots, S.bt.mode, arg);
    S.bt.mode = arg;
    btChanged();
  },
  btslot: (arg) => { S.bt.sel = Number(arg); render(); btPaint(); },
  btchord: (arg) => { S.bt.slots = S.bt.slots.map((n, i) => (i === S.bt.sel ? arg : n)); btChanged(); },
  btadd: () => {
    if (S.bt.slots.length >= MAX_SLOTS) return;
    S.bt.slots = [...S.bt.slots, S.bt.slots[S.bt.sel]];
    S.bt.sel = S.bt.slots.length - 1;
    btChanged();
  },
  btdel: () => {
    if (S.bt.slots.length <= MIN_SLOTS) return;
    S.bt.slots = S.bt.slots.filter((_, i) => i !== S.bt.sel);
    btChanged();
  },
  btpreset: (arg) => { S.bt.slots = [...PRESETS[S.bt.mode][Number(arg)]]; S.bt.sel = 0; btChanged(); },
  btbars: (arg) => { S.bt.bars = Number(arg); btChanged(); },
  btplay: () => { if (S.bt.playing) btStop(); else btStart(); render(); },
};

/** Tempo slider: `input` moves the number live, `change` (on release) applies and saves it. */
function onRange(e) {
  const el = e.target.closest?.('[data-range="tempo"]');
  if (!el) return;
  S.bt.tempo = Math.max(TEMPO_RANGE[0], Math.min(TEMPO_RANGE[1], Math.round(Number(el.value)) || S.bt.tempo));
  const val = document.getElementById('tempoval');
  if (val) val.textContent = S.bt.tempo;
  if (e.type === 'change') btChanged();
}

// ---------- ear drills ----------

const DR_CHORD_STEP = 1.3; // seconds per chord of a drill progression
const DR_BLUES_STEP = 0.95; // a twelve-bar progression moves faster
const drRound = () => S.dr.deck[S.dr.round];
const mod12 = (n) => ((n % 12) + 12) % 12;
const QUALITY_THIRD = { maj: 4, min: 3 };
/** Root-position chord on `root` (MIDI) of quality 'maj' | 'min', guitar-like spacing. */
const qualityVoicing = (root, q) => [root, root + 7, root + 12, root + 12 + QUALITY_THIRD[q], root + 19];
const chordIn = (r, numeral) => chordByNumeral(r.mode, numeral);
const chordNames = (r, nums) => nums.map((n) => coloredName(chordIn(r, n).root, chordName(chordIn(r, n), r.keyPc, r.mode))).join(' ');
/** A note of a tune or melody (an offset above Do, possibly below it) as coloured text. */
const tuneNoteHTML = (o, keyPc, mode) => `<span class="deg" style="--c:${degColor(o)}">${esc(S.settings.labels === 'letters' ? letterName(mod12(o), keyPc, mode) : degName(o))}</span>`;

/** A choice or answer id of a drill as coloured HTML. */
function drLabelHTML(d, id, r = null) {
  switch (d.kind) {
    case 'quality': return id === 'maj' ? 'Major' : 'Minor';
    case 'mode': return id === 'major' ? 'Major' : 'Minor';
    case 'tonic': return esc(TONIC_LABELS[Number(id)]);
    case 'named': return esc(progressionById(id).name);
    case 'tune': return tuneNoteHTML(Number(id), r ? r.keyPc : 0, d.mode);
    default: return numeralHTML(d.mode, id);
  }
}

/** A roman numeral coloured like its chord's root. */
const numeralHTML = (mode, n) => `<span class="deg" style="--c:${noteColor(chordByNumeral(mode, n).root)}">${esc(n)}</span>`;

function openDrill(drill, back) {
  S.dr = { drill, back, phase: 'intro', deck: [], round: 0, answers: [], pos: 0, states: {}, pick: null, fresh: false, tonic: null, result: null };
  go('drill');
  if (ensureAudio()) prerender(ALL_SAMPLE_MIDIS);
}

function drStart() {
  const dr = S.dr;
  dr.deck = buildDrillDeck(dr.drill);
  dr.round = 0;
  dr.answers = [];
  dr.result = null;
  window.scrollTo(0, 0);
  drStartRound();
}

/** MIDI of Do for a melody round: the tune's own placement, or one that fits the melody. */
function drTonicOf(r) {
  if (!r.melody) return null;
  if (S.dr.drill.kind === 'tune') return tuneTonic(tuneById(r.tune), r.keyPc);
  const os = r.melody.map((n) => n.o);
  return fitTonic(r.keyPc, Math.min(...os, 0), Math.max(...os, 0));
}

function drStartRound() {
  clearTimer();
  stopAll();
  const dr = S.dr;
  dr.phase = 'listen';
  dr.pos = 0;
  dr.states = {};
  dr.pick = null;
  dr.fresh = false;
  dr.tonic = drTonicOf(drRound());
  render();
  drPlay();
}

/** Schedule a melody ([{ o, b }]) from context time `t`; returns when it ends. */
function drMelody(melody, tonic, bpm, t) {
  const beat = 60 / (bpm || 100);
  let at = 0;
  const notes = melody.map((n) => {
    const e = { midi: tonic + n.o, at: t + at * beat, dur: n.b * beat };
    at += n.b;
    return e;
  });
  playMelody(notes);
  return t + at * beat;
}

/** Play the round: the cadence if it has one, then its chord(s), chord quality or melody. */
function drPlay() {
  if (!ensureAudio() || !S.dr) return;
  stopAll();
  const r = drRound();
  let t = now() + 0.05;
  if (r.cadence) t = playReference('cadence', MIN_MIDI, cadenceFor(r.keyPc, r.mode).chords);
  if (r.quality) {
    const { root, q } = r.quality;
    strumChord(qualityVoicing(root, q), t);
    [0, QUALITY_THIRD[q], 7, 12].forEach((iv, i) => playNote(root + 12 + iv, t + 1.2 + i * 0.34, 0.75));
  } else if (r.chords) {
    const step = r.chords.length > 4 ? DR_BLUES_STEP : DR_CHORD_STEP;
    playChords(r.chords.flatMap((n, i) => {
      const notes = voicing(chordIn(r, n), r.keyPc);
      const at = t + i * step;
      return [{ notes, at }, { notes: notes.slice(-3).reverse(), at: at + step / 2, gain: 0.15 }];
    }));
  } else if (r.melody) {
    drMelody(r.melody, S.dr.tonic, r.bpm, t);
  }
}

/** The sound of a choice: the chord or note it names, in the round's key. */
function drSound(id) {
  const r = drRound();
  const t = now() + 0.03;
  switch (S.dr.drill.kind) {
    case 'quality': strumChord(qualityVoicing(r.quality.root, id), t); break;
    case 'function': case 'progression': strumChord(voicing(chordIn(r, id), r.keyPc), t); break;
    case 'mode': strumChord(voicing(chordsFor(id)[0], r.keyPc), t); break;
    case 'tune': playNote(S.dr.tonic + Number(id), t); break;
    case 'tonic': {
      // The candidate in the melody's own register, with its lower octave for weight.
      const m = S.dr.tonic + mod12(Number(id) - r.keyPc + 6) - 6;
      playNote(m, t);
      if (m - 12 >= MIN_MIDI) playNote(m - 12, t, 0.5);
      break;
    }
    default: break;
  }
}

/** A tap on a choice. In a find-the-key round it only auditions the note; That's home commits it. */
function drTap(id) {
  const dr = S.dr;
  if (!dr || (dr.phase !== 'listen' && dr.phase !== 'retry')) return;
  if (!ensureAudio()) return;
  if (drRound().audition) {
    dr.pick = id;
    stopAll();
    drSound(id);
    render();
    return;
  }
  drCommit(id);
}

/** Answer the current position. Only the first answer at each position counts; keep trying after a miss. */
function drCommit(id) {
  const dr = S.dr;
  if (id == null || (dr.phase !== 'listen' && dr.phase !== 'retry')) return;
  const r = drRound();
  const p = dr.pos;
  const want = r.answers[p];
  if (dr.fresh) { dr.states = {}; dr.fresh = false; }
  if (dr.phase === 'listen') (dr.answers[dr.round] ||= { len: r.answers.length, notes: [] }).notes.push({ heard: want, answered: id });
  if (!r.audition) { stopAll(); drSound(id); }
  dr.pick = null;
  if (id === want) {
    dr.states = { ...dr.states, [id]: 'correct' };
    if (p < r.answers.length - 1) {
      dr.states = { [id]: 'correct' }; // the next chord or note starts with clean buttons
      dr.pos++;
      dr.phase = 'listen';
      dr.fresh = true;
    } else {
      dr.phase = 'feedback';
      timer = setTimeout(drAdvance, CORRECT_DELAY + drReveal());
    }
  } else {
    dr.phase = 'retry';
    dr.states = { ...dr.states, [id]: 'wrong' };
  }
  render();
}

/** After a round: a tune's whole phrase again, or the home chord of a key round. Returns its ms. */
function drReveal() {
  const r = drRound();
  if (!ensureAudio()) return 0;
  const kind = S.dr.drill.kind;
  if (kind === 'tune' && r.full) {
    const t = now() + 0.7;
    return (drMelody(r.full, S.dr.tonic, r.bpm, t) - now()) * 1000;
  }
  if (kind === 'tonic' || kind === 'mode') {
    stopAll();
    strumChord(voicing(chordsFor(r.mode)[0], r.keyPc), now() + 0.05);
    return 1200;
  }
  return 0;
}

function drAdvance() {
  clearTimer();
  const dr = S.dr;
  if (!dr || dr.phase !== 'feedback') return;
  dr.round++;
  if (dr.round < ROUNDS) return drStartRound();
  const score = dr.answers.filter(roundOk).length;
  let newBest = false;
  if (!dr.drill.single) {
    const res = recordBest(S.progress, dr.drill.id, score);
    S.progress = res.progress;
    saveProgress(res.progress);
    newBest = res.newBest;
  }
  dr.result = { score, newBest, passed: isPassed(score) };
  dr.phase = 'done';
  stopAll();
  render();
  window.scrollTo(0, 0);
  if (dr.result.passed && ensureAudio()) playArpeggio([60, 64, 67, 72]);
}

function drPrompt() {
  const dr = S.dr;
  const r = drRound();
  if (dr.phase === 'feedback') return drRevealText();
  const miss = dr.phase === 'retry' ? 'Not that one. ' : '';
  switch (dr.drill.kind) {
    case 'quality': return `${miss}Major or minor chord?`;
    case 'function': return `${miss}Which chord came after the cadence?`;
    case 'progression': return `${miss}Chord ${dr.pos + r.given + 1} of ${r.chords.length}?`;
    case 'named': return `${miss}Which progression is it?`;
    case 'mode': return `${miss}Is this tune major or minor?`;
    case 'tonic': return dr.pick != null
      ? `Is <b>${esc(TONIC_LABELS[Number(dr.pick)])}</b> home? Try others, or press That's home.`
      : `${miss}Where is home? Tap notes to hear them.`;
    case 'tune': {
      const found = r.answers.slice(0, dr.pos).map((a) => tuneNoteHTML(Number(a), r.keyPc, r.mode)).join(' → ');
      return `${found ? `${found} → ` : ''}${miss}Note ${dr.pos + 1} of ${r.answers.length}?`;
    }
    default: return '';
  }
}

function drRevealText() {
  const dr = S.dr;
  const r = drRound();
  const lead = roundOk(dr.answers[dr.round]) ? 'Yes: ' : 'There it is: ';
  const key = esc(keyName(r.keyPc, r.mode));
  const from = r.tune ? ` <span class="muted">${esc(tuneById(r.tune).title)}</span>` : '';
  switch (dr.drill.kind) {
    case 'quality': return `${lead}${r.answers[0] === 'maj' ? 'major' : 'minor'}.`;
    case 'function': return `${lead}${esc(r.chords[0])}, ${chordNames(r, r.chords)} in ${key}.`;
    case 'progression': return `${lead}${r.chords.map(esc).join(' – ')}<br><span class="muted">${key}:</span> ${chordNames(r, r.chords)}`;
    case 'named': {
      const p = progressionById(r.prog);
      return `${lead}${esc(p.name)}, ${p.slots.map(esc).join(' – ')}<br><span class="muted">${key}:</span> ${chordNames(r, p.slots)}`;
    }
    case 'mode': return `${lead}${r.mode}, ${key}.${from}`;
    case 'tonic': return `${lead}home is ${esc(keyLetter(r.keyPc, r.mode))}, ${key}.${from}`;
    case 'tune': return `${lead}${(r.full || r.melody).map((n) => tuneNoteHTML(n.o, r.keyPc, r.mode)).join(' ')}${from}`;
    default: return '';
  }
}

/** The chords of a progression round as slots: given ones shown, answered ones filled in, the current one marked. */
function drSlotsHTML() {
  const dr = S.dr;
  const r = drRound();
  const k = dr.drill.kind;
  if (k !== 'progression' && !(k === 'named' && dr.phase === 'feedback')) return '';
  const done = dr.phase === 'feedback';
  return `<div class="slots drslots">${r.chords.map((n, i) => {
    const shown = done || i < r.given + dr.pos;
    const cur = !done && i === r.given + dr.pos;
    const c = chordIn(r, n);
    return `<span class="slot ${cur ? 'now' : ''}"><span class="snum">${shown ? numeralHTML(r.mode, n) : cur ? '?' : '·'}</span>${shown && (done || i < r.given) ? coloredName(c.root, chordName(c, r.keyPc, r.mode)) : '&nbsp;'}</span>`;
  }).join('')}</div>`;
}

function drChoicesHTML() {
  const dr = S.dr;
  const r = drRound();
  const off = dr.phase === 'feedback';
  return `<div class="choices ${dr.drill.kind}">${r.choices.map((c, i) => {
    const st = dr.states[c.id] || (dr.pick === c.id ? 'picked' : '');
    return `<button class="choice ${st}" data-action="drtap" data-arg="${esc(c.id)}" data-focus-key="drtap-${esc(c.id)}"${off ? ' disabled' : ''}>
      <span class="clabel">${drLabelHTML(dr.drill, c.id, r)}</span>${c.sub ? `<span class="snum">${esc(c.sub)}</span>` : ''}${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}</button>`;
  }).join('')}</div>`;
}

function drResultsHTML() {
  const dr = S.dr;
  const { score, newBest, passed } = dr.result;
  const counts = new Map();
  for (const n of dr.answers.flatMap((a) => a.notes)) {
    if (n.heard === n.answered) continue;
    const k = `${n.heard}>${n.answered}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const mix = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => {
    const [h, a] = k.split('>');
    return `<li>It was <b>${drLabelHTML(dr.drill, h)}</b>, answered <b>${drLabelHTML(dr.drill, a)}</b>${n > 1 ? ` ×${n}` : ''}</li>`;
  }).join('');
  const step = stepOf(dr.drill.id) ? nextStep(S.progress, S.guides) : null;
  const onPath = step != null && step.id !== dr.drill.id;
  return `<div class="scorecard ${passed ? 'pass' : 'fail'}">
        <p class="big"><b>${score}</b>/${ROUNDS}</p>
        <p class="verdict">${score === ROUNDS ? 'Perfect.' : passed ? 'Well done.' : 'Keep practising.'}</p>
        ${newBest ? '<p class="newbest">New best</p>' : ''}
      </div>
      ${mix ? `<h2 class="sub">Mix-ups</h2><ul class="confusions">${mix}</ul>` : ''}
      <div class="actions">
        ${btn(dr.back, 'Back', 'ghost')}
        ${btn('drstart', 'Retry', onPath ? 'ghost' : 'primary')}
        ${onPath ? btn('pathnext', 'Continue path', 'primary') : ''}
      </div>
      ${onPath ? `<p class="hint pathhint">Next on your path: <b>${esc(stepName(step))}</b></p>` : ''}`;
}

// ---------- songbook ----------

const SB_BPM = 90; // tempo of a progression played from the songbook

/** Schedule a tune (or one phrase of it) from now: melody and/or chords. */
function sbPlayTune({ melody = true, chords = true, phrase = null } = {}) {
  if (!ensureAudio()) return;
  stopAll();
  const tune = tuneById(S.sb.id);
  const { key } = S.sb;
  const beat = 60 / tune.bpm;
  const tonic = tuneTonic(tune, key);
  let notes = tuneNotes(tune);
  let from = 0;
  let to = Infinity;
  if (phrase != null) {
    const ph = tunePhrases(tune)[phrase];
    from = ph[0].t;
    to = ph[ph.length - 1].t + ph[ph.length - 1].b;
    notes = notes.filter((n) => n.t >= from && n.t < to);
  }
  const t0 = now() + 0.1 - from * beat;
  if (melody) playMelody(notes.filter((n) => n.o != null).map((n) => ({ midi: tonic + n.o, at: t0 + n.t * beat, dur: n.b * beat })), 0.95);
  if (chords) {
    const list = [];
    for (const c of tuneChords(tune)) {
      const notesC = voicing(chordByNumeral(tune.mode, c.numeral), key);
      for (let b = 0; b < c.b; b += 2) {
        const at = c.t + b;
        if (at + 0.01 >= from && at < to) list.push({ notes: b ? notesC.slice(-3).reverse() : notesC, at: t0 + at * beat, gain: b ? 0.12 : 0.2 });
      }
    }
    playChords(list);
  }
}

/** A progression from the songbook: twice through (once for a twelve-bar form), strummed like the backing track. */
function sbPlayProg() {
  if (!ensureAudio()) return;
  stopAll();
  const p = progressionById(S.sb.id);
  const chords = p.slots.map((n) => voicing(chordByNumeral(p.mode, n), S.sb.key));
  const events = loopEvents(chords.length, SB_BPM, 1);
  const cycle = cycleSeconds(chords.length, SB_BPM, 1);
  const t0 = now() + 0.1;
  const list = [];
  for (let pass = 0; pass < (p.slots.length > 4 ? 1 : 2); pass++) {
    for (const e of events) list.push({ notes: e.dir === 'up' ? chords[e.chord].slice(-3).reverse() : chords[e.chord], at: t0 + pass * cycle + e.t, gain: e.gain });
  }
  list.push({ notes: chords[0], at: t0 + (p.slots.length > 4 ? 1 : 2) * cycle, gain: 0.3 });
  playChords(list);
}

function openSong(kind, id, back) {
  const item = kind === 'tune' ? tuneById(id) : progressionById(id);
  S.sb = { kind, id, key: item.key ?? 0, show: false, back };
  go(kind === 'tune' ? 'tune' : 'prog');
  if (ensureAudio()) prerender(ALL_SAMPLE_MIDIS);
}

const sbKeys = (mode) => Array.from({ length: 12 }, (_, pc) => `<button class="keychip ${pc === S.sb.key ? 'on' : ''}" data-action="sbkey" data-arg="${pc}" data-focus-key="sbkey-${pc}" aria-pressed="${pc === S.sb.key}">${esc(keyLetter(pc, mode))}</button>`).join('');

// ---------- microphone ----------

const micWanted = () =>
  (S.settings.mic || singLevel()) && (S.screen === 'explore' || S.screen === 'play') && document.visibilityState === 'visible';

/** Start or stop the mic to match the current screen and setting. Idempotent; called on every render. */
function syncMic() {
  // The voice handler listens only while a note is being sung; otherwise the guitar tracker answers.
  setVoice(S.screen === 'play' && singLevel() && S.phase === 'sing' && S.sg && !singSelf() ? onVoiceFrame : null);
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
  ...BT_ACTIONS,
  home: () => go('home'),
  settings: () => go('settings'),
  practise: () => startSession(),
  stats: () => { S.stats = { agg: loadStats(), log: loadLog(), now: Date.now() }; go('stats'); },
  levels: () => go('levels'),
  path: () => go('path'),
  pathstep: (arg) => openStep(STEPS[Number(arg)]),
  pathnext: () => openStep(nextStep(S.progress, S.guides)),
  guide: () => go('guide'),
  guidedone: () => {
    if (!S.guides.includes(S.guideId)) { S.guides = [...S.guides, S.guideId]; saveGuides(S.guides); }
    go('path');
  },
  guideundo: () => { S.guides = S.guides.filter((id) => id !== S.guideId); saveGuides(S.guides); render(); },
  guideloop: () => {
    const { key, mode, slots, tempo, bars } = guideById(S.guideId).loop;
    Object.assign(S.bt, { key, mode, slots: [...slots], tempo, bars, sel: 0 });
    saveBacking(S.bt);
    S.btBack = 'guide';
    go('backing');
    btStart();
    render();
  },
  chapter: (arg) => { S.chapterId = arg; go('levels'); },
  drills: () => go('drills'),
  drill: (arg) => openDrill(drillById(arg), 'drills'),
  drstart: () => drStart(),
  drplay: () => drPlay(),
  drtap: (arg) => drTap(arg),
  drcommit: () => drCommit(S.dr?.pick),
  drnext: () => drAdvance(),
  songbook: () => go('songbook'),
  sbtune: (arg) => openSong('tune', arg, S.screen === 'guide' ? 'guide' : 'songbook'),
  sbprog: (arg) => openSong('prog', arg, S.screen === 'guide' ? 'guide' : 'songbook'),
  tune: () => go('tune'),
  prog: () => go('prog'),
  sbkey: (arg) => { S.sb.key = Number(arg); stopAll(); render(); },
  sbplay: () => sbPlayTune(),
  sbmelody: () => sbPlayTune({ chords: false }),
  sbchords: () => sbPlayTune({ melody: false }),
  sbphrase: (arg) => sbPlayTune({ phrase: Number(arg), chords: false }),
  sbstop: () => stopAll(),
  sbshow: () => { S.sb.show = !S.sb.show; render(); },
  sbpractise: () => openDrill(tuneDrill(S.sb.id), 'tune'),
  sbprogplay: () => sbPlayProg(),
  sbalong: () => {
    const p = progressionById(S.sb.id);
    Object.assign(S.bt, { key: S.sb.key, mode: p.mode, slots: [...p.slots], tempo: SB_BPM, bars: 1, sel: 0 });
    saveBacking(S.bt);
    S.btBack = 'prog';
    go('backing');
    btStart();
    render();
  },
  level: (arg) => openLevel(Number(arg)),
  key: (arg) => { S.keyPc = Number(arg); saveKey(S.keyPc); render(); },
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
  selfyes: () => selfMark(true),
  selfno: () => selfMark(false),
  micretry: () => { if (S.mic === 'blocked') S.mic = 'off'; render(); },
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
      S.guides = [];
      saveGuides(S.guides);
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
  if (n >= 1 && n <= 9 && S.screen === 'drill' && S.dr?.deck.length && S.dr.phase !== 'intro' && S.dr.phase !== 'done') {
    const c = drRound().choices[n - 1];
    if (c) { drTap(c.id); e.preventDefault(); }
    return;
  }
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
    else if (S.screen === 'backing') ACTIONS.btplay();
    else if (S.screen === 'listen') listenPause();
    else if (S.screen === 'drill') {
      const ph = S.dr.phase;
      if (ph === 'intro' || ph === 'done') drStart();
      else if (ph === 'feedback') drAdvance();
      else if (drRound().audition && S.dr.pick != null) drCommit(S.dr.pick);
      else drPlay();
    } else if (S.screen === 'tune') sbPlayTune();
    else if (S.screen === 'prog') sbPlayProg();
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
  app.addEventListener('input', onRange);
  app.addEventListener('change', onRange);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') btStop(); // timers throttle in the background; don't let the loop stutter
    else if (S.ls && !S.ls.paused) holdScreen(true); // the browser drops the wake lock when the page is hidden
    render();
  });
  render();
}
