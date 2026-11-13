// The practice area: review, one-minute sprint, rhythm gym, songbook, tuner.

import { h, mount, icon } from './dom.js';
import { store } from './store.js';
import { prefs } from './prefs.js';
import { audio } from './audio.js';
import { mic } from './mic.js';
import { LESSONS } from './curriculum.js';
import { isDone, noteStrength, recordNote } from './progress.js';
import { knownNotes, sprintQuestion, songPhrase } from './generate.js';
import { createExercise, playMelody } from './exercises.js';
import { session } from './lesson.js';
import { renderStaff } from './notation.js';
import { parseMelody } from './theory.js';
import { button, mascot, segmented, toast } from './ui.js';
import { micHelp } from './views.js';
import { makeRng, clamp, plural } from './util.js';

const pageHead = (title, nav, back = '/practice') => h('div', { class: 'page-head' },
  button(null, { kind: 'ghost', icon: 'arrow-left', cls: 'icon-only back', title: 'Back', onclick: () => nav.go(back) }), h('h1', null, title));

const songLessons = () => LESSONS.filter((l) => l.kind === 'song');
const rhythmLessons = () => LESSONS.filter((l) => l.kind === 'rhythm');

// ---------------------------------------------------------------------------
export function practiceView(nav) {
  const state = store.state;
  const notes = knownNotes(state);
  const now = Date.now();
  const due = notes.filter((n) => noteStrength(state, n.key, now) < 0.75).length;
  const songs = songLessons();
  const unlocked = songs.filter((l) => isDone(state, l.id)).length;
  const tooEarly = notes.length < 2;
  const card = (ic, tone, title, text, path, disabled = false) => h('button', {
    class: ['card', 'link-card', disabled && 'is-disabled'], type: 'button', disabled, dataset: { path }, onclick: () => nav.go(path),
  }, h('span', { class: `tile tone-${tone}` }, icon(ic)), h('span', { class: 'link-text' }, h('strong', null, title), h('small', null, text)), icon('caret-right', 'chev'));

  return h('div', { class: 'practice' },
    h('h1', { class: 'page-title' }, 'Practice'),
    card('brain', 'violet', 'Review weak notes', tooEarly ? 'Finish your first lesson to unlock this' : due ? `${plural(due, 'note')} could use some attention` : 'Everything looks strong — a review never hurts', '/review', tooEarly),
    card('timer', 'coral', 'One-minute sprint', tooEarly ? 'Finish your first lesson to unlock this' : state.stats.sprintBest ? `Your best: ${plural(state.stats.sprintBest, 'note')}` : 'How many notes can you read in 60 seconds?', '/sprint', tooEarly),
    card('metronome', 'blue', 'Rhythm gym', 'Six rhythms to tap, at the level you have reached', '/rhythm'),
    card('book-open', 'amber', 'Songbook', `${unlocked} of ${songs.length} songs unlocked`, '/songs'),
    card('gauge', 'green', 'Tuner', 'Tune your guitar using the microphone', '/tuner'));
}

