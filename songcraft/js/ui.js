// Songcraft screens and input. One state object, full re-render via innerHTML (skipped when
// nothing changed); playback highlights are painted straight onto the DOM between renders.

import {
  mod12, QUALITIES, FLAVOURS, SCALES, SPICE, keyName, noteName, degreeLabel, chordName, chordPcs, roman, parseRoman, parseProg,
  diatonic, describe, suggestNext, analyse, relativeKey,
} from './theory.js';
import { shapeFor, shapeText, diagramSVG } from './shapes.js';
import {
  STEPS_PER_BAR, MAX_CHORDS, TEMPO_RANGE, PATTERNS, tonicMidi, totalSteps, chordSteps, voicing, normalizeSong, compile,
} from './song.js';
import { fit, gridRows, riffReport, riffNotes, generate, fitMotif, neckWindow, tabLines, STYLES } from './riff.js';
import { LESSONS, TRACKS, PRESETS, lessonById, lessonNumber, nextLesson, parseRiff } from './lessons.js';
import { ensureAudio, playNote, strum, play, stop, playing, setTrack, setTempo } from './engine.js';
import { fretboardSVG } from '../../js/fretboard.js';

const STORE = 'sc-state';
const ROLE_NAMES = { home: 'Home', away: 'Away', tension: 'Tension', spice: 'Colour from outside' };
const FIT_NAMES = { chord: 'chord tone', scale: 'colour', rub: 'rub', out: 'outside the key' };

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
const saved = load();

const S = {
  screen: 'home', // home | lesson | build | riff | ideas
  song: normalizeSong(saved.song),
  lkey: Number.isInteger(saved.lkey) && saved.lkey >= 0 && saved.lkey < 12 ? saved.lkey : 7, // key the lessons are shown in
  done: Array.isArray(saved.done) ? saved.done.filter((id) => lessonById(id)) : [],
  ideas: Array.isArray(saved.ideas) ? saved.ideas.filter((i) => i && i.song).map((i) => ({ name: String(i.name || 'Idea'), at: i.at || 0, song: normalizeSong(i.song) })) : [],
  challenge: lessonById(saved.challenge) ? saved.challenge : null, // lesson whose challenge is open in the builder or lab
  lessonId: null,
  famSel: 0, // chord shown in a lesson's family block
  sel: 0, // chord selected in the builder
  sevenths: false, // builder palette shows seventh chords
  presetStyle: 'Pop',
  rows: 'scale', // penta | scale | all
  view: 'tab', // tab | neck
  idea: null, // { style, why } of the last generated riff
  seed: Math.floor(Math.random() * 1e6),
  playId: null, // what is playing: 'song' or 'demo-<block index>'
  step: -1,
  undo: null, // { song, label } to restore
  toast: null,
};

let app;
let lastHTML = '';
let toastTimer = null;
let liveTrack = null; // compiled track of what is playing

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ song: S.song, lkey: S.lkey, done: S.done, ideas: S.ideas, challenge: S.challenge }));
  } catch { /* storage unavailable */ }
}

// ---------- small pieces ----------

const lesson = () => lessonById(S.lessonId);
/** Key and mode a lesson is shown in: a minor lesson uses the relative minor of the lesson key. */
const lessonCtx = (l) => (l.mode === 'minor' ? { key: relativeKey(S.lkey, 'major').key, mode: 'minor' } : { key: S.lkey, mode: 'major' });
const role = (c, mode) => describe(c, mode).role;
const chordArg = (c) => `${c.root},${c.q}`;
const argChord = (arg) => { const [r, q] = arg.split(','); return { root: Number(r), q, beats: 4 }; };
const beatsText = (b) => (b === 2 ? '½ bar' : b === 8 ? '2 bars' : '1 bar');

const topbar = (title, back, sub = '') => `
  <header class="topbar">
    ${back === 'menu'
    ? '<a class="iconbtn" href="../" aria-label="Back to the main menu">←</a>'
    : `<button class="iconbtn" data-action="${back}" aria-label="Back">←</button>`}
    ${sub ? `<div class="titles"><span class="tsub">${sub}</span><h1>${title}</h1></div>` : `<h1>${title}</h1>`}
    <span class="iconbtn-spacer"></span>
  </header>`;

const btn = (action, label, cls = '', arg = '', disabled = false) =>
  `<button class="btn ${cls}" data-action="${action}"${arg !== '' ? ` data-arg="${esc(arg)}"` : ''}${disabled ? ' disabled' : ''}>${label}</button>`;

const keySelect = (value, mode, input) => `<label class="field"><span class="label">Key</span>
  <select data-input="${input}" aria-label="Key">${Array.from({ length: 12 }, (_, pc) =>
    `<option value="${pc}"${pc === value ? ' selected' : ''}>${esc(keyName(pc, mode))}</option>`).join('')}</select></label>`;

/** A chord as a tappable chip: name, numeral, colour of its job. */
const chordBtn = (c, key, mode, action, { on = false, arg = chordArg(c), extra = '' } = {}) =>
  `<button class="chd role-${role(c, mode)}${on ? ' on' : ''}" data-action="${action}" data-arg="${esc(arg)}" aria-pressed="${on}">
    <b>${esc(chordName(c, key, mode))}</b><small>${esc(roman(c))}</small>${extra}</button>`;

