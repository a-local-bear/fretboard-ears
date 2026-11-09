import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, isPassed, recordScore, nextLevel, playedCount, bestScore, levelKey, normalizeProgress } from '../js/progress.js';
import { CHAPTERS, levelsFor } from '../js/data.js';

test('a good score is 8/10 or more', () => {
  assert.equal(isPassed(7), false);
  assert.equal(isPassed(8), true);
  assert.equal(isPassed(10), true);
});

test('best score only goes up', () => {
  let r = recordScore(emptyProgress(), 'one', 0, 6);
  assert.equal(r.newBest, true);
  r = recordScore(r.progress, 'one', 0, 9);
  assert.equal(r.newBest, true);
  r = recordScore(r.progress, 'one', 0, 8);
  assert.equal(r.newBest, false);
  assert.equal(bestScore(r.progress, 'one', 0), 9);
  assert.equal(bestScore(r.progress, 'one', 1), null);
});

test('recordScore does not mutate its input', () => {
  const p = emptyProgress();
  recordScore(p, 'one', 0, 10);
  assert.deepEqual(p.best, {});
});

test('nextLevel crosses chapters and ends after the last', () => {
  assert.deepEqual(nextLevel('one', 0), { chapterId: 'one', level: 1 });
  assert.deepEqual(nextLevel('one', 6), { chapterId: 'one', level: 7 });
  const last = levelsFor('one').length - 1;
  assert.deepEqual(nextLevel('one', last), { chapterId: 'pA', level: 0 });
  assert.deepEqual(nextLevel('pC', last), { chapterId: 'neck', level: 0 });
  assert.equal(nextLevel('neck', levelsFor('neck').length - 1), null);
});

test('playedCount counts levels with any score, including 0', () => {
  let p = emptyProgress();
  p = recordScore(p, 'one', 0, 8).progress;
  p = recordScore(p, 'one', 1, 0).progress;
  p = recordScore(p, 'pA', 3, 10).progress;
  assert.equal(playedCount(p, 'one'), 2);
  assert.equal(playedCount(p, 'pA'), 1);
  assert.equal(playedCount(p, 'pB'), 0);
});

test('original progress keys still point at the original levels', () => {
  for (const c of CHAPTERS.slice(0, 4)) {
    for (let l = 0; l < 7; l++) assert.equal(levelKey(c.id, l), `${c.id}-${l}`);
  }
  // Scores saved by the version with seven levels per chapter are read back untouched.
  const saved = { best: { 'one-0': 10, 'one-6': 8, 'pC-3': 5 } };
  const p = normalizeProgress(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(p, saved);
  assert.equal(bestScore(p, 'one', 6), 8);
  assert.equal(bestScore(p, 'pC', 3), 5);
  assert.equal(playedCount(p, 'one'), 2);
  // New levels add keys next to them.
  const r = recordScore(p, 'one', 7, 9);
  assert.equal(r.progress.best['one-major-2nd'], 9);
  assert.equal(r.progress.best['one-0'], 10);
});

test('normalizeProgress drops invalid scores but keeps unknown level ids', () => {
  assert.deepEqual(normalizeProgress(null), emptyProgress());
  assert.deepEqual(normalizeProgress('x'), emptyProgress());
  assert.deepEqual(normalizeProgress({ best: { a: 11, b: -1, c: 1.5, d: 'x', 'neck-rk-all': 7 } }), { best: { 'neck-rk-all': 7 } });
});