// ---------------------------------------------------------------------------
// One-minute sprint
// ---------------------------------------------------------------------------
export function sprintView(nav) {
  const LIMIT = 60;
  const root = h('div', { class: 'sprint' });
  const notes = knownNotes(store.state);
  const settings = store.state.settings;
  let timer = null, pending = null, view = null, over = false;
  const api = { el: root, current: null, view: null, destroy: cleanup };

  function onKey(ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || document.querySelector('.modal-wrap')) return;
    if (view && view.key && view.key(ev)) ev.preventDefault();
  }
  function cleanup() {
    over = true;
    clearInterval(timer);
    clearTimeout(pending);
    document.removeEventListener('keydown', onKey);
    if (view && view.stop) view.stop();
    if (session.active === api) session.active = null;
  }

  function setup() {
    let mode = 'name';
    const useMic = prefs.get('input') === 'mic';
    mount(root, pageHead('One-minute sprint', nav),
      h('div', { class: 'card center' },
        mascot('wink', 'mascot-big'),
        h('p', { class: 'lead' }, 'Read as many notes as you can in 60 seconds. A wrong answer costs you a moment, so stay accurate.'),
        segmented([{ value: 'name', label: 'Name the notes' }, { value: 'find', label: useMic ? 'Play them' : 'Find them on the neck' }], mode, (v) => { mode = v; }, 'Kind of sprint'),
        button('Go!', { icon: 'play', cls: 'btn-wide go', onclick: () => play(mode) })));
  }

  async function play(mode) {
    audio.unlock();
    const listening = mode === 'find' && await nav.ensureMic();
    if (over) return;
    const rng = makeRng();
    const startedAt = performance.now();
    let score = 0, wrong = 0, last = null;
    const scoreEl = h('b', null, '0');
    const clock = h('b', null, String(LIMIT));
    const fill = h('i', { style: { width: '100%' } });
    const stage = h('div', { class: 'sprint-stage' });
    mount(root,
      h('div', { class: 'sprint-top' }, h('span', { class: 'chip' }, icon('timer'), clock), h('div', { class: 'bar' }, fill), h('span', { class: 'chip chip-on' }, icon('lightning'), scoreEl)),
      stage);

    const width = Math.max(260, Math.min(560, root.clientWidth || window.innerWidth) - 32);
    const context = () => ({
      width,
      staffWidth: width - 30,
      input: listening && mic.on ? 'mic' : 'tap',
      board: { leftHanded: Boolean(settings.leftHanded), lowOnTop: Boolean(settings.lowOnTop) },
      setFooter() {},
      useTapInstead() { mic.stop(); ask(); },
      done(result) {
        if (over) return;
        store.update((st) => { for (const n of result.notes || []) if (n.key) recordNote(st, n.key, n.correct, 0); });
        if (result.correct) { score++; scoreEl.textContent = String(score); audio.sfx('good'); }
        else { wrong++; audio.sfx('bad'); }
        pending = setTimeout(ask, result.correct ? 280 : 1300); // a miss shows the right answer for a moment
      },
    });
    function ask() {
      if (over) return;
      if (view && view.stop) view.stop();
      const q = sprintQuestion(rng, notes, mode, last);
      last = q.note.key;
      view = createExercise(q, context());
      api.current = q;
      api.view = view;
      mount(stage, view.el);
      if (view.start) view.start();
    }
    timer = setInterval(() => {
      const left = LIMIT - (performance.now() - startedAt) / 1000;
      clock.textContent = String(Math.max(0, Math.ceil(left)));
      fill.style.setProperty('width', `${Math.round(clamp(left / LIMIT, 0, 1) * 100)}%`);
      if (left <= 0) { cleanup(); nav.finishSprint({ score, wrong, mic: listening }); }
    }, 200);
    document.addEventListener('keydown', onKey);
    session.active = api;
    ask();
  }

  if (notes.length < 2) { nav.go('/practice'); return root; }
  setup();
  return api;
}

// ---------------------------------------------------------------------------
// Rhythm gym
// ---------------------------------------------------------------------------
export function rhythmView(nav) {
  const state = store.state;
  const all = rhythmLessons();
  const done = all.filter((l) => isDone(state, l.id));
  const offered = done.length ? done : [all[0]];
  let chosen = offered.at(-1);
  return h('div', { class: 'rhythm-gym' },
    pageHead('Rhythm gym', nav),
    h('div', { class: 'card center' },
      mascot('happy', 'mascot-big'),
      h('p', { class: 'lead' }, 'Six rhythms to tap along with the metronome. New rhythm lessons add new levels here.'),
      offered.length > 1 ? h('div', { class: 'level-list', role: 'group', 'aria-label': 'Level' }, offered.map((l) => h('button', {
        type: 'button', class: 'level', 'aria-pressed': String(l === chosen), dataset: { lesson: l.id },
        onclick: (ev) => { chosen = l; for (const b of ev.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === ev.currentTarget)); },
      }, icon('metronome'), l.title))) : h('p', { class: 'muted' }, `Level: ${chosen.title}`),
      button('Start', { icon: 'play', cls: 'btn-wide go', onclick: () => nav.startRhythm(chosen) })));
}

// ---------------------------------------------------------------------------
// Songbook
// ---------------------------------------------------------------------------
export function songsView(nav) {
  const state = store.state;
  return h('div', { class: 'songs' },
    pageHead('Songbook', nav),
    h('p', { class: 'muted' }, 'Every song you finish in the course lands here, ready to hear and play again.'),
    h('ul', { class: 'song-list' }, songLessons().map((l) => {
      const open = isDone(state, l.id);
      return h('li', null, h('button', {
        type: 'button', class: ['card', 'link-card', !open && 'is-locked'], dataset: { song: l.song.id },
        onclick: () => (open ? nav.go(`/song/${l.song.id}`) : toast(`Finish “${l.title}” in unit ${l.unit.index + 1} to unlock this song.`, { icon: 'lock' })),
      }, h('span', { class: `tile tone-${l.unit.tone}` }, icon(open ? 'music-notes' : 'lock')),
      h('span', { class: 'link-text' }, h('strong', null, l.song.title), h('small', null, l.song.credit)), icon('caret-right', 'chev')));
    })));
}

