import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POSITIONS, LEVELS, FAMILIES, CHORDS, CADENCE, OPEN, MAX_FRET, MIN_MIDI, MAX_MIDI, SCALES,
  levelById, positionById, buildContext, newestOf, pickKey, placePosition, cadenceFor, midiOf,
  degreeName, degreeWord, letterName, keyName, noteColor, degreeIndex, DEGREE_NAMES, SEMI_COLORS,
} from '../public/js/data.js';
import { mulberry32 } from '../public/js/deck.js';

const KEYS = [...Array(12).keys()];
const BOXES = POSITIONS.filter((p) => p.shape === 'box');
const midiAt = ([s, f]) => OPEN[s] + f;
const pool = (id, keyPc = 0, pos = 'A') => {
  const l = levelById(id);
  return buildContext(pos, l, keyPc, l.mode ?? 'major').pool;
};

test('one ladder: unique ids, in stage order, indexed', () => {
  const ids = LEVELS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(LEVELS.length, 31);
  LEVELS.forEach((l, i) => assert.equal(l.idx, i));
  // The stages follow each other without mixing.
  const order = Object.keys(FAMILIES);
  assert.deepEqual([...new Set(LEVELS.map((l) => l.family))], order);
  assert.deepEqual(order, ['major', 'majorChrom', 'minor', 'minorChrom', 'all']);
  for (const l of LEVELS) assert.equal(l.title, `${FAMILIES[l.family].name} · ${l.name}`);
});

test('the major build-up is triad first, in a fixed key: 1·5, 1·3·5, 1·2·3·5, then 4, 6, 7 and the octave', () => {
  const pools = [[0, 7], [0, 4, 7], [0, 2, 4, 7], [0, 2, 4, 5, 7], [0, 2, 4, 5, 7, 9], [0, 2, 4, 5, 7, 9, 11], [0, 2, 4, 5, 7, 9, 11, 12]];
  const newest = [7, 4, 2, 5, 9, 11, 12];
  const ids = ['major-t0', 'major-t1', 'major-t2', 'major-3', 'major-4', 'major-5', 'major-6'];
  assert.deepEqual(LEVELS.slice(0, 7).map((l) => l.id), ids);
  assert.deepEqual(LEVELS.slice(0, 7).map((l) => l.name), ['1 · 5', '1 · 3 · 5', '1 · 2 · 3 · 5', '1 – 5', '1 – 6', '1 – 7', 'Whole octave']);
  ids.forEach((id, i) => {
    const l = levelById(id);
    assert.equal(l.random, null, `${id} stays in the chosen key`);
    assert.equal(l.newest, newest[i]);
    assert.equal(newestOf(l, pools[i]), newest[i]);
    for (const p of POSITIONS) {
      for (const keyPc of KEYS) {
        const ctx = buildContext(p.id, l, keyPc, 'major');
        assert.deepEqual(ctx.pool, pools[i], `${id} at ${p.id} in ${keyPc}`);
        for (const o of pools[i]) assert.ok(ctx.positions.get(o).length >= 1);
      }
    }
  });
});

test('after the fixed-key octave every level draws its key, and the last one its mode too', () => {
  const rest = LEVELS.slice(7);
  for (const l of rest) assert.ok(l.random, `${l.id} draws a key`);
  assert.equal(levelById('major-rk').random, 'major');
  assert.equal(levelById('minor-oct').random, 'minor');
  assert.equal(levelById('all-neck').random, 'any');
  const rng = mulberry32(5);
  const drawn = Array.from({ length: 40 }, () => pickKey(levelById('all-neck'), 0, rng));
  assert.ok(drawn.some((k) => k.mode === 'major') && drawn.some((k) => k.mode === 'minor'));
  assert.ok(new Set(drawn.map((k) => k.keyPc)).size > 6);
  assert.deepEqual(pickKey(levelById('major-3'), 7, rng), { keyPc: 7, mode: 'major' });
  assert.equal(pickKey(levelById('minor-t'), 7, rng).mode, 'minor');
});

