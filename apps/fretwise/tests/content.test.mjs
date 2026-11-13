import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, LESSONS, lessonById, learnedNotes } from '../public/js/curriculum.js';
import { SONGS } from '../public/js/songs.js';
import { generateLesson, generatePlacement, generateReview, sprintQuestion, knownNotes, rhythmBars, nameChoices } from '../public/js/generate.js';
import { parseMelody, measureBeats, onsets, locate, noteFromKey, markAccidentals, keyAlterations, WRITTEN_SHIFT } from '../public/js/theory.js';
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
    if (l.kind === 'rhythm') assert.ok(l.rhythm && l.intro.length && !('mcq' in l), `${l.id} rhythm data`);
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
    case 'name': // only the Practice sprint asks this
      if (!ex.choices.includes(ex.answer)) fail('answer not among choices');
      if (new Set(ex.choices).size !== ex.choices.length) fail('duplicate choices');
      if (ex.choices.length < 3 || ex.choices.length > 7) fail(`odd number of choices (${ex.choices.length})`);
      if (ex.answer !== ex.note.nameId) fail('answer mismatch');
      break;
    case 'find':
      if (!inWindow(ex.note.key, ex.frets)) fail('note outside window');
      break;
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
    case 'rhythmTap': {
      const bars = parseMelody(ex.melody);
      bars.forEach((bar, i) => { if (Math.abs(sum(bar) - measureBeats(ex.timeSig)) > 1e-9) fail(`bar ${i + 1} has ${sum(bar)} beats`); });
      if (onsets(bars).length < 2) fail('nothing to tap');
      if (!(ex.bpm >= 40 && ex.bpm <= 140)) fail('tempo');
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
        for (const n of lesson.learn) assert.ok(scored.some((e) => e.type === 'find' && e.note.key === n.key), `${lesson.id}: ${n.key} never played alone`);
        assert.ok(scored.slice(-2).every((e) => e.type === 'phrase'), `${lesson.id}: ends on phrases`);
        const lens = scored.filter((e) => e.type === 'phrase').map((e) => e.where.length);
        assert.deepEqual(lens, lens.slice().sort((a, b) => a - b), `${lesson.id}: phrases grow (${lens})`);
        assert.ok(lens.at(-1) >= 5, `${lesson.id}: longest phrase has ${lens.at(-1)} notes`);
      }
    }
  }
  assert.deepEqual([...types].sort(), ['find', 'intro', 'phrase', 'rhythmTap'], 'lessons are made of playing only');
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
  const weak = newState(), strong = newState();
  for (const n of lesson.pool) for (let i = 0; i < 6; i++) { recordNote(weak, n.key, n.key !== 's2f3', 1500, 1e12); recordNote(strong, n.key, true, 1500, 1e12); }
  assert.ok(count(weak) > count(strong) * 1.25, `weak ${count(weak)} vs strong ${count(strong)}`);
});