export function songView(nav, id) {
  const lesson = songLessons().find((l) => l.song.id === id);
  if (!lesson || !isDone(store.state, lesson.id)) { nav.go('/songs'); return h('div'); }
  const song = lesson.song;
  const measures = parseMelody(song.melody);
  const staff = renderStaff({ measures, timeSig: song.timeSig, keySig: song.keySig, width: Math.min(560, window.innerWidth) - 60, sp: 9.5 });
  let tempo = 1, playback = null;
  const playBtn = button('Play', { icon: 'play', cls: 'play-song', onclick: start });
  const stopBtn = button('Stop', { icon: 'stop', kind: 'soft', cls: 'stop-song', onclick: () => playback && playback.stop() });
  stopBtn.hidden = true;
  function start() {
    audio.unlock();
    if (!audio.enabled) toast('Sound is switched off in Settings — the playhead will still show the beat.', { icon: 'speaker-slash' });
    playback = playMelody(measures, Math.round(song.bpm * tempo), staff);
    playBtn.hidden = true;
    stopBtn.hidden = false;
    playback.done.then(() => { playback = null; playBtn.hidden = false; stopBtn.hidden = true; });
  }
  return {
    el: h('div', { class: 'song' },
      pageHead(song.title, nav, '/songs'),
      h('p', { class: 'muted' }, song.credit),
      h('div', { class: 'card staff-card staff-scroll' }, staff.el),
      h('div', { class: 'row-center' }, playBtn, stopBtn,
        segmented([{ value: 0.7, label: 'Slow' }, { value: 1, label: 'Normal' }, { value: 1.15, label: 'Fast' }], tempo, (v) => { tempo = Number(v); }, 'Tempo')),
      button('Play it yourself', {
        kind: 'soft', icon: 'guitar', cls: 'btn-wide practise-song',
        onclick: () => nav.runPractice({
          exercises: [songPhrase(song, song.melody, lesson.frets, { title: song.title })], xp: 5, back: `/song/${song.id}`,
          heading: `You played ${song.title}!`,
        }),
      })),
    destroy() { if (playback) playback.stop(); },
  };
}

// ---------------------------------------------------------------------------
// Tuner
// ---------------------------------------------------------------------------
export function tunerView(nav) {
  const STRINGS = [[6, 'E', 40], [5, 'A', 45], [4, 'D', 50], [3, 'G', 55], [2, 'B', 59], [1, 'E', 64]];
  const note = h('strong', { class: 'tuner-note' }, '–');
  const detail = h('p', { class: 'tuner-detail', 'aria-live': 'polite' }, 'Start the tuner, then pluck one open string.');
  const needle = h('i', { class: 'needle' });
  const chips = STRINGS.map(([st, name]) => h('li', { dataset: { s: st } }, h('b', null, name), h('small', null, `string ${st}`)));
  const face = h('div', { class: 'tuner-face' }, note, h('div', { class: 'tuner-scale' }, h('span', null, 'flat'), h('div', { class: 'tuner-track' }, h('i', { class: 'tuner-mid' }), needle), h('span', null, 'sharp')), detail);
  const startBtn = button('Start the tuner', { icon: 'microphone', cls: 'btn-wide start-tuner', onclick: start });
  let timer = null, quiet = 0;

  async function start() {
    if (!mic.supported) { micHelp(); return; }
    try { audio.unlock(); await mic.start(); } catch (err) {
      toast(err && err.name === 'NotAllowedError' ? 'Microphone permission was refused. Allow it in the browser’s site settings.' : 'The microphone could not be started.', { icon: 'microphone-slash', ms: 4500 });
      return;
    }
    startBtn.hidden = true;
    detail.textContent = 'Listening — pluck one open string.';
    timer = setInterval(tick, 80);
  }
  function tick() {
    const cur = mic.current;
    if (!cur) {
      if (++quiet > 18) { face.classList.remove('is-tuned'); for (const c of chips) c.classList.remove('is-on'); }
      return;
    }
    quiet = 0;
    const exact = cur.midi + cur.cents / 100;
    let best = STRINGS[0];
    for (const str of STRINGS) if (Math.abs(exact - str[2]) < Math.abs(exact - best[2])) best = str;
    const cents = Math.round((exact - best[2]) * 100);
    const tuned = Math.abs(cents) <= 5;
    note.textContent = best[1];
    needle.style.setProperty('left', `${50 + clamp(cents, -50, 50)}%`);
    face.classList.toggle('is-tuned', tuned);
    detail.textContent = tuned ? `String ${best[0]} is in tune.`
      : Math.abs(cents) > 250 ? `That is far from string ${best[0]} — check you are plucking the right string.`
        : cents < 0 ? `String ${best[0]}: ${-cents} cents flat — tighten it a little.` : `String ${best[0]}: ${cents} cents sharp — loosen it a little.`;
    for (const c of chips) c.classList.toggle('is-on', Number(c.dataset.s) === best[0]);
  }
  return {
    el: h('div', { class: 'tuner' }, pageHead('Tuner', nav), h('div', { class: 'card center' }, face, h('ol', { class: 'tuner-strings' }, chips), startBtn)),
    destroy() { clearInterval(timer); mic.stop(); },
  };
}
