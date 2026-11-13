import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, LESSONS, lessonById, learnedNotes } from '../public/js/curriculum.js';
import { SONGS } from '../public/js/songs.js';
import { generateLesson, generatePlacement, generateReview, sprintQuestion, knownNotes, rhythmBars, nameChoices } from '../public/js/generate.js';
import { parseMelody, measureBeats, onsets, locate, noteFromKey, parsePitch, WRITTEN_SHIFT } from '../public/js/theory.js';
import { newState, completeLesson, recordNote } from '../public/js/progress.js';
import { makeRng } from '../public/js/util.js';

const sum = (bar) => bar.reduce((a, e) => a + e.dur.beats, 0);

test('the course has a sensible shape', () => {
  assert.equal(UNITS.length, 10);
  assert.ok(LESSONS.length >= 55);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length, 'lesson ids are unique');
  LESSONS.forEach((l, i) => assert.equal(l.index, i));
  for (const l of LESSONS) {
    assert.ok(l.title && l.blurb && l.icon && l.xp > 0, `${l.id} metadata`);
    assert.ok(l.pool.length >= 2, `${l.id} has notes to work with`);
    for (const n of l.pool) assert.ok(n.f >= l.frets[0] && n.f <= l.frets[1], `${l.id}: ${n.key} outside frets ${l.frets}`);
    if (l.kind === 'notes') assert.ok(l.learn.length > 0, `${l.id} teaches something`);
    if (l.kind === 'rhythm') assert.ok(l.rhythm && l.mcq && l.intro.length, `${l.id} rhythm data`);
  }
  // every string of the open position is covered by the end of unit 6
  const u6 = lessonById('u6-7');
  assert.deepEqual(u6.pool.map((n) => n.pitch.id).sort(), ['A3', 'A4', 'B3', 'B4', 'C4', 'C5', 'D4', 'D5', 'E3', 'E4', 'E5', 'F3', 'F4', 'F5', 'G3', 'G4', 'G5']);
  assert.equal(lessonById('nope'), null);
});

test('every song is well formed and playable where the course says', () => {
  for (const song of Object.values(SONGS)) {
    const bars = parseMelody(song.melody);
    const want = measureBeats(song.timeSig);
    bars.forEach((bar, i) => assert.equal(sum(bar), want, `${song.id} bar ${i + 1} has ${sum(bar)} beats`));
    for (const o of onsets(bars)) {
      const n = locate(o.pitch, { frets: song.frets, string: song.string });
      assert.ok(n, `${song.id}: ${o.pitch.id} is not reachable in frets ${song.frets}`);
    }
    assert.ok(song.title && song.credit && song.bpm >= 50 && song.bpm <= 140);
    assert.ok(LESSONS.some((l) => l.song === song), `${song.id} is used in a lesson`);
  }
  // songs only use notes the course has taught by then (same pitches)
  for (const l of LESSONS.filter((x) => x.kind === 'song')) {
    const known = new Set(l.pool.map((n) => n.sounding));
    const extra = [...new Set(onsets(parseMelody(l.song.melody)).map((o) => o.pitch.midi - WRITTEN_SHIFT).filter((m) => !known.has(m)))];
    // a couple of songs introduce D sharp on the spot (it is E flat, already taught, under another name)
    assert.deepEqual(extra, [], `${l.id} ${l.song.id} uses untaught pitches ${extra}`);
  }
});