test('placement tests, review rounds and sprints draw on the right notes', () => {
  for (const unit of UNITS.slice(1)) {
    const list = generatePlacement(unit, { rng: makeRng(unit.index) });
    assert.equal(list.length, 10);
    assert.deepEqual([...new Set(list.map((e) => e.type))].sort(), ['find', 'phrase']);
    list.forEach((ex, i) => checkExercise(ex, null, `placement ${unit.id} #${i}`));
  }
  const state = newState();
  assert.equal(generateReview(state), null, 'nothing to review before the first lesson');
  for (const id of ['u1-1', 'u1-2', 'u2-1', 'u2-2']) completeLesson(state, lessonById(id), { mistakes: 0, total: 10, seconds: 60 }, 1e12);
  recordNote(state, 's2f1', false, 0, 1e12);
  const review = generateReview(state, { rng: makeRng(3), now: 1e12 });
  assert.equal(review.length, 10);
  assert.deepEqual([...new Set(review.map((e) => e.type))].sort(), ['find', 'phrase']);
  review.forEach((ex, i) => checkExercise(ex, null, `review #${i}`));
  const allowed = new Set(['s1f0', 's1f1', 's1f3', 's2f0', 's2f1', 's2f3']);
  for (const ex of review) {
    if (ex.note) assert.ok(allowed.has(ex.note.key), `review asked about unlearned ${ex.note.key}`);
    if (ex.where) for (const k of ex.where) assert.ok(allowed.has(k), `review phrase uses unlearned ${k}`);
  }
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

const PLAYING = new Set(['intro', 'find', 'phrase', 'rhythmTap']);

test('every lesson, the review round and every placement test are made of playing only', () => {
  const lists = [];
  for (const lesson of LESSONS) for (let seed = 1; seed <= 8; seed++) lists.push([lesson.id, generateLesson(lesson, { rng: makeRng(seed) })]);
  for (const unit of UNITS.slice(1)) lists.push([`placement ${unit.id}`, generatePlacement(unit, { rng: makeRng(3) })]);
  const state = newState();
  for (const id of ['u1-1', 'u1-2', 'u2-1', 'u2-2']) completeLesson(state, lessonById(id), { mistakes: 0, total: 10, seconds: 60 }, 1e12);
  lists.push(['review', generateReview(state, { rng: makeRng(4), now: 1e12 })]);
  for (const [label, list] of lists) for (const ex of list) assert.ok(PLAYING.has(ex.type), `${label}: ${ex.type} is not something to play`);
  // the old quiz data is gone from the course
  for (const l of LESSONS) assert.ok(!('mcq' in l) && !('basics' in l), `${l.id} still carries quiz data`);
});

test('lesson length: a handful of exercises, phrases and rhythms included', () => {
  for (const lesson of LESSONS) {
    const n = generateLesson(lesson, { rng: makeRng(2) }).filter((e) => e.type !== 'intro').length;
    assert.ok(n >= (lesson.kind === 'song' ? 4 : 6) && n <= (lesson.kind === 'song' ? 20 : 14), `${lesson.id} (${lesson.kind}) has ${n} exercises`);
  }
});

test('each kind of lesson has its recipe', () => {
  const shape = (id) => generateLesson(lessonById(id), { rng: makeRng(6) }).filter((e) => e.type !== 'intro');
  const rhythm = shape('u1-3');
  assert.ok(rhythm.every((e) => e.type === 'rhythmTap') && rhythm.length >= 5);
  const bars = rhythm.map((e) => parseMelody(e.melody).length);
  assert.deepEqual(bars, bars.slice().sort((a, b) => a - b), 'rhythms grow');
  const tunes = shape('u1-4');
  assert.ok(tunes.every((e) => e.type === 'phrase' && e.timeSig));
  const sizes = tunes.map((e) => parseMelody(e.melody).length);
  assert.deepEqual(sizes, sizes.slice().sort((a, b) => a - b), 'tunes grow');
  const mix = shape('u2-5');
  assert.ok(mix.some((e) => e.type === 'phrase' && e.timeSig), 'a mix lesson with a melody spec has tunes with rhythm');
  assert.ok(mix.some((e) => e.type === 'find') && mix.some((e) => e.type === 'phrase' && !e.timeSig));
  const keysig = shape('u8-1');
  const changed = new Set(lessonById('u8-1').pool.filter((n) => n.pitch.alter !== 0).map((n) => n.sounding));
  assert.ok(keysig.filter((e) => e.type === 'find' && changed.has(e.note.sounding)).length >= 3, 'single notes lean on the notes the key changes');
  assert.ok(keysig.every((e) => e.keySig === 1));
  const song = generateLesson(lessonById('u2-3'), { rng: makeRng(1) }).filter((e) => e.type !== 'intro');
  assert.ok(song.every((e) => e.type === 'phrase' && e.song === 'mary-lamb') && song.at(-1).final);
});

/** what a printed melody means: the sign on a note, else what the bar line / key signature leaves in force */
function meaning(melody, keySig = 0) {
  const bars = markAccidentals(parseMelody(melody), keySig);
  const key = keyAlterations(keySig);
  const out = [];
  for (const bar of bars) {
    const inBar = {};
    for (const ev of bar) {
      if (!ev.pitch) continue;
      const slot = ev.pitch.letter + ev.pitch.octave;
      const shown = { '#': 1, b: -1, n: 0 }[ev.acc];
      const alter = shown !== undefined ? shown : slot in inBar ? inBar[slot] : key[ev.pitch.letter] || 0;
      inBar[slot] = alter;
      out.push(alter);
    }
  }
  return out;
}

test('accidentals phrases: what the player must play is what the notation means', () => {
  const lesson = lessonById('u7-4');
  const variants = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const list = generateLesson(lesson, { rng: makeRng(seed) }).filter((e) => e.type !== 'intro');
    const written = list.filter((e) => e.type === 'phrase' && e.timeSig);
    assert.ok(written.length >= 5, 'bar-line phrases');
    for (const ex of written) {
      const bars = markAccidentals(parseMelody(ex.melody), ex.keySig ?? 0, { explicit: false });
      const alters = meaning(ex.melody, ex.keySig ?? 0);
      const hits = onsets(bars);
      assert.equal(ex.where.length, hits.length);
      hits.forEach((o, i) => {
        const n = noteFromKey(ex.where[i]);
        assert.equal(n.sounding, o.pitch.midi - WRITTEN_SHIFT, `note ${i} of ${ex.melody}`);
        // the letter and octave are the staff position; the player must apply what the signs mean
        const plainMidi = o.pitch.midi - o.pitch.alter;
        assert.equal(n.sounding + WRITTEN_SHIFT, plainMidi + alters[i], `${ex.melody}: note ${i} should sound ${alters[i] > 0 ? 'sharp' : alters[i] < 0 ? 'flat' : 'plain'}`);
      });
      // which rule does it exercise?
      const signs = bars.map((bar) => bar.filter((e) => e.pitch).map((e) => e.acc));
      if (bars.length === 2) variants.add('next');
      else if (signs[0].includes('n')) variants.add('natural');
      else if (hits.length === 4 && hits[0].pitch.midi === hits[2].pitch.midi) { variants.add('same'); assert.equal(signs[0][2], null, 'the repeat carries no sign of its own'); assert.notEqual(signs[0][0], null); }
      if (bars.length === 2) { assert.equal(signs[1][0], null, 'plain note after the bar line has no sign'); assert.notEqual(hits[0].pitch.alter, hits[3].pitch.alter, 'the note comes back plain'); }
    }
    // some single altered notes too
    assert.ok(list.some((e) => e.type === 'find' && e.note.nameId.length > 1));
  }
  assert.deepEqual([...variants].sort(), ['natural', 'next', 'same']);
});
