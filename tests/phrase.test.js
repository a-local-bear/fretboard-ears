import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../js/deck.js';
import {
  allPairs, buildPairDeck, makePhrase, buildPhraseDeck, buildSequenceDeck, isStable,
} from '../js/phrase.js';
import { CHAPTERS, levelsFor, buildContext, ROUNDS } from '../js/data.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];

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

test('phrases start near Do, move mostly by step, and usually end on Do, Mi or Sol', () => {
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

test('phrases are deterministic for a seed', () => {
  assert.deepEqual(buildPhraseDeck(MAJOR, 4, 10, { rng: mulberry32(9) }), buildPhraseDeck(MAJOR, 4, 10, { rng: mulberry32(9) }));
  assert.deepEqual(buildPairDeck(MAJOR, 10, mulberry32(9)), buildPairDeck(MAJOR, 10, mulberry32(9)));
});

test('a phrase deck has no immediate duplicates', () => {
  const deck = buildPhraseDeck(MAJOR, 3, ROUNDS, { rng: mulberry32(3) });
  assert.equal(deck.length, ROUNDS);
  deck.forEach((p, i) => { if (i) assert.notEqual(p.join(), deck[i - 1].join()); });
});

test('degree pairs cover every pair of the pool evenly', () => {
  const pool = [0, 2, 4, 5];
  assert.equal(allPairs(pool).length, 12);
  const deck = buildPairDeck(pool, 36, mulberry32(5));
  const counts = new Map();
  for (const [a, b] of deck) {
    assert.notEqual(a, b);
    counts.set(`${a},${b}`, (counts.get(`${a},${b}`) || 0) + 1);
  }
  assert.equal(counts.size, 12);
  assert.ok([...counts.values()].every((c) => c === 3));
  deck.forEach((p, i) => { if (i) assert.notEqual(p.join(), deck[i - 1].join()); });
  const short = buildPairDeck(MAJOR, ROUNDS, mulberry32(5));
  assert.equal(new Set(short.map((p) => p.join())).size, ROUNDS, 'no repeats before the bag is empty');
});

test('every sequence level builds valid decks in every key', () => {
  for (const c of CHAPTERS) {
    for (const level of levelsFor(c.id).filter((l) => l.len > 1)) {
      assert.ok(['pairs', 'dictation', 'sing'].includes(level.family));
      for (let keyPc = 0; keyPc < 12; keyPc++) {
        const mode = level.mode ?? 'major';
        const pool = buildContext(c.id, level, keyPc, mode).pool;
        for (let seed = 1; seed <= 5; seed++) {
          const deck = buildSequenceDeck(level, pool, ROUNDS, mode, mulberry32(seed));
          assert.equal(deck.length, ROUNDS);
          for (const p of deck) {
            assert.equal(p.length, level.len, level.id);
            assert.ok(p.every((n) => pool.includes(n)), level.id);
          }
        }
      }
    }
  }
});

test('sequence levels join the level model after the existing ones', () => {
  const ls = levelsFor('pA');
  assert.deepEqual(ls.slice(0, 19).filter((l) => l.len), []);
  assert.deepEqual(ls.filter((l) => l.family === 'dictation').map((l) => l.len), [2, 3, 4, 5, 4, 4]);
  assert.deepEqual(ls.filter((l) => l.family === 'pairs').map((l) => l.id), ['pA-pairs-1st', 'pA-pairs-oct', 'pA-pairs-minor', 'pA-pairs-rk']);
});
