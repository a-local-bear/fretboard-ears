// One view per exercise type.  A view is {el, start?, stop?, key?}; it reports
// its outcome exactly once through ctx.done({correct, answer, tip, notes, auto, ...}):
//   answer = the right answer (shown after a mistake), tip = a remark shown instead,
//   notes = [{key, correct}] for the per-note memory, auto = may move on without a tap.
//
// ctx (provided by the lesson runner):
//   width     usable content width in px (a fretboard may be this wide)
//   staffWidth  room for a staff inside a card (a little narrower)
//   input     'tap' (on-screen fretboard) or 'mic' (a real guitar)
//   board     fretboard display options from the player's settings
//   done(r)   report the result
//   setFooter(node|null)   put a custom button in the footer (used by teaching cards)
//   useTapInstead()        give up on the microphone for this session

import { h, mount, icon } from './dom.js';
import { renderStaff, symbolSvg } from './notation.js';
import { createFretboard } from './fretboard.js';
import { parseMelody, onsets, timeline, OPEN, describePos, describeStep, noteFromKey, pitchName, spell, measureBeats, shortPos, WRITTEN_SHIFT } from './theory.js';
import { audio } from './audio.js';
import { mic } from './mic.js';
import { prefs } from './prefs.js';
import { button, noteLabel, mascot } from './ui.js';
import { SYMBOLS } from './generate.js';
import { clamp, plural } from './util.js';

const prompt = (...content) => h('h2', { class: 'prompt' }, content);
const cap = (text) => text[0].toUpperCase() + text.slice(1);
const totalBeats = (measures) => measures.flat().reduce((a, e) => a + e.dur.beats, 0);
const perfNow = () => performance.now() / 1000;
const eventStamp = (ev) => (ev && ev.timeStamp > 0 && Math.abs(ev.timeStamp - performance.now()) < 5000 ? ev.timeStamp : performance.now()) / 1000;

/** "F — 1st string, 1st fret" */
const answerLine = (note) => [noteLabel(note.nameId), ` — ${describePos(note)}`];

/** a staff showing one whole note */
function flashcard(pitch, ctx, ex, { sp = 12, minWidth = 210 } = {}) {
  return renderStaff({
    measures: parseMelody(`${pitch}:w`), endBar: 'none', stretch: false, sp, minWidth, width: ctx.staffWidth ?? ctx.width,
    keySig: ex.keySig ?? 0, range: ex.range ?? null, explicit: ex.explicit,
  });
}

function board(ctx, frets, onTap) {
  return createFretboard({ frets, width: ctx.width, onTap, compact: frets[1] - frets[0] > 8, ...ctx.board });
}

/** indices of the staff events that each struck note covers (a tied note covers several) */
function eventMap(measures) {
  const events = timeline(measures);
  return onsets(measures).map((o) => events.map((e, i) => (e.pitch && e.t >= o.t - 1e-9 && e.t < o.t + o.beats - 1e-9 ? i : -1)).filter((i) => i >= 0));
}

/**
 * Play a melody through the speakers while moving the playhead of `staff`.
 * Returns {stop, done}; done resolves true when it played to the end.
 */
