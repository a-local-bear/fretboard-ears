import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTERS, CHORDS, CADENCE, OPEN, MAX_FRET, MIN_MIDI, MAX_MIDI, SCALES,
  levelsFor, buildContext, placeChapter, cadenceFor, midiOf,
  solfegeName, letterName, keyName, noteColor, degreeIndex, SEMI_NAMES, SEMI_COLORS,
} from '../js/data.js';

const KEYS = [...Array(12).keys()];
const midiAt = ([s, f]) => OPEN[s] + f;

test('level ids are unique and the original ones are kept', () => {
  const all = CHAPTERS.flatMap((c) => levelsFor(c.id).map((l) => l.id));
  assert.equal(new Set(all).size, all.length);
  for (const c of CHAPTERS.slice(0, 4)) {
    const ls = levelsFor(c.id);
    for (let l = 0; l < 7; l++) assert.equal(ls[l].id, `${c.id}-${l}`);
    assert.equal(ls[0].idx, 0);
  }
});

test('every pattern chapter has the same level families; the neck adds octave levels', () => {
  assert.equal(levelsFor('pA').length, 19);
  assert.equal(levelsFor('neck').length, 23);
  for (const f of ['major', 'majorChrom', 'minor', 'minorChrom', 'random']) {
    assert.ok(levelsFor('neck').some((l) => l.family === f), f);
  }
  assert.ok(levelsFor('neck').some((l) => l.name === 'Many octaves'));
  assert.ok(!levelsFor('pA').some((l) => l.name === 'Many octaves'));
});

test('C major reproduces the original chapter notes exactly', () => {
  for (const c of CHAPTERS.slice(0, 4)) {
    const ctx = buildContext(c.id, levelsFor(c.id)[6], 0, 'major');
    assert.deepEqual(ctx.pool, [0, 2, 4, 5, 7, 9, 11, 12]);
    assert.deepEqual(ctx.pool.map((o) => ctx.positions.get(o)[0]), c.notes, c.id);
    assert.equal(ctx.tonic, midiOf(c.notes[0]));
    const [lo, hi] = [Math.min(...c.notes.map((n) => n[1])), Math.max(...c.notes.map((n) => n[1]))];
    assert.deepEqual(ctx.frame, { lo: Math.max(0, lo - 1), hi: hi + 1 });
  }
});

test('patterns transpose to every key within the neck and the recorded samples', () => {
  for (const c of CHAPTERS) {
    for (const keyPc of KEYS) {
      const place = placeChapter(c.id, keyPc);
      assert.equal(place.tonic % 12, keyPc, `${c.id} tonic is the key`);
      for (const mode of ['major', 'minor']) {
        for (const level of levelsFor(c.id)) {
          const ctx = buildContext(c.id, level, keyPc, level.mode ?? mode);
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

test('a pattern chapter shows one octave of all 13 semitones in every key', () => {
  for (const c of CHAPTERS.slice(0, 4)) {
    for (const keyPc of KEYS) {
      const ctx = buildContext(c.id, { from: 0, to: 12, chromatic: true }, keyPc, 'major');
      assert.deepEqual(ctx.pool, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], `${c.id} ${keyPc}`);
      assert.ok(ctx.positions.values().every((p) => p.length === 1), 'one position per note in a pattern');
    }
  }
});

test('minor levels use the natural minor scale, chromatic levels all semitones', () => {
  const minor = levelsFor('pA').find((l) => l.id === 'pA-minor-oct');
  assert.deepEqual(buildContext('pA', minor, 9, 'minor').pool, [0, 2, 3, 5, 7, 8, 10, 12]);
  const chrom = levelsFor('pA').find((l) => l.id === 'pA-minorChrom-1st');
  assert.deepEqual(buildContext('pA', chrom, 9, 'minor').pool, [0, 1, 2, 3, 4, 5, 6]);
  const second = levelsFor('pA').find((l) => l.id === 'pA-major-2nd');
  assert.deepEqual(buildContext('pA', second, 0, 'major').pool, [7, 9, 11, 12]);
});

test('whole neck: every position of a pitch, several octaves', () => {
  const ctx = buildContext('neck', { from: 0, to: 12, chromatic: false }, 0, 'major');
  assert.equal(ctx.tonic, 48);
  const e = ctx.positions.get(4); // E4 = 52
  assert.deepEqual(e.map(midiAt), e.map(() => 52));
  assert.ok(e.length >= 3);
  const all = buildContext('neck', levelsFor('neck').find((l) => l.id === 'neck-major-all'), 0, 'major');
  assert.ok(all.multiOctave);
  assert.equal(all.pool[all.pool.length - 1], 72 - 48 + 4); // top note is E5 (76)
  assert.equal(buildContext('neck', levelsFor('neck').find((l) => l.id === 'neck-minor-2oct'), 7, 'minor').pool.at(-1), 24);
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

test('names, colours and log indexes', () => {
  assert.equal(SEMI_NAMES.length, 12);
  assert.equal(new Set(SEMI_NAMES).size, 12);
  assert.equal(new Set(SEMI_COLORS).size, 12);
  assert.deepEqual([0, 2, 4, 5, 7, 9, 11, 12].map(solfegeName), ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', "Do'"]);
  assert.equal(solfegeName(3), 'Me');
  assert.equal(solfegeName(13), "Ra'");
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
  assert.ok(SCALES.minor.includes(3));
});
