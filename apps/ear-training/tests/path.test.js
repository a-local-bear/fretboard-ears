import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, stageOf, tipOf, levelDone, nextLevel, pathCount } from '../public/js/path.js';
import { emptyProgress } from '../public/js/progress.js';
import { LEVELS, PASS_SCORE, levelById } from '../public/js/data.js';

const done = (ids, score = PASS_SCORE) => ({ best: Object.fromEntries(ids.map((id) => [id, score])) });

test('the path is the ladder: four stages and a last level, every level in exactly one', () => {
  assert.deepEqual(STAGES.map((s) => s.name), ['Major scale', 'Major with chromatic notes', 'Minor scale', 'Minor with chromatic notes', 'Any note']);
  assert.deepEqual(STAGES.map((s) => s.levels.length), [11, 6, 7, 6, 1]);
  assert.deepEqual(STAGES.flatMap((s) => s.levels), LEVELS);
  LEVELS.forEach((l) => assert.equal(STAGES[stageOf(l)].levels.includes(l), true));
});

test('stages explain themselves and every level has a tip', () => {
  for (const st of STAGES) assert.ok(st.desc && st.about.length > 100, st.name);
  for (const l of LEVELS) assert.ok(tipOf(l.id).length > 20, `${l.id} has no tip`);
  assert.equal(tipOf('nope'), '');
});

test('text names notes as intervals from the root, never in solfège or by fret', () => {
  const solfege = /\b(Do|Re|Mi|Fa|Sol|La|Si|Me|Le|Te|Ra|Se)\b/;
  for (const text of [...STAGES.flatMap((s) => [s.desc, s.about]), ...LEVELS.map((l) => tipOf(l.id))]) {
    assert.ok(!solfege.test(text), `solfège in "${text}"`);
    assert.ok(!/\bfret\b/i.test(text), `fretboard position in "${text}"`);
  }
  assert.match(tipOf('major-t0'), /root/i);
  assert.match(tipOf('minor-t'), /flat third/);
});

test('the path starts at the first level and moves on as levels are passed', () => {
  const p = emptyProgress();
  assert.equal(nextLevel(p).id, 'major-t0');
  p.best['major-t0'] = PASS_SCORE - 1;
  assert.equal(nextLevel(p).id, 'major-t0', 'a run below the pass mark does not count');
  assert.equal(levelDone(levelById('major-t0'), p), false);
  for (const id of ['major-t0', 'major-t1', 'major-t2']) p.best[id] = PASS_SCORE;
  assert.equal(nextLevel(p).id, 'major-3');
  assert.deepEqual(pathCount(p), { done: 3, total: LEVELS.length });
  assert.deepEqual(pathCount(p, STAGES[0].levels), { done: 3, total: 11 });
  assert.deepEqual(pathCount(p, STAGES[2].levels), { done: 0, total: 7 });
});

test('the path crosses from one stage into the next', () => {
  assert.equal(nextLevel(done(STAGES[0].levels.map((l) => l.id))).id, 'majorChrom-1st');
  assert.equal(nextLevel(done(LEVELS.slice(0, -1).map((l) => l.id))).id, 'all-neck');
});

test('an earlier level left undone is next, even with later ones done', () => {
  assert.equal(nextLevel(done(['major-t1', 'major-t2', 'minor-oct'], 10)).id, 'major-t0');
});

test('the whole path done gives no next level', () => {
  const p = done(LEVELS.map((l) => l.id), 10);
  assert.equal(nextLevel(p), null);
  assert.deepEqual(pathCount(p), { done: LEVELS.length, total: LEVELS.length });
  assert.equal(nextLevel(null).id, 'major-t0', 'no progress at all is tolerated');
});
