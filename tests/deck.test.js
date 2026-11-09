import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, mulberry32, hasTripleRun } from '../js/deck.js';
import { CHAPTERS, levelsFor, buildContext, newestOf, pickKey, ROUNDS } from '../js/data.js';

for (const chapter of CHAPTERS) {
  for (const level of levelsFor(chapter.id)) {
    test(`${level.id} (${level.title}): deck rules hold`, () => {
      // Every key, and both modes for levels that draw one at random.
      for (let keyPc = 0; keyPc < 12; keyPc++) {
        for (const mode of level.mode ? [level.mode] : ['major', 'minor']) {
          const degrees = buildContext(chapter.id, level, keyPc, mode).pool;
          const newest = level.grow != null ? newestOf(level, degrees) : degrees[degrees.length - 1];
          for (let seed = 1; seed <= 25; seed++) {
            const deck = buildDeck(degrees, ROUNDS, mulberry32(seed), newest);
            assert.equal(deck.length, ROUNDS);
            assert.ok(deck.every((d) => degrees.includes(d)), 'only level notes');
            assert.ok(!hasTripleRun(deck), `no triple run: ${deck}`);
            if (degrees.length <= ROUNDS - 2) {
              assert.ok(deck.filter((d) => d === newest).length >= 3, 'newest at least 3x');
              for (const d of degrees) assert.ok(deck.includes(d), `note ${d} present`);
            } else {
              assert.equal(new Set(deck).size, Math.min(ROUNDS, degrees.length), 'no repeats until the pool is used up');
            }
          }
        }
      }
    });
  }
}

test('newest note appears exactly 3x when other notes fill the rest', () => {
  // Two notes (Do, Re): 3 Re + 7 Do
  const deck = buildDeck([0, 2], ROUNDS, mulberry32(7));
  assert.equal(deck.filter((d) => d === 2).length, 3);
});

test('the build-up levels draw from the expected notes', () => {
  const pools = levelsFor('one').slice(0, 7).map((l) => buildContext('one', l, 0, 'major').pool);
  assert.deepEqual(pools[0], [0, 7]);
  assert.deepEqual(pools[6], [0, 2, 4, 5, 7, 9, 11, 12]);
});

test('random-key levels draw a key and mode', () => {
  const rk = levelsFor('neck').find((l) => l.random === 'any');
  const seen = new Set();
  for (let seed = 1; seed < 200; seed++) {
    const { keyPc, mode } = pickKey(rk, 0, mulberry32(seed));
    assert.ok(keyPc >= 0 && keyPc < 12);
    seen.add(mode);
  }
  assert.deepEqual([...seen].sort(), ['major', 'minor']);
  assert.deepEqual(pickKey(levelsFor('one')[0], 5), { keyPc: 5, mode: 'major' });
});

test('the newest note can be any note of the pool', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const deck = buildDeck([0, 2, 4, 7], ROUNDS, mulberry32(seed), 2);
    assert.ok(deck.filter((d) => d === 2).length >= 3);
    assert.ok([0, 4, 7].every((n) => deck.includes(n)));
    assert.ok(!hasTripleRun(deck));
  }
});
