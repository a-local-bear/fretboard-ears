// One view per exercise type.  A view is {el, start?, stop?, key?}; it reports
// its outcome exactly once through ctx.done({correct, answer, tip, notes, auto, ...}):
//   answer = the right answer (shown after a mistake), tip = a remark shown instead,
//   notes = [{key, correct}] for the per-note memory, auto = may move on without a tap (with the microphone every result does).
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
import { parseMelody, onsets, timeline, OPEN, describePos, noteFromKey, pitchName, spell, measureBeats, WRITTEN_SHIFT } from './theory.js';
import { audio } from './audio.js';
import { mic } from './mic.js';
import { prefs } from './prefs.js';
import { button, noteLabel, mascot } from './ui.js';
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
const CARD_DELAY = 700; // ms before a new teaching card listens for a note

function introView(ex, ctx) {
  let index = ex.at ?? 0; // kept on the exercise so a switch to taps in the middle does not start the cards over
  const stage = h('div', { class: 'intro-stage' });
  const dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, ex.cards.map(() => h('i')));

  function visuals(card) {
    const out = [];
    if (card.note) {
      const staff = flashcard(card.note.pitch, ctx, {}, { sp: 11 });
      const fb = board(ctx, card.frets, null);
      fb.mark(card.note.s, card.note.f, 'show', card.note.name);
      const hear = () => {
        audio.pluck(card.note.sounding);
        if (panel) deafen(); // the microphone would hear the speakers and take the sound for the player's note
      };
      out.push(h('div', { class: 'card staff-card' }, staff.el), h('div', { class: 'fb-wrap' }, fb.el),
        button('Hear it', { kind: 'soft', icon: 'speaker-high', cls: 'btn-small hear', onclick: hear }));
      if (!panel && audio.context && audio.context.state === 'running') hear(); // with a microphone the player starts the sound
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
    if (panel) listenFor(card);
  }
  function next() {
    if (index < ex.cards.length - 1) { index++; ex.at = index; render(); } else { ctx.setFooter(null); ctx.done({ skip: true }); }
  }

  // With the microphone a card moves on when its note (or, on other cards, any note) is played.  A note that
  // is still ringing from the last card, or one that arrives right after a card appears, does not count, so
  // a single pluck cannot skip several cards.
  function listenFor(card) {
    clearTimeout(armTimer);
    clearTimeout(ringTimer);
    armed = false;
    ringing = mic.current ? mic.current.midi : null;
    armTimer = setTimeout(() => { armed = true; }, CARD_DELAY);
    ringTimer = setTimeout(() => { ringing = null; }, CARD_DELAY * 2);
    panel.say(card.note ? 'Play it to continue — it is marked on the diagram.' : 'Play any note to continue.');
  }
  function deafen() {
    armed = false;
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armed = true; }, 1800);
  }
  function played(n) {
    if (!armed || (ringing !== null && n.midi === ringing)) return;
    const card = ex.cards[index];
    if (card.note && n.midi !== card.note.sounding) {
      panel.say(`I heard ${pitchName(spell(n.midi))}. This card is about ${card.note.name} — play it to continue.`);
      return;
    }
    next();
  }
  const panel = ctx.input === 'mic' ? listenPanel(ctx, '') : null;
  let armed = false, ringing = null, armTimer = 0, ringTimer = 0, ringPoll = 0, off = null;
  if (panel) {
    off = mic.onNote(played);
    ringPoll = setInterval(() => { if (!mic.current) ringing = null; }, 100);
  }
  const el = h('div', { class: 'ex ex-intro' }, stage, ex.cards.length > 1 ? dots : null, panel ? panel.el : null);
  return {
    el, start: render,
    key: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { next(); return true; } return false; },
    stop() { if (off) off(); if (panel) panel.stop(); clearInterval(ringPoll); clearTimeout(armTimer); clearTimeout(ringTimer); },
  };
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
  const where = h('div', { class: 'fb-wrap' });
  let over = false, strikes = 0, hinted = false;
  const finish = (correct) => {
    if (over) return;
    over = true;
    staff.setState(0, correct ? 'good' : 'bad');
    ctx.done({ correct, auto: true, answer: answerLine(ex.note), notes: [{ key: ex.note.key, correct }], mic: true });
  };
  // after two wrong notes: show where it is and keep listening until it is played (it then counts as missed)
  const hint = () => {
    hinted = true;
    const fb = board(ctx, ex.frets, null);
    fb.mark(ex.note.s, ex.note.f, 'show', ex.note.name);
    mount(where, fb.el);
    panel.say(`It is on the ${describePos(ex.note)}. Play it to carry on.`);
  };
  const off = mic.onNote((n) => {
    if (over) return;
    if (n.midi === ex.note.sounding) finish(!hinted);
    else if ((n.midi - ex.note.sounding) % 12 === 0) panel.say(`That was ${pitchName(spell(n.midi))} in a different octave — look where the note sits on the staff.`);
    else if (hinted) panel.say(`I heard ${pitchName(spell(n.midi))}. The note is on the ${describePos(ex.note)}.`);
    else if (++strikes >= 2) hint();
    else panel.say(`I heard ${pitchName(spell(n.midi))}. Have one more go.`);
  });
  staff.setState(0, 'active');
  return {
    el: h('div', { class: 'ex ex-find' }, prompt('Play this note on your guitar'), h('div', { class: 'card staff-card' }, staff.el), panel.el, where),
    stop() { off(); panel.stop(); },
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

// ---------------------------------------------------------------------------
// Rhythm
// ---------------------------------------------------------------------------
/** compare taps with the expected onsets; times are seconds from beat 0 */
export function judgeTaps(expected, taps, { storedOffset = 0, leeway = 1 } = {}) {
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
  const fine = match(shift, Math.min(0.15 * leeway, minGap * 0.42 * leeway, minGap * 0.48));
  const hit = new Set(fine.pairs.map((p) => p[0]));
  const misses = expected.length - hit.size;
  const slack = expected.length >= 8 ? 1 : 0;
  return { hit, misses, extras: fine.extras, shift, matched: rough.pairs.length, correct: misses + Math.max(0, fine.extras - 1) <= slack };
}

function rhythmTapView(ex, ctx) {
  if (ctx.input === 'mic') return rhythmMicView(ex, ctx);
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

// How long after a string is plucked the microphone path reports it: the sound reaches the page about this much
// later than it was made (phone/browser input buffers are typically 10-40 ms).  Onsets are already timed from
// the start of the sound (see mic.onOnset), so only this fixed input delay is taken off.
export const MIC_LATENCY = 0.03;
// the microphone path is a little less exact than a finger on glass, so it gets a wider window than taps
export const MIC_LEEWAY = 1.3;
export const MIC_TRIES = 3;

/** the guitar version of the rhythm exercise: hear it, count in, play it, and again by itself if it was off */
function rhythmMicView(ex, ctx) {
  const measures = parseMelody(ex.melody);
  const hits = onsets(measures);
  const covers = eventMap(measures);
  const total = totalBeats(measures);
  const perBar = measureBeats(ex.timeSig);
  const spb = 60 / ex.bpm;
  const staff = renderStaff({ measures, timeSig: ex.timeSig, width: ctx.staffWidth, sp: 10, counts: ex.counts });
  const panel = listenPanel(ctx, 'Pluck each note as it comes. Any string will do; the open 3rd string (G) is the note on the staff.');
  const status = h('div', { class: 'count-in', 'aria-live': 'polite' }, `♩ = ${ex.bpm}`);
  let phase = 'demo'; // demo | count | run | review | over
  let tStart = 0, plucks = [], raf = 0, demo = null, tries = 0, timer = 0;
  const later = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

  // the demonstration comes out of the speakers, so nothing is listened to until it is over
  const off = mic.onOnset((o) => {
    if (phase !== 'count' && phase !== 'run') return;
    const rel = o.t - tStart - MIC_LATENCY;
    if (rel < -Math.min(0.3, spb * 0.45)) return; // the count-in clicks, or a pluck far too early to mean anything
    plucks.push(rel);
    panel.say(`${plural(plucks.length, 'pluck')} heard`);
  });

  function paintAll(state) { hits.forEach((o, i) => { for (const idx of covers[i]) staff.setState(idx, typeof state === 'function' ? state(i) : state); }); }

  function demonstrate() {
    phase = 'demo';
    status.textContent = 'Listen first…';
    paintAll('');
    demo = playMelody(measures, ex.bpm, staff, { clicks: true, timeSig: ex.timeSig, countIn: true });
    demo.done.then((played) => { if (played && phase === 'demo') later(countIn, 700); }); // let the sound die away
  }
  function countIn() {
    if (phase === 'over') return;
    const ac = audio.unlock();
    const latency = ac ? ac.outputLatency || ac.baseLatency || 0 : 0;
    const toAudio = ac ? ac.currentTime - perfNow() : 0;
    tStart = perfNow() + 0.35 + perBar * spb + latency; // the moment beat 0 is heard
    // clicks for the count-in only: during the rhythm the speakers stay quiet so the microphone hears just the guitar
    for (let b = -perBar; b < 0; b++) audio.click(tStart - latency + b * spb + toAudio, ((b % perBar) + perBar) % perBar === 0);
    plucks = [];
    tries++;
    phase = 'count';
    paintAll('');
    panel.say('Listening. Pluck each note as it comes.');
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
    } else if (beat >= total + 0.45 / spb) { judge(); return; }
    raf = requestAnimationFrame(frame);
  }
  function judge() {
    phase = 'review';
    staff.playhead(null);
    const result = judgeTaps(hits.map((o) => o.t * spb), plucks, { leeway: MIC_LEEWAY });
    paintAll((i) => (result.hit.has(i) ? 'good' : 'bad'));
    if (result.correct) return finish(true, null);
    const parts = [];
    if (!plucks.length) parts.push('I did not hear any plucks');
    else {
      if (result.misses) parts.push(`${plural(result.misses, 'note')} missed or off the beat (red)`);
      if (result.extras > 1) parts.push(`${result.extras} extra plucks`);
    }
    const why = `${cap(parts.join(' and ') || 'the timing drifted')}.`;
    status.textContent = 'Not quite';
    if (tries >= MIC_TRIES) return finish(false, `${why} Count out loud and pluck only where a note begins.`);
    panel.say(`${why} Let's count in again (try ${tries + 1} of ${MIC_TRIES}).`);
    later(() => (tries === MIC_TRIES - 1 ? demonstrate() : countIn()), 2600);
  }
  function finish(correct, tip) {
    phase = 'over';
    status.textContent = correct ? 'Right on the beat!' : 'Not quite';
    ctx.done({ correct, auto: false, notes: [], praise: 'Right on the beat!', tip, mic: true, tries });
  }

  demonstrate();
  return {
    el: h('div', { class: 'ex ex-rhythm' }, prompt('Play this rhythm on your guitar'), h('div', { class: 'card staff-card staff-scroll' }, staff.el), status, panel.el),
    stop() {
      phase = 'over';
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      off();
      panel.stop();
      if (demo) demo.stop();
      audio.stopAll();
    },
  };
}

// "name" is only used by the Practice sprint; lessons ask for playing: find, phrase, rhythmTap
const VIEWS = { intro: introView, name: nameView, find: findView, phrase: phraseView, rhythmTap: rhythmTapView };

export function createExercise(ex, ctx) {
  const make = VIEWS[ex.type];
  if (!make) throw new Error(`no view for exercise type "${ex.type}"`);
  return make(ex, ctx);
}