export function playMelody(measures, bpm, staff, { clicks = false, timeSig = null, countIn = false } = {}) {
  const ac = audio.unlock();
  const spb = 60 / bpm;
  const total = totalBeats(measures);
  const lead = countIn && timeSig ? measureBeats(timeSig) : 0;
  const p0 = perfNow() + 0.15 + lead * spb;         // when beat 0 happens, on the page clock
  const toAudio = ac ? ac.currentTime - perfNow() : 0;
  for (const o of onsets(measures)) {
    audio.pluck(o.pitch.midi - WRITTEN_SHIFT, { when: p0 + o.t * spb + toAudio, duration: Math.max(0.14, o.beats * spb * 0.94) });
  }
  if (clicks && timeSig) {
    const perBar = measureBeats(timeSig);
    for (let b = -lead; b < total; b++) audio.click(p0 + b * spb + toAudio, ((b % perBar) + perBar) % perBar === 0);
  }
  let raf = 0, over = false, finish;
  const done = new Promise((resolve) => { finish = resolve; });
  const end = (played) => { if (over) return; over = true; cancelAnimationFrame(raf); if (staff) staff.playhead(null); finish(played); };
  const frame = () => {
    const t = (perfNow() - p0) / spb;
    if (t >= total + 0.2) { end(true); return; }
    if (staff) staff.playhead(t < 0 ? null : Math.min(t, total));
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { done, stop() { if (!over) { audio.stopAll(); end(false); } } };
}

/** microphone status strip: level meter, the note being heard, and a way out */
function listenPanel(ctx, text) {
  const fill = h('i');
  const heard = h('strong', null, '…');
  const hint = h('p', { class: 'listen-hint' }, text);
  const el = h('div', { class: 'listen' },
    h('div', { class: 'listen-row' }, icon('microphone'), h('div', { class: 'meter' }, fill), h('span', { class: 'heard' }, 'I hear ', heard)),
    hint,
    button('Use the on-screen fretboard instead', { kind: 'ghost', cls: 'btn-small', onclick: () => ctx.useTapInstead() }));
  const timer = setInterval(() => {
    fill.style.setProperty('width', `${Math.min(100, Math.round(Math.sqrt(mic.level) * 190))}%`);
    const cur = mic.current;
    heard.textContent = cur ? pitchName(spell(cur.midi)) : '…';
  }, 90);
  return { el, say(t) { hint.textContent = t; }, stop() { clearInterval(timer); } };
}

// ---------------------------------------------------------------------------
// Teaching cards
// ---------------------------------------------------------------------------
function introView(ex, ctx) {
  let index = 0;
  const stage = h('div', { class: 'intro-stage' });
  const dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, ex.cards.map(() => h('i')));

  function visuals(card) {
    const out = [];
    if (card.note) {
      const staff = flashcard(card.note.pitch, ctx, {}, { sp: 11 });
      const fb = board(ctx, card.frets, null);
      fb.mark(card.note.s, card.note.f, 'show', card.note.name);
      const hear = () => audio.pluck(card.note.sounding);
      out.push(h('div', { class: 'card staff-card' }, staff.el), h('div', { class: 'fb-wrap' }, fb.el),
        button('Hear it', { kind: 'soft', icon: 'speaker-high', cls: 'btn-small hear', onclick: hear }));
      if (audio.context && audio.context.state === 'running') hear();
    }
    if (card.staff) {
      const st = card.staff;
      const staff = renderStaff({
        measures: parseMelody(st.melody), timeSig: st.timeSig ?? null, keySig: st.keySig ?? 0, counts: st.counts ?? null,
        labels: Boolean(st.labels), explicit: Boolean(st.explicit), width: ctx.staffWidth, sp: 10,
        endBar: st.timeSig ? 'final' : 'none', stretch: Boolean(st.timeSig),
      });
      out.push(h('div', { class: 'card staff-card' }, staff.el));
    }
    if (card.fretboard) {
      const fb = board(ctx, card.fretboard.frets, null);
      for (const m of card.fretboard.marks) fb.mark(m.s, m.f, 'show', m.label);
      out.push(h('div', { class: 'fb-wrap' }, fb.el));
    }
    if (card.symbols) {
      out.push(h('ul', { class: 'symbol-list' }, card.symbols.map(([sym, name, detail]) =>
        h('li', null, h('span', { class: 'symbol-cell' }, symbolSvg(sym, { sp: 9 })), h('span', null, h('strong', null, name), h('small', null, detail))))));
    }
    if (card.songArt) out.push(h('div', { class: 'song-art' }, icon('music-notes')));
    return out;
  }

  function render() {
    const card = ex.cards[index];
    mount(stage,
      h('div', { class: 'bubble-row' }, mascot(index === 0 ? 'happy' : 'wink', 'mascot-small'),
        h('div', { class: 'bubble' }, h('h2', null, card.title), h('p', null, card.text))),
      visuals(card));
    [...dots.children].forEach((d, i) => d.classList.toggle('is-on', i === index));
    ctx.setFooter(button(index < ex.cards.length - 1 ? 'Continue' : 'Start practising', { cls: 'btn-wide next', onclick: next }));
  }
  function next() {
    if (index < ex.cards.length - 1) { index++; render(); } else { ctx.setFooter(null); ctx.done({ skip: true }); }
  }
  const el = h('div', { class: 'ex ex-intro' }, stage, ex.cards.length > 1 ? dots : null);
  return { el, start: render, key: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { next(); return true; } return false; } };
}

