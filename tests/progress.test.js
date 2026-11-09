import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, isPassed, recordScore, nextLevel, playedCount, bestScore } from '../js/progress.js';

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
  assert.deepEqual(nextLevel('one', 6), { chapterId: 'pA', level: 0 });
  assert.equal(nextLevel('pC', 6), null);
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
