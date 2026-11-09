import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, mulberry32, hasTripleRun } from '../js/deck.js';
import { levelDegrees, LEVELS_PER_CHAPTER, ROUNDS } from '../js/data.js';

for (let level = 0; level < LEVELS_PER_CHAPTER; level++) {
  test(`level ${level + 1}: deck rules hold over 1000 seeds`, () => {
    const degrees = levelDegrees(level);
    const newest = degrees[degrees.length - 1];
    for (let seed = 1; seed <= 1000; seed++) {
      const deck = buildDeck(degrees, ROUNDS, mulberry32(seed));
      assert.equal(deck.length, ROUNDS);
      assert.ok(deck.every((d) => degrees.includes(d)), 'only level notes');
      assert.ok(deck.filter((d) => d === newest).length >= 3, 'newest at least 3x');
      for (const d of degrees) assert.ok(deck.includes(d), `degree ${d} present`);
      assert.ok(!hasTripleRun(deck), `no triple run: ${deck}`);
    }
  });
}

test('newest note appears exactly 3x when other notes fill the rest', () => {
  // Level 1 (Do, Re): 3 Re + 7 Do
  const deck = buildDeck([0, 1], ROUNDS, mulberry32(7));
  assert.equal(deck.filter((d) => d === 1).length, 3);
});