// ---------------------------------------------------------------------------
// Single notes
// ---------------------------------------------------------------------------
function nameButtons(ex, onPick) {
  const buttons = ex.choices.map((id) => h('button', { class: 'choice choice-note', type: 'button', dataset: { id }, onclick: () => onPick(id) }, noteLabel(id)));
  const reveal = (picked) => {
    for (const b of buttons) {
      b.disabled = true;
      if (b.dataset.id === ex.answer) b.classList.add('is-good');
      else if (b.dataset.id === picked) b.classList.add('is-bad');
    }
  };
  const el = h('div', { class: ['choices', ex.choices.length > 4 ? 'choices-seven' : 'choices-row'] }, buttons);
  const key = (ev) => {
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : '';
    if (!ex.choices.includes(k)) return false;
    onPick(k);
    return true;
  };
  return { el, reveal, key };
}

function nameView(ex, ctx) {
  const staff = flashcard(ex.note.pitch, ctx, ex);
  let over = false;
  const pick = (id) => {
    if (over) return;
    over = true;
    const correct = id === ex.answer;
    choices.reveal(id);
    staff.setState(0, correct ? 'good' : 'bad');
    audio.pluck(ex.note.sounding, { gain: 0.55 });
    ctx.done({ correct, auto: true, answer: answerLine(ex.note), notes: [{ key: ex.note.key, correct }] });
  };
  const choices = nameButtons(ex, pick);
  return { el: h('div', { class: 'ex ex-name' }, prompt('Which note is this?'), h('div', { class: 'card staff-card' }, staff.el), choices.el), key: choices.key };
}

function findView(ex, ctx) {
  if (ctx.input === 'mic') return playNoteView(ex, ctx);
  const staff = flashcard(ex.note.pitch, ctx, ex);
  let over = false;
  const fb = board(ctx, ex.frets, (st, f) => {
    if (over) return;
    over = true;
    const sounding = OPEN[st] + f;
    const correct = sounding === ex.note.sounding;
    audio.pluck(sounding);
    fb.setEnabled(false);
    fb.mark(st, f, correct ? 'good' : 'bad', correct ? ex.note.name : '');
    if (!correct) fb.mark(ex.note.s, ex.note.f, 'show', ex.note.name);
    staff.setState(0, correct ? 'good' : 'bad');
    ctx.done({ correct, auto: true, answer: answerLine(ex.note), notes: [{ key: ex.note.key, correct }] });
  });
  return { el: h('div', { class: 'ex ex-find' }, prompt('Where do you play this note?'), h('div', { class: 'card staff-card' }, staff.el), h('div', { class: 'fb-wrap' }, fb.el)) };
}

/** the microphone version of "find": play the note on a real guitar */
function playNoteView(ex, ctx) {
  const staff = flashcard(ex.note.pitch, ctx, ex);
  const panel = listenPanel(ctx, 'Listening — play this note on your guitar.');
  let over = false, strikes = 0;
  const finish = (correct) => {
    if (over) return;
    over = true;
    staff.setState(0, correct ? 'good' : 'bad');
    ctx.done({ correct, auto: true, answer: answerLine(ex.note), notes: [{ key: ex.note.key, correct }], mic: true });
  };
  const off = mic.onNote((n) => {
    if (over) return;
    if (n.midi === ex.note.sounding) finish(true);
    else if ((n.midi - ex.note.sounding) % 12 === 0) panel.say(`That was ${pitchName(spell(n.midi))} in a different octave — look where the note sits on the staff.`);
    else if (++strikes >= 2) finish(false);
    else panel.say(`I heard ${pitchName(spell(n.midi))}. Have one more go.`);
  });
  staff.setState(0, 'active');
  return {
    el: h('div', { class: 'ex ex-find' }, prompt('Play this note on your guitar'), h('div', { class: 'card staff-card' }, staff.el), panel.el),
    stop() { off(); panel.stop(); },
  };
}

function staffOptions(ex, ctx, onPick, { row = true } = {}) {
  const buttons = ex.options.map((o, i) => {
    const staff = flashcard(o.pitch, { width: 150 }, ex, { sp: 9, minWidth: 104 });
    return h('button', { class: 'option', type: 'button', dataset: { i }, 'aria-label': `Option ${i + 1}`, onclick: () => onPick(i) }, staff.el);
  });
  const reveal = (picked) => buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === ex.answer) b.classList.add('is-good'); else if (i === picked) b.classList.add('is-bad');
  });
  const key = (ev) => { const i = Number(ev.key) - 1; if (!(i >= 0 && i < buttons.length)) return false; onPick(i); return true; };
  return { el: h('div', { class: row ? 'options options-row' : 'options' }, buttons), reveal, key };
}