function checkExercise(ex, lesson, label) {
  const inWindow = (key, frets) => { const n = noteFromKey(key); return n.f >= frets[0] && n.f <= frets[1]; };
  const fail = (msg) => assert.fail(`${label}: ${msg} — ${JSON.stringify(ex).slice(0, 300)}`);
  switch (ex.type) {
    case 'intro':
      assert.ok(ex.cards.length > 0);
      for (const c of ex.cards) {
        if (!c.title || !c.text) fail('card without title/text');
        if (c.staff) parseMelody(c.staff.melody);
        if (c.fretboard) for (const m of c.fretboard.marks) if (!(m.f >= c.fretboard.frets[0] && m.f <= c.fretboard.frets[1])) fail(`card mark ${m.s}:${m.f} outside the diagram`);
      }
      break;
    case 'name': case 'fretToName':
      if (!ex.choices.includes(ex.answer)) fail('answer not among choices');
      if (new Set(ex.choices).size !== ex.choices.length) fail('duplicate choices');
      if (ex.choices.length < 3 || ex.choices.length > 7) fail(`odd number of choices (${ex.choices.length})`);
      if (ex.answer !== ex.note.nameId) fail('answer mismatch');
      if (ex.type === 'fretToName' && !inWindow(ex.note.key, ex.frets)) fail('note outside window');
      break;
    case 'find':
      if (!inWindow(ex.note.key, ex.frets)) fail('note outside window');
      break;
    case 'pickStaff': case 'fretToStaff': {
      if (ex.options.length !== 3) fail('needs three options');
      if (new Set(ex.options.map((o) => o.pitch)).size !== 3) fail('duplicate options');
      const target = ex.type === 'pickStaff' ? ex.target : ex.note;
      if (ex.options[ex.answer]?.pitch !== target.pitch) fail('answer index wrong');
      if (ex.type === 'pickStaff' && ex.options.filter((o) => o.nameId === target.nameId).length !== 1) fail('two options share the target name');
      for (const o of ex.options) parsePitch(o.pitch);
      break;
    }
    case 'pairs': {
      if (ex.notes.length < 3 || ex.notes.length > 4) fail('pairs size');
      const ids = ex.notes.map((n) => (ex.mode === 'name' ? n.nameId : n.key));
      if (new Set(ids).size !== ids.length) fail('ambiguous pairs');
      if (new Set(ex.notes.map((n) => n.pitch)).size !== ex.notes.length) fail('two cards look identical');
      break;
    }
    case 'phrase': {
      const bars = parseMelody(ex.melody);
      if (ex.timeSig) bars.forEach((bar, i) => { if (Math.abs(sum(bar) - measureBeats(ex.timeSig)) > 1e-9) fail(`bar ${i + 1} has ${sum(bar)} beats`); });
      const hits = onsets(bars);
      if (hits.length < 2) fail('too short');
      if (hits.length !== ex.where.length) fail(`where has ${ex.where.length} entries for ${hits.length} notes`);
      hits.forEach((o, i) => {
        const n = noteFromKey(ex.where[i]);
        if (n.sounding !== o.pitch.midi - WRITTEN_SHIFT) fail(`note ${i} position ${ex.where[i]} does not sound ${o.pitch.id}`);
        if (!inWindow(ex.where[i], ex.frets)) fail(`note ${i} outside the diagram`);
      });
      break;
    }
    case 'hearPhrase':
      if (ex.options.length !== 3 || new Set(ex.options).size !== 3) fail('needs three different options');
      if (!(ex.answer >= 0 && ex.answer < 3)) fail('answer index');
      ex.options.forEach((m) => parseMelody(m));
      break;
    case 'rhythmTap': {
      const bars = parseMelody(ex.melody);
      bars.forEach((bar, i) => { if (Math.abs(sum(bar) - measureBeats(ex.timeSig)) > 1e-9) fail(`bar ${i + 1} has ${sum(bar)} beats`); });
      if (onsets(bars).length < 2) fail('nothing to tap');
      if (!(ex.bpm >= 40 && ex.bpm <= 140)) fail('tempo');
      break;
    }
    case 'rhythmHear': {
      if (ex.options.length !== 3) fail('needs three options');
      const sigs = ex.options.map((m) => onsets(parseMelody(m)).map((o) => o.t).join(','));
      if (new Set(sigs).size !== 3) fail('two options sound the same');
      if (!(ex.answer >= 0 && ex.answer < 3)) fail('answer index');
      break;
    }
    case 'mcq': {
      if (!ex.prompt) fail('no prompt');
      if (ex.choices.length < 2 || ex.choices.length > 4) fail('choice count');
      if (!(ex.answer >= 0 && ex.answer < ex.choices.length)) fail('answer index');
      const keys = ex.choices.map((c) => c.label ?? c.symbol ?? c.note);
      if (keys.some((k) => !k) || new Set(keys).size !== keys.length) fail('choices must be distinct and non-empty');
      if (ex.visual?.staff) {
        const bars = parseMelody(ex.visual.staff.melody);
        if (ex.visual.staff.mark != null && !bars.flat()[ex.visual.staff.mark]) fail('mark out of range');
      }
      break;
    }
    default: fail(`unknown exercise type ${ex.type}`);
  }
}

test('every lesson generates valid exercises, for many random seeds', () => {
  const types = new Set();
  for (const lesson of LESSONS) {
    for (let seed = 1; seed <= 40; seed++) {
      const list = generateLesson(lesson, { rng: makeRng(seed * 7919 + lesson.index) });
      const scored = list.filter((e) => e.type !== 'intro');
      assert.ok(scored.length >= 4 && scored.length <= 20, `${lesson.id}: ${scored.length} exercises`);
      assert.ok(list.findIndex((e) => e.type === 'intro') <= 0, 'intro comes first');
      list.forEach((ex, i) => { checkExercise(ex, lesson, `${lesson.id} seed ${seed} #${i} (${ex.type})`); types.add(ex.type); });
      if (lesson.kind === 'notes') {
        // each new note is asked about directly at least once
        for (const n of lesson.learn) assert.ok(scored.some((e) => (e.note?.key ?? e.target?.key) === n.key), `${lesson.id}: ${n.key} never drilled`);
      }
    }
  }
  for (const t of ['intro', 'name', 'find', 'pickStaff', 'fretToStaff', 'fretToName', 'pairs', 'phrase', 'hearPhrase', 'rhythmTap', 'rhythmHear', 'mcq']) assert.ok(types.has(t), `type ${t} is used`);
});