/** {I}, {♭VII}, {key} in lesson text → chord names of the current key. */
function fmt(text, ctx) {
  return text.replace(/\{([^}]+)\}/g, (_, sym) => {
    if (sym === 'key') return `<b>${esc(keyName(ctx.key, ctx.mode))}</b>`;
    const c = parseRoman(sym);
    return c ? `<span class="cn role-${role(c, ctx.mode)}">${esc(chordName(c, ctx.key, ctx.mode))}</span>` : esc(sym);
  });
}

const tabHTML = (song) => `<pre class="tab" aria-label="Guitar tab">${esc(tabLines(song).join('\n'))}</pre>`;

/** Chords as a strip that lights up during playback; widths follow the chord lengths. */
const stripHTML = (song, action = '') => `<div class="strip">${song.chords.map((c, i) =>
  `<${action ? `button data-action="${action}" data-arg="${i}"` : 'span'} class="schord role-${role(c, song.mode)}" data-ci="${i}" style="flex-grow:${c.beats}">
    <b>${esc(chordName(c, song.key, song.mode))}</b><small>${esc(roman(c))}</small></${action ? 'button' : 'span'}>`).join('')}</div>`;

const playIcon = (on) => (on ? '<span class="stopicon" aria-hidden="true"></span>' : '<span class="playicon" aria-hidden="true"></span>');

function chordPanel(c, key, mode) {
  const d = describe(c, mode);
  const frets = shapeFor(key + c.root, c.q);
  return `<div class="chordpanel">
    <div class="boxwrap">${diagramSVG(frets, key + c.root, chordName(c, key, mode))}<span class="shape">${esc(shapeText(frets))}</span></div>
    <div class="cinfo">
      <div class="cname2"><b>${esc(chordName(c, key, mode))}</b><span class="numeral role-${d.role}">${esc(roman(c))}</span></div>
      <span class="rolelabel role-${d.role}">${ROLE_NAMES[d.role]}</span>
      <p>${esc(d.blurb)}</p>
    </div>
  </div>`;
}

function toastHTML() {
  if (!S.toast) return '';
  return `<div class="toast" role="status"><span>${esc(S.toast)}</span>${S.undo ? '<button class="btn primary small" data-action="undo">Undo</button>' : ''}</div>`;
}

