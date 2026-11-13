import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, isPassed, recordBest, levelAfter, bestScore, normalizeProgress, legacyLevelId } from '../js/progress.js';
import { LEVELS, levelById } from '../js/data.js';

test('a good score is 8/10 or more', () => {
  assert.equal(isPassed(7), false);
  assert.equal(isPassed(8), true);
  assert.equal(isPassed(10), true);
});

test('best score only goes up', () => {
  let r = recordBest(emptyProgress(), 'major-t0', 6);
  assert.equal(r.newBest, true);
  r = recordBest(r.progress, 'major-t0', 9);
  assert.equal(r.newBest, true);
  r = recordBest(r.progress, 'major-t0', 8);
  assert.equal(r.newBest, false);
  assert.equal(bestScore(r.progress, 'major-t0'), 9);
  assert.equal(bestScore(r.progress, 'major-t1'), null);
});

test('recordBest does not mutate its input', () => {
  const p = emptyProgress();
  recordBest(p, 'major-t0', 10);
  assert.deepEqual(p.best, {});
});

test('levelAfter follows the ladder across stages and ends after the last', () => {
  assert.equal(levelAfter(levelById('major-t0')).id, 'major-t1');
  assert.equal(levelAfter(levelById('major-dict-4')).id, 'majorChrom-1st');
  assert.equal(levelAfter(levelById('minorChrom-dict-4')).id, 'all-neck');
  assert.equal(levelAfter(LEVELS.at(-1)), null);
});

test('normalizeProgress drops invalid scores but keeps unknown level ids', () => {
  assert.deepEqual(normalizeProgress(null), emptyProgress());
  assert.deepEqual(normalizeProgress('x'), emptyProgress());
  assert.deepEqual(normalizeProgress({ best: { a: 11, b: -1, c: 1.5, d: 'x', 'd-quality': 7, 'major-t0': 9 } }), { best: { 'd-quality': 7, 'major-t0': 9 } });
});

test('an old per-chapter level id maps to the level that replaced it', () => {
  assert.equal(legacyLevelId('one-t0'), 'major-t0');
  assert.equal(legacyLevelId('pC-6'), 'major-6');
  assert.equal(legacyLevelId('neck-major-oct'), 'major-6');
  assert.equal(legacyLevelId('pB-rk-minor'), 'minor-oct');
  assert.equal(legacyLevelId('pA-pairs-rk'), 'major-dict-2');
  assert.equal(legacyLevelId('neck-dict-5'), 'major-dict-4');
  assert.equal(legacyLevelId('neck-minorChrom-2oct'), 'minorChrom-2oct');
  // Levels with no counterpart, ids of today's ladder and other things are left alone.
  for (const id of ['one-0', 'pA-sing-1', 'pA-pairs-1st', 'pA-major-2nd', 'neck-rk-all', 'major-t0', 'minor-oct', 'all-neck', 'd-quality', 'x']) {
    assert.equal(legacyLevelId(id), null, id);
  }
  // Everything an old id maps to is a level of the ladder.
  for (const ch of ['one', 'pA', 'pB', 'pC', 'neck']) {
    for (const sfx of ['t0', '3', '6', 'rk-major', 'major-2oct', 'dict-4', 'majorChrom-oct', 'minor-oct', 'dict-minor', 'minorChrom-1st']) {
      assert.ok(levelById(legacyLevelId(`${ch}-${sfx}`)), `${ch}-${sfx}`);
    }
  }
});

test('scores from the chapters carry over: the best across them counts for the new level', () => {
  const p = normalizeProgress({ best: { 'one-t0': 6, 'pA-t0': 9, 'pB-t0': 7, 'pC-6': 8, 'neck-major-oct': 10, 'pA-rk-major': 8, 'one-dict-rk': 9, 'pA-dict-4': 5 } });
  assert.equal(p.best['major-t0'], 9);
  assert.equal(p.best['major-6'], 10);
  assert.equal(p.best['major-rk'], 8);
  assert.equal(p.best['major-dict-4'], 9);
  assert.equal(p.best['one-t0'], 6, 'the old scores are kept as they were');
  assert.deepEqual(normalizeProgress(p), p, 'idempotent');
});

test('a score already earned on the new ladder is never lowered by an old one', () => {
  const p = normalizeProgress({ best: { 'major-t1': 10, 'one-t1': 4, 'minor-oct': 3, 'pA-rk-minor': 9 } });
  assert.equal(p.best['major-t1'], 10);
  assert.equal(p.best['minor-oct'], 9);
});

test('scores from before the triad-first build-up: the old first levels are ignored, a passed first half stands in', () => {
  const p = normalizeProgress({ best: { 'one-0': 10, 'one-1': 9, 'one-2': 3, 'one-3': 8, 'pA-3': 7, 'one-4': 6 } });
  assert.equal(p.best['major-3'], 8);
  assert.equal(p.best['major-4'], 6);
  assert.deepEqual(['major-t0', 'major-t1', 'major-t2'].map((id) => p.best[id]), [8, 8, 8]);
  const q = normalizeProgress({ best: { 'one-0': 10, 'pA-3': 7 } });
  assert.equal(q.best['major-t0'], undefined, 'a first half that was not passed does not');
  assert.equal(q.best['major-3'], 7);
});
