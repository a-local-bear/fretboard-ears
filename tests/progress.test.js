import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProgress, isPassed, isUnlocked, chapterUnlocked, recordScore, nextLevel, passedCount,
} from '../js/progress.js';

test('pass threshold is 8/10', () => {
  assert.equal(isPassed(7), false);
  assert.equal(isPassed(8), true);
  assert.equal(isPassed(10), true);
});

test('only the first level of the first chapter starts unlocked', () => {
  const p = emptyProgress();
  assert.equal(isUnlocked(p, 'one', 0), true);
  assert.equal(isUnlocked(p, 'one', 1), false);
  assert.equal(chapterUnlocked(p, 'pA'), false);
  assert.equal(isUnlocked(p, 'pA', 0), false);
});

test('passing a level unlocks the next; failing does not', () => {
  let p = emptyProgress();
  p = recordScore(p, 'one', 0, 7).progress;
  assert.equal(isUnlocked(p, 'one', 1), false);
  p = recordScore(p, 'one', 0, 8).progress;
  assert.equal(isUnlocked(p, 'one', 1), true);
});

test('chapter unlocks when the previous chapter\'s level 7 is passed', () => {
  let p = emptyProgress();
  p = recordScore(p, 'one', 6, 9).progress;
  assert.equal(chapterUnlocked(p, 'pA'), true);
  assert.equal(isUnlocked(p, 'pA', 0), true);
  assert.equal(isUnlocked(p, 'pA', 1), false);
  assert.equal(chapterUnlocked(p, 'pB'), false);
});

test('unlockAll overrides everything', () => {
  const p = { ...emptyProgress(), unlockAll: true };
  assert.equal(isUnlocked(p, 'pC', 6), true);
});

test('best score only goes up', () => {
  let r = recordScore(emptyProgress(), 'one', 0, 6);
  assert.equal(r.newBest, true);
  r = recordScore(r.progress, 'one', 0, 9);
  assert.equal(r.newBest, true);
  r = recordScore(r.progress, 'one', 0, 8);
  assert.equal(r.newBest, false);
  assert.equal(r.progress.best['one-0'], 9);
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

test('passedCount counts levels with best >= 8', () => {
  let p = emptyProgress();
  p = recordScore(p, 'one', 0, 8).progress;
  p = recordScore(p, 'one', 1, 5).progress;
  p = recordScore(p, 'pA', 3, 10).progress;
  assert.equal(passedCount(p), 2);
});