function pickStaffView(ex, ctx) {
  let over = false;
  const options = staffOptions(ex, ctx, (i) => {
    if (over) return;
    over = true;
    const correct = i === ex.answer;
    options.reveal(i);
    ctx.done({
      correct, auto: true, notes: ex.target.key ? [{ key: ex.target.key, correct }] : [],
      answer: [noteLabel(ex.target.nameId), ` sits ${describeStep(ex.target.step)}`],
    });
  });
  return { el: h('div', { class: 'ex ex-pick' }, prompt('Which one is ', noteLabel(ex.target.nameId), '?'), options.el), key: options.key };
}

function fretToStaffView(ex, ctx) {
  let over = false;
  const fb = board(ctx, ex.frets, null);
  fb.mark(ex.note.s, ex.note.f, 'show');
  const options = staffOptions(ex, ctx, (i) => {
    if (over) return;
    over = true;
    const correct = i === ex.answer;
    options.reveal(i);
    fb.mark(ex.note.s, ex.note.f, correct ? 'good' : 'show', ex.note.name);
    ctx.done({ correct, auto: true, answer: answerLine(ex.note), notes: [{ key: ex.note.key, correct }] });
  });
  return {
    el: h('div', { class: 'ex ex-fret-staff' }, prompt('How is this note written?'), h('div', { class: 'fb-wrap' }, fb.el), options.el),
    start() { audio.pluck(ex.note.sounding, { gain: 0.6 }); },
    key: options.key,
  };
}

function fretToNameView(ex, ctx) {
  let over = false;
  const fb = board(ctx, ex.frets, null);
  fb.mark(ex.note.s, ex.note.f, 'show');
  const choices = nameButtons(ex, (id) => {
    if (over) return;
    over = true;
    const correct = id === ex.answer;
    choices.reveal(id);
    fb.mark(ex.note.s, ex.note.f, correct ? 'good' : 'show', ex.note.name);
    ctx.done({ correct, auto: true, answer: answerLine(ex.note), notes: [{ key: ex.note.key, correct }] });
  });
  return {
    el: h('div', { class: 'ex ex-fret-name' }, prompt('What is this note called?'), h('div', { class: 'fb-wrap' }, fb.el), choices.el),
    start() { audio.pluck(ex.note.sounding, { gain: 0.6 }); },
    key: choices.key,
  };
}

// ---------------------------------------------------------------------------
// Matching pairs
// ---------------------------------------------------------------------------
function pairsView(ex, ctx) {
  const idOf = (n) => (ex.mode === 'name' ? n.nameId : n.key);
  let right = ex.notes.slice().sort(() => Math.random() - 0.5);
  if (right.every((n, i) => n === ex.notes[i])) right = [...right.slice(1), right[0]];
  const wrong = new Set();
  let picked = { l: null, r: null }, slips = 0, matched = 0, over = false;

  const make = (side, n, content) => {
    const b = h('button', { class: `pair pair-${side}`, type: 'button', dataset: { side, k: idOf(n) } }, content);
    b.addEventListener('click', () => choose(side, b));
    return b;
  };
  const left = ex.notes.map((n) => make('l', n, flashcard(n.pitch, { width: 150 }, ex, { sp: 8.5, minWidth: 96 }).el));
  const rightEls = right.map((n) => make('r', n, ex.mode === 'name' ? noteLabel(n.nameId) : h('span', { class: 'pair-place' }, cap(shortPos(n)))));

  function choose(side, b) {
    if (over || b.disabled) return;
    if (picked[side]) picked[side].classList.remove('is-picked');
    picked[side] = b;
    b.classList.add('is-picked');
    if (!picked.l || !picked.r) return;
    const [a, c] = [picked.l, picked.r];
    picked = { l: null, r: null };
    a.classList.remove('is-picked');
    c.classList.remove('is-picked');
    if (a.dataset.k === c.dataset.k) {
      for (const el of [a, c]) { el.disabled = true; el.classList.add('is-good'); }
      audio.sfx('match');
      if (++matched === ex.notes.length) finish();
    } else {
      slips++;
      wrong.add(a.dataset.k);
      wrong.add(c.dataset.k);
      for (const el of [a, c]) { el.classList.add('is-bad'); setTimeout(() => el.classList.remove('is-bad'), 450); }
    }
  }
  function finish() {
    over = true;
    ctx.done({
      correct: slips < 2, auto: slips === 0, slips,
      tip: slips >= 2 ? `${plural(slips, 'mismatch', 'mismatches')} — look closely at lines and spaces.` : null,
      notes: ex.notes.map((n) => ({ key: n.key, correct: !wrong.has(idOf(n)) })),
    });
  }
  return {
    el: h('div', { class: 'ex ex-pairs' }, prompt(ex.mode === 'name' ? 'Match each note to its name' : 'Match each note to its place on the neck'),
      h('div', { class: 'pairs' }, h('div', { class: 'pair-col' }, left), h('div', { class: 'pair-col' }, rightEls))),
  };
}