test('generation is deterministic for a seed and adapts to weak notes', () => {
  const lesson = lessonById('u2-5');
  const a = generateLesson(lesson, { rng: makeRng(5) }), b = generateLesson(lesson, { rng: makeRng(5) });
  assert.deepEqual(a, b);
  // a player who keeps missing D sees D more often than one who knows it
  const count = (state) => {
    let n = 0;
    for (let seed = 0; seed < 60; seed++) for (const e of generateLesson(lesson, { rng: makeRng(seed), state, now: 1e12 })) if (e.note?.key === 's2f3') n++;
    return n;
  };
  const weak = newState('w'), strong = newState('s');
  for (const n of lesson.pool) for (let i = 0; i < 6; i++) { recordNote(weak, n.key, n.key !== 's2f3', 1500, 1e12); recordNote(strong, n.key, true, 1500, 1e12); }
  assert.ok(count(weak) > count(strong) * 1.25, `weak ${count(weak)} vs strong ${count(strong)}`);
});

test('placement tests, review rounds and sprints draw on the right notes', () => {
  for (const unit of UNITS.slice(1)) {
    const list = generatePlacement(unit, { rng: makeRng(unit.index) });
    assert.equal(list.length, 16);
    list.forEach((ex, i) => checkExercise(ex, null, `placement ${unit.id} #${i}`));
  }
  const state = newState('r');
  assert.equal(generateReview(state), null, 'nothing to review before the first lesson');
  for (const id of ['u1-1', 'u1-2', 'u2-1', 'u2-2']) completeLesson(state, lessonById(id), { mistakes: 0, total: 10, seconds: 60 }, 1e12);
  recordNote(state, 's2f1', false, 0, 1e12);
  const review = generateReview(state, { rng: makeRng(3), now: 1e12 });
  assert.equal(review.length, 12);
  review.forEach((ex, i) => checkExercise(ex, null, `review #${i}`));
  const allowed = new Set(['s1f0', 's1f1', 's1f3', 's2f0', 's2f1', 's2f3']);
  for (const ex of review) if (ex.note) assert.ok(allowed.has(ex.note.key), `review asked about unlearned ${ex.note.key}`);
  const notes = knownNotes(state);
  assert.equal(notes.length, 6);
  const rng = makeRng(9);
  let last = null;
  for (let i = 0; i < 50; i++) {
    const q = sprintQuestion(rng, notes, i % 2 ? 'name' : 'find', last);
    checkExercise(q, null, `sprint #${i}`);
    assert.notEqual(q.note.key, last, 'no immediate repeats');
    last = q.note.key;
  }
  assert.deepEqual(learnedNotes(new Set()).length, 0);
});

test('rhythm generator honours the time signature and the required figures', () => {
  const rng = makeRng(11);
  for (const lesson of LESSONS.filter((l) => l.rhythm && l.rhythm.cells)) {
    for (let i = 0; i < 100; i++) {
      const bars = rhythmBars(rng, lesson.rhythm, 2);
      assert.equal(bars.length, 2);
      const text = bars.map((b) => b.map((c) => (c[0] === 'r' ? `r:${c.slice(1)}` : `G4:${c}`)).join(' ')).join(' | ');
      for (const bar of parseMelody(text)) assert.equal(sum(bar), measureBeats(lesson.rhythm.timeSig), `${lesson.id}: ${text}`);
    }
  }
});

test('note-name buttons are sensible', () => {
  const rng = makeRng(2);
  const l1 = lessonById('u1-1');
  for (const n of l1.pool) { const c = nameChoices(rng, n, l1.pool); assert.ok(c.includes(n.nameId) && c.length >= 3 && c.length <= 4, c.join()); }
  assert.deepEqual(nameChoices(rng, lessonById('u4-5').pool[0], lessonById('u4-5').pool), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  const l7 = lessonById('u7-3');
  for (const n of l7.pool) {
    const c = nameChoices(rng, n, l7.pool);
    assert.ok(c.includes(n.nameId), `${n.nameId} in ${c}`);
    assert.ok(!c.some((x) => ['E#', 'B#', 'Fb', 'Cb'].includes(x)), `no confusing enharmonics in ${c}`);
    if (n.nameId.length > 1) assert.ok(c.includes(n.nameId[0]), `${n.nameId}: the plain letter is offered too (${c})`);
  }
});