function transport() {
  const on = S.playId === 'song';
  return `<div class="transport">
    <button class="btn primary playmain" data-action="play">${playIcon(on)}${on ? 'Stop' : 'Play'}</button>
    <label class="field grow"><span class="label">Tempo <output id="bpmout">${S.song.bpm}</output></span>
      <input type="range" min="${TEMPO_RANGE[0]}" max="${TEMPO_RANGE[1]}" step="2" value="${S.song.bpm}" data-input="bpm" aria-label="Tempo"></label>
    <label class="field"><span class="label">Strum</span>
      <select data-input="pattern" aria-label="Strum pattern">${Object.entries(PATTERNS).map(([id, p]) =>
    `<option value="${id}"${id === S.song.pattern ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <button class="pill${S.song.beat ? ' on' : ''}" data-action="beat" aria-pressed="${S.song.beat}">Drums</button>
  </div>`;
}

/** The open challenge, if it belongs on this screen: its text, and whether the song passes it. */
function challengeBanner(target) {
  const l = lessonById(S.challenge);
  if (!l || l.challenge.target !== target) return '';
  const ok = l.challenge.check(S.song);
  const next = LESSONS[LESSONS.indexOf(l) + 1];
  return `<section class="challenge${ok ? ' ok' : ''}">
    <span class="label">${ok ? 'Challenge complete' : `Challenge · ${esc(l.title)}`}</span>
    <p>${esc(l.challenge.text)}</p>
    <div class="actions left">
      ${ok && next ? btn('lesson', 'Next lesson', 'primary small', next.id) : ''}
      ${btn('lesson', ok ? 'Back to the lesson' : 'Re-read the lesson', 'small', l.id)}
      ${btn('endchallenge', 'Close', 'small')}
    </div>
  </section>`;
}

// ---------- lessons ----------

/** The song a lesson demo plays, in the lesson's key. */
function demoSong(l, d) {
  const ctx = lessonCtx(l);
  let song = normalizeSong({ key: ctx.key, mode: ctx.mode, bpm: d.bpm || 96, pattern: d.pattern || 'pop', beat: true, chords: parseProg(d.prog) });
  if (d.riff) song = normalizeSong({ ...song, riff: parseRiff(d.riff) });
  if (d.gen) song.riff = generate(song, d.gen.style, d.gen.seed).riff;
  if (d.motif) { song = normalizeSong({ ...song, riff: parseRiff(d.motif) }); song.riff = fitMotif(song); }
  return song;
}
const hasRiff = (song) => song.riff.some((o) => o != null);

function blockHTML(l, b, i) {
  const ctx = lessonCtx(l);
  if (b.p) return `<p class="para">${fmt(b.p, ctx)}</p>`;
  if (b.tip) return `<p class="tip">${fmt(b.tip, ctx)}</p>`;
  if (b.roles) {
    return `<ul class="roles">${['home', 'away', 'tension', 'spice'].map((r) =>
      `<li class="role-${r}"><i></i><b>${ROLE_NAMES[r]}</b><span>${{ home: 'rest, arrival', away: 'movement, lift', tension: 'wants to resolve', spice: 'borrowed and push chords' }[r]}</span></li>`).join('')}</ul>`;
  }
  if (b.family) {
    const chords = diatonic(ctx.mode);
    const sel = chords[Math.min(S.famSel, chords.length - 1)];
    return `<div class="fam7">
      <div class="palette seven">${chords.map((c, k) => chordBtn(c, ctx.key, ctx.mode, 'fam', { on: c === sel, arg: String(k) })).join('')}</div>
      ${chordPanel(sel, ctx.key, ctx.mode)}
    </div>`;
  }
  if (b.demo) {
    const song = demoSong(l, b.demo);
    const on = S.playId === `demo-${i}`;
    const riff = hasRiff(song);
    return `<div class="demo${on ? ' playing' : ''}" data-live="demo-${i}">
      <div class="demotop">
        <button class="playbtn" data-action="demo" data-arg="${i}" aria-label="${on ? 'Stop' : 'Play'}">${playIcon(on)}</button>
        ${stripHTML(song)}
      </div>
      ${riff ? tabHTML(song) : ''}
      <p class="note">${fmt(b.demo.note, ctx)}</p>
      <button class="linkbtn" data-action="opendemo" data-arg="${i}">Open in the ${riff ? 'riff lab' : 'chord builder'} →</button>
    </div>`;
  }
  return '';
}

// ---------- the riff grid ----------

function gridHTML() {
  const song = S.song;
  const steps = totalSteps(song);
  const at = chordSteps(song);
  const rows = gridRows(song, S.rows);
  const head = song.chords.map((c) =>
    `<span class="gchord role-${role(c, song.mode)}" style="grid-column:span ${c.beats * 2}">${esc(chordName(c, song.key, song.mode))}</span>`).join('');
  const beats = Array.from({ length: steps }, (_, s) => `<span class="gbeat${s % STEPS_PER_BAR === 0 ? ' bar' : ''}">${s % 2 ? '' : (s % STEPS_PER_BAR) / 2 + 1}</span>`).join('');
  const body = rows.map((o) => {
    const name = noteName(o, song.key, song.mode);
    const cells = Array.from({ length: steps }, (_, s) => {
      const f = fit(o, song.chords[at[s]], song.mode);
      const on = song.riff[s] === o;
      return `<button class="cell f-${f}${on ? ' on' : ''}${s % STEPS_PER_BAR === 0 ? ' bar' : s % 2 === 0 ? ' beat' : ''}${s % 4 === 0 ? ' strong' : ''}" data-action="cell" data-arg="${s},${o}" aria-pressed="${on}" aria-label="${esc(name)}, bar ${Math.floor(s / STEPS_PER_BAR) + 1}, step ${(s % STEPS_PER_BAR) + 1}, ${FIT_NAMES[f]}"></button>`;
    }).join('');
    return `<div class="grow${mod12(o) === 0 ? ' tonic' : ''}"><span class="rlabel"><b>${esc(name)}</b><small>${esc(degreeLabel(o))}</small></span>${cells}</div>`;
  }).join('');
  return `<div class="gridwrap" data-scroll="grid"><div class="grid" style="--steps:${steps}">
    <div class="grow ghead"><span class="rlabel"></span>${head}</div>
    <div class="grow gbeats"><span class="rlabel"></span>${beats}</div>
    ${body}
    <div class="playhead" hidden></div>
  </div></div>`;
}

function neckHTML() {
  const song = S.song;
  const tonic = tonicMidi(song.key);
  const used = song.riff.filter((o) => o != null).map((o) => tonic + o);
  const w = neckWindow(used.length ? used : [tonic, tonic + 7]);
  const open = w.lo <= 2;
  const pcs = new Set(SCALES[song.mode].concat(used.map((m) => mod12(m - tonic))));
  const dots = [];
  [40, 45, 50, 55, 59, 64].forEach((openMidi, s) => {
    for (let f = open ? 0 : w.lo; f <= w.hi; f++) {
      const id = mod12(openMidi + f - tonic);
      if (pcs.has(id)) dots.push({ id, pos: [s, f] });
    }
  });
  const posStates = {};
  for (const [, [s, f]] of w.pos) posStates[`${s},${f}`] = 'chord';
  return `<div class="neck" data-riffpos="${[...w.pos.values()].map((p) => p.join(',')).join(' ')}">${fretboardSVG({
    dots, frame: { lo: open ? 0 : w.lo - 1, hi: w.hi }, labelOf: (id) => esc(noteName(id, song.key, song.mode)), nameOf: (id) => noteName(id, song.key, song.mode),
    vertical: false, states: Object.fromEntries([...pcs].map((id) => [id, 'dim'])), posStates,
  })}</div>`;
}

// ---------- screens ----------

const SCREENS = {
  home() {
    const next = nextLesson(S.done);
    const notes = riffNotes(S.song).length;
    const row = (action, arg, mark, name, desc, meta, cls = '') => `<li><button class="chapter ${cls}" data-action="${action}" data-arg="${esc(arg)}">
      <span class="cnum">${mark}</span>
      <span class="cbody"><span class="cname">${esc(name)}</span><span class="cdesc">${esc(desc)}</span></span>
      <span class="cmeta">${meta}</span></button></li>`;
    return `${topbar('Songcraft', 'menu')}
    <main class="screen home">
      <p class="lede">Learn to write chord progressions on guitar, and riffs and melodies that fit them.</p>
      ${next ? `<button class="nextup" data-action="lesson" data-arg="${next.id}">
        <span class="label">${S.done.length ? 'Next lesson' : 'Start here'}</span>
        <span class="nname">${esc(next.title)}</span>
        <span class="ndesc">${esc(next.sub)}</span>
      </button>` : '<p class="lede"><b>All lessons done.</b> Now write.</p>'}
      <h2 class="sub">Make</h2>
      <ol class="chapters">
        ${row('go', 'build', '♯', 'Chord builder', `${keyName(S.song.key, S.song.mode)} · ${S.song.chords.map((c) => roman(c)).join(' ')}`, '')}
        ${row('go', 'riff', '♪', 'Riff lab', 'Write a riff or melody over your chords', notes ? `${notes} notes` : '')}
        ${row('go', 'ideas', '★', 'My ideas', 'Loops and riffs you saved', S.ideas.length ? String(S.ideas.length) : '')}
      </ol>
      ${TRACKS.map((t) => `<h2 class="sub">Learn · ${esc(t.name)}</h2>
      <ol class="chapters">${LESSONS.filter((l) => l.track === t.id).map((l) =>
    row('lesson', l.id, lessonNumber(l), l.title, l.sub, S.done.includes(l.id) ? '<span class="tick">✓ done</span>' : '', S.done.includes(l.id) ? 'isdone' : '')).join('')}</ol>`).join('')}
    </main>`;
  },

  lesson() {
    const l = lesson();
    const ctx = lessonCtx(l);
    const track = TRACKS.find((t) => t.id === l.track);
    const i = LESSONS.indexOf(l);
    const done = S.done.includes(l.id);
    return `${topbar(esc(l.title), 'home', `${esc(track.name)} · ${lessonNumber(l)} of ${LESSONS.filter((x) => x.track === l.track).length}`)}
    <main class="screen lesson">
      <div class="lessonkey">${keySelect(S.lkey, 'major', 'lkey')}${l.mode === 'minor' ? `<span class="hint">This lesson uses its relative minor, ${esc(keyName(ctx.key, 'minor'))}.</span>` : '<span class="hint">Every example follows the key you choose.</span>'}</div>
      ${l.blocks.map((b, k) => blockHTML(l, b, k)).join('')}
      <section class="challenge${done ? ' ok' : ''}">
        <span class="label">${done ? 'Challenge complete' : 'Your turn'}</span>
        <p>${esc(l.challenge.text)}</p>
        <div class="actions left">${btn('challenge', l.challenge.target === 'build' ? 'Try it in the chord builder' : 'Try it in the riff lab', done ? 'small' : 'primary small', l.id)}</div>
      </section>
      <div class="actions">
        ${i > 0 ? btn('lesson', '← Previous', '', LESSONS[i - 1].id) : ''}
        ${i < LESSONS.length - 1 ? btn('lesson', 'Next →', '', LESSONS[i + 1].id) : ''}
      </div>
    </main>`;
  },

  build() {
    const song = S.song;
    const { key, mode } = song;
    const sel = song.chords[S.sel];
    const fam = QUALITIES[sel.q].fam;
    const inKey = diatonic(mode, S.sevenths);
    const spice = SPICE[mode].map(parseRoman);
    const same = (a, b) => a.root === b.root && a.q === b.q;
    const full = song.chords.length >= MAX_CHORDS;
    const notes = analyse(song.chords, mode);
    const styles = [...new Set(PRESETS.map((p) => p.style))];
    return `${topbar('Chord builder', 'home', esc(keyName(key, mode)))}
    <main class="screen build">
      ${challengeBanner('build')}
      <div class="keyrow">
        ${keySelect(key, mode, 'key')}
        <div class="seg" role="group" aria-label="Mode">${['major', 'minor'].map((m) =>
    `<button class="${m === mode ? 'on' : ''}" data-action="mode" data-arg="${m}" aria-pressed="${m === mode}">${m === 'major' ? 'Major' : 'Minor'}</button>`).join('')}</div>
      </div>
      <div class="cslots" data-live="song">
        ${song.chords.map((c, i) => `<button class="cslot role-${role(c, mode)}${i === S.sel ? ' on' : ''}" data-action="slot" data-arg="${i}" data-ci="${i}" aria-pressed="${i === S.sel}">
          <b>${esc(chordName(c, key, mode))}</b><small>${esc(roman(c))}</small><span class="len">${beatsText(c.beats)}</span></button>`).join('')}
        ${full ? '' : '<button class="cslot add" data-action="add" aria-label="Add a chord">+</button>'}
      </div>
      ${transport()}
      <section class="editor">
        ${chordPanel(sel, key, mode)}
        <div class="edrow"><span class="label">In the key</span>
          <button class="pill small${S.sevenths ? ' on' : ''}" data-action="sevenths" aria-pressed="${S.sevenths}">Sevenths</button></div>
        <div class="palette seven">${inKey.map((c) => chordBtn(c, key, mode, 'swap', { on: same(c, sel) })).join('')}</div>
        <div class="edrow"><span class="label">From outside the key</span></div>
        <div class="palette">${spice.map((c) => chordBtn(c, key, mode, 'swap', { on: same(c, sel) })).join('')}</div>
        <div class="edrow"><span class="label">Colour</span></div>
        <div class="chipsrow">${FLAVOURS[fam].map((q) =>
    `<button class="pill${q === sel.q ? ' on' : ''}" data-action="flavour" data-arg="${q}" aria-pressed="${q === sel.q}">${esc(chordName({ root: sel.root, q }, key, mode))}</button>`).join('')}</div>
        <div class="edrow"><span class="label">Length</span></div>
        <div class="edrow gap">
          <div class="seg" role="group" aria-label="Length">${[2, 4, 8].map((b) =>
    `<button class="${b === sel.beats ? 'on' : ''}" data-action="beats" data-arg="${b}" aria-pressed="${b === sel.beats}">${beatsText(b)}</button>`).join('')}</div>
          <span class="spacer"></span>
          <button class="iconbtn" data-action="move" data-arg="-1" aria-label="Move earlier"${S.sel === 0 ? ' disabled' : ''}>‹</button>
          <button class="iconbtn" data-action="move" data-arg="1" aria-label="Move later"${S.sel === song.chords.length - 1 ? ' disabled' : ''}>›</button>
          <button class="iconbtn danger" data-action="remove" aria-label="Remove this chord"${song.chords.length < 2 ? ' disabled' : ''}>×</button>
        </div>
        ${full ? '' : `<div class="edrow"><span class="label">What could come after ${esc(chordName(sel, key, mode))}</span></div>
        <div class="suggest">${suggestNext(sel, mode, S.sevenths || sel.q.includes('7') || sel.q.includes('9')).map(({ chord, why }) =>
    chordBtn(chord, key, mode, 'suggest', { extra: `<span class="why">${esc(why)}</span>` })).join('')}</div>`}
      </section>
      <section class="why">
        <h2 class="sub">Why it sounds the way it does</h2>
        <ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      </section>
      <div class="actions">${btn('go', 'Write a riff →', 'primary', 'riff')}${btn('save', 'Save idea')}</div>
      <section>
        <h2 class="sub">Start from a loop</h2>
        <div class="seg" role="group" aria-label="Style">${styles.map((s) =>
    `<button class="${s === S.presetStyle ? 'on' : ''}" data-action="pstyle" data-arg="${s}" aria-pressed="${s === S.presetStyle}">${s}</button>`).join('')}</div>
        <div class="loops">${PRESETS.map((p, i) => (p.style !== S.presetStyle ? '' :
    `<button class="loop" data-action="preset" data-arg="${i}"><b>${esc(p.name)}</b><small>${esc(p.prog.replace(/:\d/g, ''))}</small></button>`)).join('')}</div>
      </section>
      ${toastHTML()}
    </main>`;
  },

  riff() {
    const song = S.song;
    const report = riffReport(song);
    const mark = (ok) => (ok === null ? '<i class="m info">·</i>' : ok ? '<i class="m ok">✓</i>' : '<i class="m bad">!</i>');
    return `${topbar('Riff lab', 'home', esc(keyName(song.key, song.mode)))}
    <main class="screen riff">
      ${challengeBanner('riff')}
      <div data-live="song">${stripHTML(song, 'hearslot')}</div>
      ${transport()}
      <section class="ideas">
        <span class="label">Give me an idea</span>
        <div class="chipsrow">${Object.entries(STYLES).map(([id, st]) =>
    `<button class="pill idea${S.idea?.style === id ? ' on' : ''}" data-action="gen" data-arg="${id}"><b>${st.name}</b><small>${esc(st.hint)}</small></button>`).join('')}</div>
        ${S.idea ? `<ul class="notes">${S.idea.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
        <p class="hint">Press ${STYLES[S.idea.style].name} again for another one, or change it note by note below.${S.idea.style === 'jazz' && song.pattern !== 'jazz' ? ' Choose the strum Jazz comp to hear it swing.' : ''}</p>` : ''}
      </section>
      <div class="gridtools">
        <div class="seg" role="group" aria-label="Notes shown">${[['penta', 'Pentatonic'], ['scale', 'Scale'], ['all', 'All notes']].map(([id, name]) =>
    `<button class="${id === S.rows ? 'on' : ''}" data-action="rows" data-arg="${id}" aria-pressed="${id === S.rows}">${name}</button>`).join('')}</div>
        <span class="spacer"></span>
        ${btn('repeat', 'Repeat bar 1', 'small', '', !song.riff.slice(0, STEPS_PER_BAR).some((o) => o != null) || song.riff.length <= STEPS_PER_BAR)}
        ${btn('clear', 'Clear', 'small', '', !report.count)}
      </div>
      <ul class="legend"><li class="f-chord"><i></i>chord tone: always fits</li><li class="f-scale"><i></i>colour: fine in passing</li><li class="f-rub"><i></i>rub: resolve it by step</li>${S.rows === 'all' ? '<li class="f-out"><i></i>outside the key: a half step from its target</li>' : ''}</ul>
      ${gridHTML()}
      <p class="hint">Tap a square to place a note: one per 8th note. Rings mark the tones of the chord in that bar.</p>
      ${report.count ? `<section class="why"><h2 class="sub">How it fits</h2>
        <ul class="notes checks">${report.lines.map((l) => `<li>${mark(l.ok)}<span>${esc(l.text)}</span></li>`).join('')}</ul></section>` : ''}
      <section>
        <div class="edrow"><h2 class="sub">On the guitar</h2><span class="spacer"></span>
          <div class="seg" role="group" aria-label="View">${[['tab', 'Tab'], ['neck', 'Neck']].map(([id, name]) =>
    `<button class="${id === S.view ? 'on' : ''}" data-action="view" data-arg="${id}" aria-pressed="${id === S.view}">${name}</button>`).join('')}</div></div>
        ${S.view === 'tab' ? (report.count ? tabHTML(song) : '<p class="hint">The tab of your riff appears here.</p>') : neckHTML()}
        ${S.view === 'neck' ? '<p class="hint">The scale in the position of your riff. Thick rings are your riff; while it plays, they show the tones of the current chord.</p>' : ''}
      </section>
      <div class="actions">${btn('go', '← Edit the chords', '', 'build')}${btn('save', 'Save idea')}</div>
      ${toastHTML()}
    </main>`;
  },

  ideas() {
    return `${topbar('My ideas', 'home')}
    <main class="screen">
      ${S.ideas.length ? `<ol class="chapters">${S.ideas.map((it, i) => `<li class="idearow">
        <button class="chapter" data-action="loadidea" data-arg="${i}">
          <span class="cnum">${i + 1}</span>
          <span class="cbody"><span class="cname">${esc(it.name)}</span><span class="cdesc">${esc(it.song.chords.map((c) => chordName(c, it.song.key, it.song.mode)).join('  '))}</span></span>
          <span class="cmeta">${riffNotes(it.song).length ? 'with riff' : 'chords'}</span></button>
        <button class="iconbtn danger" data-action="delidea" data-arg="${i}" aria-label="Delete ${esc(it.name)}">×</button></li>`).join('')}</ol>`
    : '<p class="lede">Nothing saved yet. Use <b>Save idea</b> in the chord builder or the riff lab.</p>'}
      <div class="actions">${btn('go', 'Chord builder', '', 'build')}${btn('go', 'Riff lab', '', 'riff')}</div>
      ${toastHTML()}
    </main>`;
  },
};

// ---------- rendering ----------

function render() {
  const html = SCREENS[S.screen]();
  if (html === lastHTML) return;
  lastHTML = html;
  const scroll = {};
  app.querySelectorAll('[data-scroll]').forEach((el) => { scroll[el.dataset.scroll] = el.scrollLeft; });
  const active = document.activeElement;
  const focus = active && app.contains(active) && active.dataset.action ? `[data-action="${active.dataset.action}"]${active.dataset.arg != null ? `[data-arg="${CSS.escape(active.dataset.arg)}"]` : ''}` : null;
  app.innerHTML = html;
  app.querySelectorAll('[data-scroll]').forEach((el) => { if (scroll[el.dataset.scroll]) el.scrollLeft = scroll[el.dataset.scroll]; });
  if (focus) app.querySelector(focus)?.focus({ preventScroll: true });
  paintLive();
}

/** Light up what is sounding: the chord in the strip, the playhead on the grid, the note on the neck. */
function paintLive() {
  const neck = app.querySelector('.neck');
  const head = app.querySelector('.playhead');
  const live = S.playId && liveTrack && S.step >= 0;
  const ci = live ? liveTrack.chordAt[S.step] : -1;
  app.querySelectorAll('[data-ci].now').forEach((el) => el.classList.remove('now'));
  if (live) app.querySelectorAll(`[data-live="${S.playId}"] [data-ci="${ci}"]`).forEach((el) => el.classList.add('now'));
  if (head) {
    const on = live && S.playId === 'song';
    head.hidden = !on;
    if (on) {
      const cell = app.querySelector('.cell');
      const wrap = app.querySelector('.gridwrap');
      const cw = cell ? cell.getBoundingClientRect().width : 0;
      head.style.transform = `translateX(${S.step * cw}px)`;
      head.style.width = `${cw}px`;
      const label = wrap.querySelector('.rlabel').getBoundingClientRect().width;
      const x = S.step * cw;
      if (x < wrap.scrollLeft || x + cw > wrap.scrollLeft + wrap.clientWidth - label) wrap.scrollLeft = Math.floor(S.step / STEPS_PER_BAR) * STEPS_PER_BAR * cw;
    }
  }
  if (neck) {
    const riffPos = new Set((neck.dataset.riffpos || '').split(' '));
    const on = live && S.playId === 'song';
    const pcs = on ? chordPcs(S.song.chords[ci]) : null;
    const tonic = tonicMidi(S.song.key);
    let sounding = null;
    if (on) {
      for (let s = S.step; s >= Math.max(0, S.step - 5) && sounding == null; s--) if (S.song.riff[s] != null) sounding = S.song.riff[s];
    }
    const pos = sounding != null ? neckWindow(S.song.riff.filter((o) => o != null).map((o) => tonic + o)).pos.get(tonic + sounding) : null;
    neck.querySelectorAll('.dot').forEach((el) => {
      const strong = pcs ? pcs.includes(Number(el.dataset.degree)) : riffPos.has(el.dataset.pos);
      el.classList.toggle('chord', strong);
      el.classList.toggle('dim', !strong);
      el.classList.toggle('playing', !!pos && el.dataset.pos === pos.join(','));
    });
  }
}

// ---------- playback ----------

function onStep(step) {
  S.step = step;
  paintLive();
}

function stopPlay() {
  stop();
  S.playId = null;
  S.step = -1;
  liveTrack = null;
}

function startPlay(id, song) {
  ensureAudio();
  liveTrack = compile(song);
  S.playId = id;
  S.step = -1;
  play(liveTrack, song.bpm, onStep);
}

/** After an edit: keep the loop running with the new song. */
function retrack() {
  if (S.playId !== 'song' || !playing()) return;
  liveTrack = compile(S.song);
  setTrack(liveTrack);
  setTempo(S.song.bpm);
}

const hearChord = (c, key) => { ensureAudio(); if (!playing()) stop(); strum(voicing(c, key)); };

// ---------- changing the song ----------

function toast(text, keepUndo = false) {
  if (!keepUndo) S.undo = null;
  S.toast = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; S.undo = null; render(); }, 7000);
}

/** Remember the song so the next change can be undone from the toast. */
const snapshot = () => { S.undo = { song: structuredClone(S.song), challenge: S.challenge }; };

/** Call after every change to the song: tidy it, check the open challenge, save, update the loop. */
function changed() {
  S.song = normalizeSong(S.song);
  S.sel = Math.min(S.sel, S.song.chords.length - 1);
  const l = lessonById(S.challenge);
  if (l && !S.done.includes(l.id) && l.challenge.check(S.song)) S.done.push(l.id);
  persist();
  retrack();
}

function setSong(song, message) {
  snapshot();
  S.song = normalizeSong(song);
  S.sel = 0;
  S.idea = null;
  changed();
  toast(message, true);
}

/** Major ↔ minor on the same tonic: chords and riff notes of the key move to the matching scale degree. */
function convertMode(song, mode) {
  if (song.mode === mode) return song;
  const from = SCALES[song.mode];
  const to = SCALES[mode];
  const tri = diatonic(mode);
  const chords = song.chords.map((c) => {
    const i = from.indexOf(c.root);
    if (i < 0) return c;
    const plain = ['', 'm', 'dim'].includes(c.q);
    const q = plain ? tri[i].q : diatonic(mode, true)[i].q;
    return { ...c, root: to[i], q };
  });
  const riff = song.riff.map((o) => {
    if (o == null) return null;
    const i = from.indexOf(mod12(o));
    return i < 0 ? o : o - from[i] + to[i];
  });
  return { ...song, mode, chords, riff };
}

const ideaName = (song) => `${keyName(song.key, song.mode)} · ${song.chords.map((c) => roman(c)).join(' ')}`;

// ---------- actions ----------

const ACTIONS = {
  home() { go('home'); },
  go(screen) { go(screen); },
  lesson(id) { S.lessonId = id; S.famSel = 0; go('lesson'); },

  // lessons
  fam(i) {
    const l = lesson();
    const ctx = lessonCtx(l);
    S.famSel = Number(i);
    hearChord(diatonic(ctx.mode)[S.famSel], ctx.key);
  },
  demo(i) {
    const id = `demo-${i}`;
    if (S.playId === id) return stopPlay();
    const l = lesson();
    startPlay(id, demoSong(l, l.blocks[Number(i)].demo));
  },
  opendemo(i) {
    const l = lesson();
    const song = demoSong(l, l.blocks[Number(i)].demo);
    setSong(song, 'Loaded the example. Your previous work can be restored.');
    go(hasRiff(song) ? 'riff' : 'build', true);
  },
  challenge(id) {
    const l = lessonById(id);
    const start = l.challenge.start;
    S.challenge = id;
    if (start) {
      const mode = start.mode || 'major';
      const key = mode === 'minor' ? relativeKey(S.lkey, 'major').key : S.lkey;
      setSong({ ...S.song, key, mode, pattern: start.pattern || S.song.pattern, chords: parseProg(start.prog), riff: [] }, 'Loaded chords for this challenge.');
    } else if (l.challenge.target === 'build' && l.mode !== 'minor' && S.song.mode === 'minor') {
      setSong(convertMode(S.song, 'major'), 'Switched your loop to major for this challenge.');
    }
    persist();
    go(l.challenge.target, true);
  },
  endchallenge() { S.challenge = null; persist(); },

  // builder
  slot(i) { S.sel = Number(i); hearChord(S.song.chords[S.sel], S.song.key); },
  hearslot(i) { hearChord(S.song.chords[Number(i)], S.song.key); },
  add() {
    const last = S.song.chords[S.song.chords.length - 1];
    S.song.chords.push({ ...suggestNext(last, S.song.mode, S.sevenths)[0].chord, beats: 4 });
    S.sel = S.song.chords.length - 1;
    changed();
    hearChord(S.song.chords[S.sel], S.song.key);
  },
  swap(arg) {
    const c = argChord(arg);
    S.song.chords[S.sel] = { ...c, beats: S.song.chords[S.sel].beats };
    changed();
    hearChord(c, S.song.key);
  },
  flavour(q) {
    S.song.chords[S.sel].q = q;
    changed();
    hearChord(S.song.chords[S.sel], S.song.key);
  },
  suggest(arg) {
    S.song.chords.splice(S.sel + 1, 0, argChord(arg));
    S.sel += 1;
    changed();
    hearChord(S.song.chords[S.sel], S.song.key);
  },
  beats(b) { S.song.chords[S.sel].beats = Number(b); changed(); },
  move(d) {
    const j = S.sel + Number(d);
    if (j < 0 || j >= S.song.chords.length) return;
    const cs = S.song.chords;
    [cs[S.sel], cs[j]] = [cs[j], cs[S.sel]];
    S.sel = j;
    changed();
  },
  remove() {
    if (S.song.chords.length < 2) return;
    S.song.chords.splice(S.sel, 1);
    changed();
  },
  sevenths() { S.sevenths = !S.sevenths; },
  mode(m) {
    if (m === S.song.mode) return;
    S.song = convertMode(S.song, m);
    changed();
  },
  pstyle(s) { S.presetStyle = s; },
  preset(i) {
    const p = PRESETS[Number(i)];
    const mode = p.mode || 'major';
    const key = mode === S.song.mode ? S.song.key : relativeKey(S.song.key, S.song.mode).key;
    setSong({ ...S.song, key, mode, pattern: p.pattern, chords: parseProg(p.prog), riff: [] }, `Loaded "${p.name}".`);
    window.scrollTo(0, 0);
  },

  // transport
  play() {
    if (S.playId === 'song') stopPlay();
    else startPlay('song', S.song);
  },
  beat() { S.song.beat = !S.song.beat; changed(); },

  // riff lab
  cell(arg) {
    const [s, o] = arg.split(',').map(Number);
    const on = S.song.riff[s] === o;
    S.song.riff[s] = on ? null : o;
    changed();
    if (!on && !playing()) { ensureAudio(); playNote(tonicMidi(S.song.key) + o); }
  },
  tap(_, el) {
    const [s, f] = el.dataset.pos.split(',').map(Number);
    ensureAudio();
    playNote([40, 45, 50, 55, 59, 64][s] + f);
  },
  rows(kind) { S.rows = kind; },
  view(v) { S.view = v; },
  gen(style) {
    snapshot();
    S.seed += 1;
    const g = generate(S.song, style, S.seed);
    S.song.riff = g.riff;
    S.idea = { style, why: g.why };
    if (style === 'jazz') S.rows = 'all';
    changed();
    toast(`A new ${STYLES[style].name.toLowerCase()} idea.`, true);
  },
  repeat() {
    snapshot();
    S.song.riff = fitMotif(S.song);
    changed();
    toast('Bar 1 repeated and fitted to each chord.', true);
  },
  clear() {
    snapshot();
    S.song.riff = [];
    S.idea = null;
    changed();
    toast('Riff cleared.', true);
  },

  // ideas
  save() {
    S.ideas.unshift({ name: ideaName(S.song), at: Date.now(), song: structuredClone(S.song) });
    S.ideas = S.ideas.slice(0, 40);
    persist();
    toast('Saved to My ideas.');
  },
  loadidea(i) {
    const it = S.ideas[Number(i)];
    setSong(structuredClone(it.song), `Loaded "${it.name}".`);
    go(hasRiff(it.song) ? 'riff' : 'build', true);
  },
  delidea(i) {
    S.ideas.splice(Number(i), 1);
    persist();
  },
  undo() {
    if (!S.undo) return;
    S.song = S.undo.song;
    S.challenge = S.undo.challenge;
    S.undo = null;
    S.toast = null;
    S.idea = null;
    changed();
  },
};

function go(screen, keepToast = false) {
  stopPlay();
  if (!keepToast) { S.toast = null; S.undo = null; }
  S.screen = screen;
  render();
  window.scrollTo(0, 0);
}

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el || !app.contains(el) || el.disabled) return;
  ensureAudio();
  ACTIONS[el.dataset.action]?.(el.dataset.arg, el);
  render();
}

function onInput(e) {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const kind = el.dataset.input;
  if (kind === 'bpm') {
    S.song.bpm = Number(el.value);
    setTempo(S.song.bpm);
    const out = app.querySelector('#bpmout');
    if (out) out.textContent = el.value;
    if (e.type === 'change') { persist(); lastHTML = ''; render(); }
    return;
  }
  if (e.type !== 'change') return;
  if (kind === 'key') { S.song.key = Number(el.value); changed(); } else if (kind === 'pattern') { S.song.pattern = el.value; changed(); } else if (kind === 'lkey') { stopPlay(); S.lkey = Number(el.value); persist(); }
  render();
}

export function mount(root) {
  app = root;
  app.addEventListener('click', onClick);
  app.addEventListener('input', onInput);
  app.addEventListener('change', onInput);
  app.addEventListener('keydown', (e) => {
    const dot = e.target.closest?.('.dot');
    if (dot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick({ target: dot }); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.activeElement?.closest?.('button, a, select, input, [role="button"]')) return;
    if (S.screen === 'build' || S.screen === 'riff') { e.preventDefault(); ensureAudio(); ACTIONS.play(); render(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && S.playId) { stopPlay(); render(); }
  });
  render();
}