// ---------------------------------------------------------------------------
// Phrases and songs
// ---------------------------------------------------------------------------
function phraseView(ex, ctx) {
  const measures = parseMelody(ex.melody);
  const hits = onsets(measures);
  const covers = eventMap(measures);
  const expected = ex.where.map((key) => noteFromKey(key));
  const useMic = ctx.input === 'mic';
  const staff = renderStaff({
    measures, timeSig: ex.timeSig, keySig: ex.keySig ?? 0, width: ctx.staffWidth, sp: ex.timeSig ? 9.5 : 11,
    range: ex.timeSig ? null : ex.range ?? null, explicit: ex.explicit, endBar: ex.timeSig ? 'final' : 'none', stretch: Boolean(ex.timeSig),
  });
  const troubled = new Set();
  let pos = 0, misses = 0, over = false, playback = null;

  const paint = (i, state) => { for (const idx of covers[i]) staff.setState(idx, state); };
  const advance = () => {
    paint(pos, troubled.has(pos) ? 'bad' : 'good');
    pos++;
    misses = 0;
    if (pos < hits.length) paint(pos, 'active'); else finish();
  };
  function finish() {
    over = true;
    if (fb) fb.setEnabled(false);
    const allowed = Math.floor(hits.length * 0.2);
    const correct = troubled.size <= allowed;
    if (ex.timeSig && !useMic) playback = playMelody(measures, ex.bpm, staff);
    ctx.done({
      correct, auto: false, mic: useMic,
      praise: troubled.size === 0 ? (ex.final ? 'You just played the whole tune!' : 'Clean reading!') : 'Good — almost spotless.',
      tip: correct ? null : `${plural(troubled.size, 'note')} of ${hits.length} needed another try. Slow down and read one note at a time.`,
      notes: expected.map((n, i) => ({ key: n.key, correct: !troubled.has(i) })),
    });
  }

  let fb = null, panel = null, off = null;
  if (!useMic) {
    fb = board(ctx, ex.frets, (st, f) => {
      if (over) return;
      const want = expected[pos];
      const sounding = OPEN[st] + f;
      if (sounding === want.sounding) {
        audio.pluck(sounding);
        fb.clear();
        fb.flash(st, f, 'good', 420);
        advance();
      } else {
        audio.pluck(sounding, { gain: 0.35 });
        troubled.add(pos);
        fb.flash(st, f, 'bad', 500);
        if (++misses >= 2) fb.mark(want.s, want.f, 'hint', want.name); // do not leave anyone stuck
      }
    });
  } else {
    panel = listenPanel(ctx, 'Listening — play the highlighted note.');
    off = mic.onNote((n) => {
      if (over) return;
      const want = expected[pos];
      if (n.midi === want.sounding) { panel.say('Listening — play the highlighted note.'); advance(); return; }
      if (pos > 0 && n.midi === expected[pos - 1].sounding) return;          // the previous note still ringing
      if ((n.midi - want.sounding) % 12 === 0) { panel.say('Right letter, wrong octave — check how high the note sits.'); return; }
      troubled.add(pos);
      panel.say(++misses >= 2 ? `I heard ${pitchName(spell(n.midi))}. This one is the ${describePos(want)}.` : `I heard ${pitchName(spell(n.midi))} — try again.`);
    });
  }

  const hearBtn = ex.song ? button('Hear it', { kind: 'soft', icon: 'ear', cls: 'btn-small', onclick: () => { if (playback) playback.stop(); playback = playMelody(measures, ex.bpm, staff); } }) : null;
  const heading = ex.title ? ex.title : useMic ? 'Play this on your guitar' : 'Play these notes in order';
  return {
    el: h('div', { class: 'ex ex-phrase' }, prompt(heading), h('div', { class: 'card staff-card staff-scroll' }, staff.el), hearBtn,
      fb ? h('div', { class: 'fb-wrap' }, fb.el) : panel.el),
    start() { paint(0, 'active'); },
    stop() { if (off) off(); if (panel) panel.stop(); if (playback) playback.stop(); },
  };
}

