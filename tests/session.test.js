import test from 'node:test';
import assert from 'node:assert/strict';
import { planSession, blockLabel, BLOCKS } from '../js/session.js';
import { emptyStats, addEntry } from '../js/stats.js';
import { emptyProgress } from '../js/progress.js';
import { mulberry32 } from '../js/deck.js';
import { levelsFor } from '../js/data.js';

let t = 1e12;
const ent = (lid, h, a) => ({ t: (t += 1000), lid, hs: h, as: a, tries: 1, ms: 1000 });
const statsOf = (log) => log.reduce(addEntry, emptyStats());
const prog = (ids, score = 9) => ({ best: Object.fromEntries(ids.map((i) => [i, score])) });
const rep = (n, f) => Array.from({ length: n }, f);
const plan = (progress, log = [], opts) => planSession({ progress, stats: statsOf(log), log }, opts);

test('brand-new player starts on the first C-major levels', () => {
  const p = planSession({ progress: emptyProgress(), stats: emptyStats(), log: [] });
  assert.equal(p.length, BLOCKS);
  assert.deepEqual(p.map((b) => b.levelId), ['one-0', 'one-1', 'one-2', 'one-1']);
  assert.equal(p[0].keyPc, 0);
  assert.equal(blockLabel(1, p), '2/4 · NEW NOTE');
});

test('missing inputs are tolerated', () => {
  assert.equal(planSession().length, BLOCKS);
});

test('warm-up is the most-played C-major level, always in C', () => {
  const log = [...rep(5, () => ent('one-1', 0, 0)), ...rep(9, () => ent('one-3', 0, 0)), ...rep(20, () => ent('pA-pairs-oct', 0, 2))];
  const p = plan(prog(['one-1', 'one-3']), log);
  assert.equal(p[0].levelId, 'one-3');
  assert.equal(p[0].keyPc, 0);
  assert.equal(p[0].kind, 'warmup');
});

test('weak block picks the narrowest played level containing the weakest notes', () => {
  // Fa (5) and Sol (7) are weak, Do is fine
  const log = [...rep(10, () => ent('one-6', 0, 0)), ...rep(10, () => ent('one-6', 5, 4)), ...rep(10, () => ent('one-6', 7, 5))];
  const p = plan(prog(['one-1', 'one-2', 'one-3', 'one-6']), log);
  assert.equal(p[1].adaptive, true);
  // one-2 (Do–Fa) lacks Sol; one-3 (Do–Sol) is the narrowest with both
  assert.equal(p[1].levelId, 'one-3');
  assert.equal(p[1].label, 'WEAK NOTES');
});

test('block 3 follows the ladder and is gated by what was passed', () => {
  const first = plan(prog(['one-0', 'one-1', 'one-2']), [ent('one-2', 0, 0)]);
  assert.equal(first[2].levelId, 'one-pairs-1st');
  assert.equal(first[2].label, 'DEGREE PAIRS');
  assert.equal(plan(prog(['one-0']), [ent('one-0', 0, 0)])[2].kind, 'new');
  const oct = plan(prog(['one-6', 'one-pairs-1st', 'one-pairs-oct']), [ent('one-6', 0, 0)]);
  assert.equal(oct[2].levelId, 'one-dict-2');
  assert.equal(oct[2].label, 'DICTATION');
  const all = ['one-6', 'one-pairs-1st', 'one-pairs-oct', 'one-dict-2', 'one-dict-3', 'one-dict-4', 'one-dict-5'];
  assert.equal(plan(prog(all), [ent('one-6', 0, 0)])[2].levelId, 'one-dict-5');
});

test('block 4 is a random key only after a whole-octave C-major pass', () => {
  const without = plan(prog(['one-1', 'one-5']), [ent('one-5', 0, 0)]);
  assert.equal(without[3].kind, 'weak');
  assert.equal(without[3].adaptive, true);
  const withOct = plan(prog(['one-6']), [ent('one-6', 0, 0)], { rng: mulberry32(1) });
  assert.equal(withOct[3].levelId, 'one-rk-major');
  const passedBoth = prog(['one-6', 'one-rk-major', 'one-rk-minor']);
  const a = plan(passedBoth, [ent('one-6', 0, 0)], { rng: mulberry32(1) });
  const b = plan(passedBoth, [ent('one-6', 0, 0)], { rng: mulberry32(1) });
  assert.match(a[3].levelId, /one-rk-(major|minor)/);
  assert.deepEqual(a, b);
});

test('planned level indices point at the named levels', () => {
  const p = plan(prog(['one-6', 'one-pairs-1st']), rep(3, () => ent('one-6', 4, 5)));
  for (const b of p) assert.equal(levelsFor(b.chapterId)[b.level].id, b.levelId);
});
