import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../public/js/deck.js';
import { makePhrase, makeChromaticPhrase, phraseFor, buildPhraseDeck, isStable } from '../public/js/phrase.js';
import { POSITIONS, LEVELS, SCALES, levelById, buildContext, ROUNDS } from '../public/js/data.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const outside = (p, mode = 'major') => p.filter((n) => !SCALES[mode].includes(n % 12));

test('phrases have the right length, stay in the pool and never repeat a note straight away', () => {
  for (let len = 2; len <= 5; len++) {
    for (let seed = 1; seed <= 200; seed++) {
      const p = makePhrase(MAJOR, len, { rng: mulberry32(seed) });
      assert.equal(p.length, len);
      assert.ok(p.every((n) => MAJOR.includes(n)), `${p}`);
      p.forEach((n, i) => { if (i) assert.notEqual(n, p[i - 1], `${p}`); });
    }
  }
});

test('phrases start near the root, move mostly by step, and usually end on the root, third or fifth', () => {
  let steps = 0;
  let moves = 0;
  let stable = 0;
  let total = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const p = makePhrase(MAJOR, 4, { rng: mulberry32(seed) });
    assert.ok(p[0] <= 7, `starts low: ${p}`);
    for (let i = 1; i < p.length; i++) {
      moves++;
      if (Math.abs(MAJOR.indexOf(p[i]) - MAJOR.indexOf(p[i - 1])) <= 2) steps++;
    }
    total++;
    if (isStable(p[3])) stable++;
  }
  assert.ok(steps / moves > 0.7, `stepwise share ${steps / moves}`);
  assert.ok(stable / total > 0.6, `stable endings ${stable / total}`);
});

test('minor phrases end on the minor stable degrees', () => {
  const minor = [0, 2, 3, 5, 7, 8, 10, 12];
  let stable = 0;
  for (let seed = 1; seed <= 200; seed++) {
    if (isStable(makePhrase(minor, 3, { mode: 'minor', rng: mulberry32(seed) }).at(-1), 'minor')) stable++;
  }
  assert.ok(stable > 120);
  assert.ok(isStable(3, 'minor') && !isStable(3, 'major'));
});

test('a chromatic phrase is a scale phrase with one outside note, a half step from its neighbour', () => {
  for (const mode of ['major', 'minor']) {
    const positions = new Set();
    const used = new Set();
    for (const len of [2, 4]) {
      for (let seed = 1; seed <= 300; seed++) {
        const p = makeChromaticPhrase(ALL, len, { mode, rng: mulberry32(seed) });
        assert.equal(p.length, len);
        assert.ok(p.every((n) => ALL.includes(n)), `${p}`);
        const out = outside(p, mode);
        assert.equal(out.length, 1, `${mode} ${p}: exactly one note from outside the scale`);
        const i = p.indexOf(out[0]);
        const neighbour = i < len - 1 ? p[i + 1] : p[i - 1];
        assert.equal(Math.abs(neighbour - out[0]), 1, `${mode} ${p}: the outside note leans on its neighbour`);
        p.forEach((n, k) => { if (k) assert.notEqual(n, p[k - 1], `${p}`); });
        if (len === 4) positions.add(i);
        used.add(out[0]);
      }
    }
    assert.deepEqual([...positions].sort(), [0, 1, 2, 3], 'the outside note can come anywhere in the phrase');
    assert.deepEqual([...used].sort((a, b) => a - b), ALL.filter((n) => !SCALES[mode].includes(n % 12)), `${mode}: all five outside notes turn up`);
  }
});

test('without notes from outside the scale a chromatic phrase is a plain one', () => {
  for (let seed = 1; seed <= 20; seed++) assert.deepEqual(outside(makeChromaticPhrase(MAJOR, 4, { rng: mulberry32(seed) })), []);
});

test('phraseFor follows the level: from the scale, or with a chromatic note', () => {
  const plain = levelById('minor-dict-4');
  const chrom = levelById('minorChrom-dict-4');
  for (let seed = 1; seed <= 50; seed++) {
    assert.equal(outside(phraseFor(plain, buildContext('A', plain, 0, 'minor').pool, 'minor', mulberry32(seed)), 'minor').length, 0);
    assert.equal(outside(phraseFor(chrom, ALL, 'minor', mulberry32(seed)), 'minor').length, 1);
  }
});

test('phrase decks are deterministic for a seed', () => {
  for (const id of ['major-dict-4', 'majorChrom-dict-2']) {
    const l = levelById(id);
    assert.deepEqual(buildPhraseDeck(l, ALL, 10, { rng: mulberry32(9) }), buildPhraseDeck(l, ALL, 10, { rng: mulberry32(9) }));
  }
});

test('a phrase deck has no immediate duplicates', () => {
  const deck = buildPhraseDeck({ len: 3 }, MAJOR, ROUNDS, { rng: mulberry32(3) });
  assert.equal(deck.length, ROUNDS);
  deck.forEach((p, i) => { if (i) assert.notEqual(p.join(), deck[i - 1].join()); });
});

test('every dictation level builds valid decks in every position and key', () => {
  const levels = LEVELS.filter((l) => l.len > 1);
  assert.equal(levels.length, 8);
  for (const { id } of POSITIONS) {
    for (const level of levels) {
      for (let keyPc = 0; keyPc < 12; keyPc++) {
        const pool = buildContext(id, level, keyPc, level.mode).pool;
        for (let seed = 1; seed <= 5; seed++) {
          const deck = buildPhraseDeck(level, pool, ROUNDS, { mode: level.mode, rng: mulberry32(seed) });
          assert.equal(deck.length, ROUNDS);
          assert.ok(new Set(deck.map((p) => p.join())).size >= ROUNDS - 1, `${level.id}: phrases barely repeat`);
          for (const p of deck) {
            assert.equal(p.length, level.len, level.id);
            assert.ok(p.every((n) => pool.includes(n)), level.id);
            assert.equal(outside(p, level.mode).length, level.chromatic ? 1 : 0, `${level.id}: ${p}`);
          }
        }
      }
    }
  }
});