function hearPhraseView(ex, ctx) {
  let over = false, playback = null;
  const play = () => { if (playback) playback.stop(); playback = playMelody(parseMelody(ex.options[ex.answer]), ex.bpm, null); };
  const buttons = ex.options.map((melody, i) => {
    const staff = renderStaff({ measures: parseMelody(melody), width: Math.min(ctx.width - 28, 300), sp: 9, endBar: 'none', stretch: false, keySig: ex.keySig ?? 0, range: ex.range ?? null, explicit: ex.explicit });
    return h('button', { class: 'option option-wide', type: 'button', dataset: { i }, 'aria-label': `Option ${i + 1}`, onclick: () => pick(i) }, staff.el);
  });
  function pick(i) {
    if (over) return;
    over = true;
    const correct = i === ex.answer;
    buttons.forEach((b, k) => { b.disabled = true; if (k === ex.answer) b.classList.add('is-good'); else if (k === i) b.classList.add('is-bad'); });
    ctx.done({ correct, auto: true, tip: 'The tune you heard is the one outlined in green.', notes: [] });
  }
  return {
    el: h('div', { class: 'ex ex-hear' }, prompt('Listen. Which one do you hear?'),
      button('Play', { kind: 'soft', icon: 'speaker-high', cls: 'listen-btn', onclick: play }), h('div', { class: 'options' }, buttons)),
    start() { setTimeout(() => { if (!over) play(); }, 350); },
    stop() { if (playback) playback.stop(); },
    key: (ev) => { const i = Number(ev.key) - 1; if (!(i >= 0 && i < 3)) return false; pick(i); return true; },
  };
}

// ---------------------------------------------------------------------------
// Rhythm
// ---------------------------------------------------------------------------
/** compare taps with the expected onsets; times are seconds from beat 0 */
export function judgeTaps(expected, taps, { storedOffset = 0 } = {}) {
  const got = taps.filter((t) => t > -0.3).sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < expected.length; i++) minGap = Math.min(minGap, expected[i] - expected[i - 1]);
  if (!Number.isFinite(minGap)) minGap = 1;
  const match = (shift, window) => {
    const used = new Set();
    const pairs = [];
    expected.forEach((want, i) => {
      let best = -1, bestD = window;
      got.forEach((t, j) => { const d = Math.abs(t - shift - want); if (!used.has(j) && d <= bestD) { best = j; bestD = d; } });
      if (best >= 0) { used.add(best); pairs.push([i, got[best] - shift - want]); }
    });
    return { pairs, extras: got.length - used.size };
  };
  // Everyone taps a little early or late in a consistent way (audio latency, touch
  // screens, habit).  Estimate that steady offset and judge the rhythm relative to it.
  let shift = storedOffset;
  const rough = match(storedOffset, Math.min(0.3, minGap * 0.48));
  if (rough.pairs.length >= 2) {
    const devs = rough.pairs.map((p) => p[1]).sort((a, b) => a - b);
    shift = clamp(storedOffset + devs[Math.floor(devs.length / 2)], -0.25, 0.25);
  }
  const fine = match(shift, Math.min(0.15, minGap * 0.42));
  const hit = new Set(fine.pairs.map((p) => p[0]));
  const misses = expected.length - hit.size;
  const slack = expected.length >= 8 ? 1 : 0;
  return { hit, misses, extras: fine.extras, shift, matched: rough.pairs.length, correct: misses + Math.max(0, fine.extras - 1) <= slack };
}