test('the four stages have the notes they promise', () => {
  assert.deepEqual(pool('major-rk', 4), [0, 2, 4, 5, 7, 9, 11, 12]);
  assert.deepEqual(pool('minor-t', 9), [0, 3, 7]);
  assert.deepEqual(pool('minor-5', 9), [0, 2, 3, 5, 7]);
  assert.deepEqual(pool('minor-6', 9), [0, 2, 3, 5, 7, 8]);
  assert.deepEqual(pool('minor-oct', 9), [0, 2, 3, 5, 7, 8, 10, 12]);
  assert.equal(newestOf(levelById('minor-oct'), pool('minor-oct')), 10, 'the flat seventh is the new note');
  for (const f of ['majorChrom', 'minorChrom']) {
    assert.deepEqual(pool(`${f}-1st`, 2), [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(pool(`${f}-2nd`, 2), [6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(pool(`${f}-oct`, 2), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.equal(pool(`${f}-2oct`, 2).length, 25);
  }
  assert.deepEqual(pool('major-2oct', 7), [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24]);
  assert.equal(pool('minor-2oct', 7).at(-1), 24);
});

test('each stage ends with two-note and four-note dictation over the whole octave', () => {
  for (const f of ['major', 'majorChrom', 'minor', 'minorChrom']) {
    const ls = LEVELS.filter((l) => l.family === f);
    assert.deepEqual(ls.slice(-2).map((l) => l.len), [2, 4], f);
    assert.deepEqual(ls.slice(-2).map((l) => l.id), [`${f}-dict-2`, `${f}-dict-4`]);
    for (const l of ls.slice(-2)) assert.deepEqual([l.from, l.to, l.neck], [0, 12, false]);
    assert.ok(ls.slice(0, -2).every((l) => !(l.len > 1)));
  }
});

test('more than one octave is always on the whole neck, whatever position is chosen', () => {
  const wide = LEVELS.filter((l) => l.neck);
  assert.deepEqual(wide.map((l) => l.id), ['major-2oct', 'majorChrom-2oct', 'minor-2oct', 'minorChrom-2oct', 'all-neck']);
  for (const l of wide) {
    for (const p of POSITIONS) {
      const ctx = buildContext(p.id, l, 3, l.mode ?? 'minor');
      assert.equal(ctx.positionId, 'neck');
      assert.ok(ctx.multiOctave, l.id);
    }
  }
  for (const l of LEVELS.filter((x) => !x.neck)) {
    for (const p of POSITIONS) {
      const ctx = buildContext(p.id, l, 3, l.mode);
      assert.equal(ctx.positionId, p.id);
      assert.ok(!ctx.multiOctave, l.id);
    }
  }
});

test('an explicit notes list is honoured, minor mode and gaps included', () => {
  const ctx = buildContext('A', { notes: [0, 3, 7], chromatic: false }, 9, 'minor');
  assert.deepEqual(ctx.pool, [0, 3, 7]);
  assert.ok([...ctx.positions.values()].every((p) => p.length === 1));
  assert.deepEqual(buildContext('neck', { notes: [0, 12, 99], chromatic: false }, 0, 'major').pool, [0, 12]);
});

test('the three boxes are one fingering: E and A the same, D with its B string a fret up', () => {
  const shape = (p) => p.notes.map(([s, f]) => [s - p.root[0], f - p.root[1]]);
  const [e, a, d] = ['E', 'A', 'D'].map((id) => shape(positionById(id)));
  assert.deepEqual(e, a);
  assert.deepEqual(d.slice(0, 5), a.slice(0, 5));
  assert.deepEqual(d.slice(5), a.slice(5).map(([s, f]) => [s, f + 1]));
  for (const p of BOXES) assert.deepEqual(p.notes.map((n) => midiOf(n) - midiOf(p.root)), [0, 2, 4, 5, 7, 9, 11, 12]);
});

test('C major reproduces the reference notes of each box exactly', () => {
  for (const p of BOXES) {
    const ctx = buildContext(p.id, levelById('major-6'), 0, 'major');
    assert.deepEqual(ctx.pool, [0, 2, 4, 5, 7, 9, 11, 12]);
    assert.deepEqual(ctx.pool.map((o) => ctx.positions.get(o)[0]), p.notes, p.id);
    assert.equal(ctx.tonic, midiOf(p.notes[0]));
    const [lo, hi] = [Math.min(...p.notes.map((n) => n[1])), Math.max(...p.notes.map((n) => n[1]))];
    assert.deepEqual(ctx.frame, { lo: Math.max(0, lo - 1), hi }, 'the frame hugs the notes');
  }
});

test('the drawn frame covers only the frets a level uses', () => {
  const close = buildContext('A', { notes: [0, 2], chromatic: false }, 0, 'major'); // frets 3 and 5
  assert.ok(close.frame.hi - close.frame.lo >= 4, 'never narrower than four frets');
  assert.ok(close.frame.lo <= 2 && close.frame.hi >= 5);
  assert.ok(buildContext('neck', { notes: [0, 4, 7], chromatic: false }, 0, 'major').frame.hi <= 12);
});

test('every level fits every position in every key, within the neck and the recorded samples', () => {
  for (const p of POSITIONS) {
    for (const keyPc of KEYS) {
      assert.equal(placePosition(p.id, keyPc).tonic % 12, keyPc, `${p.id} tonic is the key`);
      for (const mode of ['major', 'minor']) {
        for (const level of LEVELS) {
          const ctx = buildContext(p.id, level, keyPc, level.mode ?? mode);
          assert.ok(ctx.pool.length >= 2, `${level.id} in ${keyPc}`);
          for (const o of ctx.pool) {
            assert.ok(ctx.tonic + o >= MIN_MIDI && ctx.tonic + o <= MAX_MIDI, `${level.id} note ${o} in sample range`);
            for (const pos of ctx.positions.get(o)) {
              assert.equal(midiAt(pos), ctx.tonic + o, 'position sounds the note');
              assert.ok(pos[1] >= 0 && pos[1] <= MAX_FRET, `fret ${pos[1]}`);
              assert.ok(pos[1] >= ctx.frame.lo && pos[1] <= ctx.frame.hi, 'inside the drawn frame');
            }
          }
        }
      }
    }
  }
});

test('a box shows one octave of all 13 semitones in every key, one position each', () => {
  for (const p of BOXES) {
    for (const keyPc of KEYS) {
      const ctx = buildContext(p.id, levelById('majorChrom-oct'), keyPc, 'major');
      assert.deepEqual(ctx.pool, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], `${p.id} ${keyPc}`);
      assert.ok(ctx.positions.values().every((x) => x.length === 1), 'one position per note in a box');
    }
  }
});

test('whole neck: every position of a pitch, several octaves', () => {
  const ctx = buildContext('neck', levelById('major-6'), 0, 'major');
  assert.equal(ctx.tonic, 48);
  const e = ctx.positions.get(4); // E4 = 52
  assert.deepEqual(e.map(midiAt), e.map(() => 52));
  assert.ok(e.length >= 3);
  const all = buildContext('A', levelById('all-neck'), 0, 'major');
  assert.ok(all.multiOctave);
  assert.equal(all.pool.at(-1), 72 - 48 + 4); // top note is E5 (76)
  assert.equal(all.pool.length, 29, 'every semitone from the root to the top sample');
});

test('cadence in C major is the original C F G C', () => {
  const { chords } = cadenceFor(0, 'major');
  assert.deepEqual(chords, CADENCE.map((n) => CHORDS[n]));
});

test('cadence voicings: right chords, in key, inside the samples', () => {
  for (const keyPc of KEYS) {
    for (const mode of ['major', 'minor']) {
      const { chords, names } = cadenceFor(keyPc, mode);
      assert.equal(chords.length, 4);
      assert.equal(names.length, 4);
      const triadPcs = (chord) => new Set(chord.map((m) => (m - keyPc + 120) % 12));
      const flat3 = mode === 'minor' ? 3 : 4;
      assert.deepEqual([...triadPcs(chords[0])].sort((a, b) => a - b), [0, flat3, 7].sort((a, b) => a - b), `${keyPc} ${mode} tonic chord`);
      assert.deepEqual([...triadPcs(chords[1])].sort((a, b) => a - b), [5, 0, mode === 'minor' ? 8 : 9].sort((a, b) => a - b), 'subdominant');
      assert.deepEqual([...triadPcs(chords[2])].sort((a, b) => a - b), [2, 7, 11], 'dominant is major');
      assert.deepEqual(chords[3], chords[0]);
      for (const m of chords.flat()) assert.ok(m >= MIN_MIDI && m <= MAX_MIDI, `note ${m} in samples`);
      // The root of the tonic chord is the tonic.
      assert.equal(chords[0][0] % 12, keyPc);
    }
  }
});

test('notes are named by their interval from the root', () => {
  assert.equal(DEGREE_NAMES.length, 12);
  assert.equal(new Set(DEGREE_NAMES).size, 12);
  assert.deepEqual(SCALES.major.map(degreeName), ['1', '2', '3', '4', '5', '6', '7']);
  assert.deepEqual(SCALES.minor.map(degreeName), ['1', '2', '♭3', '4', '5', '♭6', '♭7']);
  assert.deepEqual([1, 6].map(degreeName), ['♭2', '♭5']);
  assert.deepEqual([12, 15, 24].map(degreeName), ["1'", "♭3'", "1''"]);
  assert.deepEqual(SCALES.major.map(degreeWord), ['root', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']);
  assert.deepEqual([3, 8, 10].map(degreeWord), ['flat third', 'flat sixth', 'flat seventh']);
  assert.deepEqual([12, 24, 16].map(degreeWord), ['octave', 'octave', 'third']);
});

test('colours, letters and log indexes', () => {
  assert.equal(new Set(SEMI_COLORS).size, 12);
  assert.equal(noteColor(12), noteColor(0));
  assert.equal(noteColor(24), noteColor(0));
  assert.equal(letterName(4, 0, 'major'), 'E');
  assert.equal(letterName(4, 5, 'major'), 'A');
  assert.equal(letterName(3, 9, 'minor'), 'C');
  assert.equal(letterName(7, 10, 'major'), 'F');
  assert.equal(keyName(6, 'major'), 'F♯ major');
  assert.equal(keyName(10, 'minor'), 'B♭ minor');
  // heard/answered in the log: degree 0-7 for scale notes of the first octave, 8 + offset otherwise.
  assert.deepEqual([0, 2, 4, 5, 7, 9, 11, 12].map((o) => degreeIndex(o, 'major')), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual([0, 2, 3, 5, 7, 8, 10, 12].map((o) => degreeIndex(o, 'minor')), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(degreeIndex(1, 'major'), 9);
  assert.equal(degreeIndex(16, 'major'), 24);
  assert.notEqual(degreeIndex(3, 'major'), degreeIndex(4, 'major'));
});