function rhythmTapView(ex, ctx) {
  const measures = parseMelody(ex.melody);
  const hits = onsets(measures);
  const covers = eventMap(measures);
  const total = totalBeats(measures);
  const perBar = measureBeats(ex.timeSig);
  const spb = 60 / ex.bpm;
  const staff = renderStaff({ measures, timeSig: ex.timeSig, width: ctx.staffWidth, sp: 10, counts: ex.counts });
  let phase = 'idle'; // idle | arming | count | run | over
  let tStart = 0, taps = [], raf = 0, demo = null;

  const status = h('div', { class: 'count-in', 'aria-live': 'polite' }, `♩ = ${ex.bpm}`);
  const pad = h('button', { class: 'tap-pad', type: 'button', disabled: true }, icon('hand-tap'), h('span', null, 'Tap here'));
  const startBtn = button('Start', { icon: 'play', cls: 'start', onclick: start });
  const demoBtn = button('Hear it first', { kind: 'soft', icon: 'ear', cls: 'btn-small', onclick: hear });

  function tap(ev) {
    if (phase !== 'count' && phase !== 'run') return;
    taps.push(eventStamp(ev) - tStart);
    // no tap sound: on phones it would arrive late and blur the beat; the pad's movement is the feedback
    pad.classList.add('is-hit');
    setTimeout(() => pad.classList.remove('is-hit'), 90);
  }
  pad.addEventListener('pointerdown', (ev) => { ev.preventDefault(); tap(ev); });

  function hear() {
    if (phase !== 'idle') return;
    if (demo) demo.stop();
    demo = playMelody(measures, ex.bpm, staff, { clicks: true, timeSig: ex.timeSig, countIn: true });
  }
  async function start() {
    if (phase !== 'idle') return;
    phase = 'arming';
    if (demo) demo.stop();
    startBtn.disabled = true;
    demoBtn.disabled = true;
    const ac = audio.unlock();
    // make sure the audio clock is really ticking before lining the clicks up with it
    if (ac && ac.state !== 'running') { try { await ac.resume(); } catch { /* play silently */ } }
    if (phase !== 'arming') return;
    const latency = ac ? ac.outputLatency || ac.baseLatency || 0 : 0;
    const toAudio = ac ? ac.currentTime - perfNow() : 0;
    // tStart is the moment beat 0 is *heard*, on the page clock
    tStart = perfNow() + 0.35 + perBar * spb + latency;
    for (let b = -perBar; b < total; b++) audio.click(tStart - latency + b * spb + toAudio, ((b % perBar) + perBar) % perBar === 0);
    taps = [];
    phase = 'count';
    pad.disabled = false;
    pad.focus();
    raf = requestAnimationFrame(frame);
  }
  function frame() {
    const beat = (perfNow() - tStart) / spb;
    if (beat < 0) {
      const n = Math.floor(beat + perBar) + 1;
      status.textContent = n >= 1 ? String(n) : 'Ready…';
    } else if (beat < total) {
      if (phase === 'count') { phase = 'run'; status.textContent = 'Go!'; }
      staff.playhead(beat);
    } else if (beat >= total + 0.45 / spb) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  function finish() {
    phase = 'over';
    pad.disabled = true;
    staff.playhead(null);
    const result = judgeTaps(hits.map((o) => o.t * spb), taps, { storedOffset: prefs.get('tapOffset') || 0 });
    if (result.matched >= 3) prefs.set('tapOffset', Math.round(((prefs.get('tapOffset') || 0) * 0.7 + result.shift * 0.3) * 1000) / 1000);
    hits.forEach((o, i) => { for (const idx of covers[i]) staff.setState(idx, result.hit.has(i) ? 'good' : 'bad'); });
    const parts = [];
    if (result.misses) parts.push(`${plural(result.misses, 'note')} missed or off the beat`);
    if (result.extras > 1) parts.push(`${result.extras} extra taps`);
    status.textContent = result.correct ? 'Right on the beat!' : 'Not quite';
    ctx.done({
      correct: result.correct, auto: false, notes: [], praise: 'Right on the beat!',
      tip: result.correct ? null : `${cap(parts.join(' and ') || 'the timing drifted')}. Count out loud and tap only where a note begins.`,
    });
  }
  return {
    el: h('div', { class: 'ex ex-rhythm' }, prompt('Tap this rhythm'), h('div', { class: 'card staff-card staff-scroll' }, staff.el),
      status, pad, h('div', { class: 'row-center' }, startBtn, demoBtn)),
    stop() { cancelAnimationFrame(raf); if (demo) demo.stop(); if (phase === 'count' || phase === 'run') audio.stopAll(); phase = 'over'; },
    key(ev) {
      if (ev.key !== ' ' && ev.key !== 'Enter') return false;
      if (phase === 'idle') start(); else tap(ev);
      return true;
    },
  };
}

function rhythmHearView(ex, ctx) {
  let over = false, playback = null;
  const play = () => {
    if (playback) playback.stop();
    playback = playMelody(parseMelody(ex.options[ex.answer]), ex.bpm, null, { clicks: true, timeSig: ex.timeSig, countIn: true });
  };
  const buttons = ex.options.map((melody, i) => {
    const staff = renderStaff({ measures: parseMelody(melody), timeSig: ex.timeSig, width: Math.min(ctx.width - 28, 330), sp: 8.5, stretch: false });
    return h('button', { class: 'option option-wide', type: 'button', dataset: { i }, 'aria-label': `Option ${i + 1}`, onclick: () => pick(i) }, staff.el);
  });
  function pick(i) {
    if (over) return;
    over = true;
    const correct = i === ex.answer;
    buttons.forEach((b, k) => { b.disabled = true; if (k === ex.answer) b.classList.add('is-good'); else if (k === i) b.classList.add('is-bad'); });
    ctx.done({ correct, auto: true, tip: 'The rhythm you heard is the one outlined in green.', notes: [] });
  }
  return {
    el: h('div', { class: 'ex ex-hear' }, prompt('Listen to the count-in, then the rhythm. Which one is it?'),
      button('Play', { kind: 'soft', icon: 'speaker-high', cls: 'listen-btn', onclick: play }), h('div', { class: 'options' }, buttons)),
    start() { setTimeout(() => { if (!over) play(); }, 350); },
    stop() { if (playback) playback.stop(); },
    key: (ev) => { const i = Number(ev.key) - 1; if (!(i >= 0 && i < 3)) return false; pick(i); return true; },
  };
}

// ---------------------------------------------------------------------------
// Multiple choice
// ---------------------------------------------------------------------------
function mcqView(ex, ctx) {
  let over = false;
  const visual = [];
  if (ex.visual?.symbol) visual.push(h('div', { class: 'card symbol-big' }, symbolSvg(ex.visual.symbol, { sp: 15 })));
  if (ex.visual?.symbols) visual.push(h('div', { class: 'card symbol-big' }, ex.visual.symbols.map((sym) => symbolSvg(sym, { sp: 13 }))));
  if (ex.visual?.staff) {
    const st = ex.visual.staff;
    const staff = renderStaff({
      measures: parseMelody(st.melody), timeSig: st.timeSig ?? null, keySig: st.keySig ?? 0, width: ctx.staffWidth, sp: 11, stretch: false,
      endBar: st.endBar ?? (st.timeSig ? 'final' : 'none'), minWidth: st.minWidth ?? 0, range: st.range ?? null,
    });
    if (st.mark != null) staff.setState(st.mark, 'active');
    visual.push(h('div', { class: 'card staff-card' }, staff.el));
  }
  const describe = (c) => (c.label ? c.label : c.symbol ? cap(SYMBOLS[c.symbol][1]) : noteLabel(c.note));
  const buttons = ex.choices.map((c, i) => h('button', {
    class: ['choice', c.symbol ? 'choice-symbol' : c.note ? 'choice-note' : 'choice-text'], type: 'button', dataset: { i },
    'aria-label': c.symbol ? cap(SYMBOLS[c.symbol][1]) : null, onclick: () => pick(i),
  }, c.label ? c.label : c.symbol ? symbolSvg(c.symbol, { sp: 10 }) : noteLabel(c.note)));
  function pick(i) {
    if (over) return;
    over = true;
    const correct = i === ex.answer;
    buttons.forEach((b, k) => { b.disabled = true; if (k === ex.answer) b.classList.add('is-good'); else if (k === i) b.classList.add('is-bad'); });
    ctx.done({ correct, auto: true, answer: describe(ex.choices[ex.answer]), notes: [] });
  }
  const compact = ex.choices.every((c) => !c.label || c.label.length <= 9);
  return {
    el: h('div', { class: 'ex ex-mcq' }, prompt(ex.prompt), visual, h('div', { class: ['choices', compact ? 'choices-row' : 'choices-col'] }, buttons)),
    key: (ev) => { const i = Number(ev.key) - 1; if (!(i >= 0 && i < buttons.length)) return false; pick(i); return true; },
  };
}

const VIEWS = {
  intro: introView, name: nameView, find: findView, pickStaff: pickStaffView, fretToStaff: fretToStaffView, fretToName: fretToNameView,
  pairs: pairsView, phrase: phraseView, hearPhrase: hearPhraseView, rhythmTap: rhythmTapView, rhythmHear: rhythmHearView, mcq: mcqView,
};

export function createExercise(ex, ctx) {
  const make = VIEWS[ex.type];
  if (!make) throw new Error(`no view for exercise type "${ex.type}"`);
  return make(ex, ctx);
}
