import test from 'node:test';
import assert from 'node:assert/strict';
import { planSession, blockLabel, BLOCKS } from '../js/session.js';
import { emptyStats, addEntry } from '../js/stats.js';
import { emptyProgress } from '../js/progress.js';
import { mulberry32 } from '../js/deck.js';
import { LEVELS } from '../js/data.js';

let t = 1e12;
const ent = (lid, h, a) => ({ t: (t += 1000), lid, hs: h, as: a, tries: 1, ms: 1000 });
const statsOf = (log) => log.reduce(addEntry, emptyStats());
const prog = (ids, score = 9) => ({ best: Object.fromEntries(ids.map((i) => [i, score])) });
const rep = (n, f) => Array.from({ length: n }, f);
const plan = (progress, log = [], opts) => planSession({ progress, stats: statsOf(log), log }, opts);
const BUILD_UP = ['major-t0', 'major-t1', 'major-t2', 'major-3', 'major-4', 'major-5', 'major-6'];
const STAGE_1 = LEVELS.filter((l) => l.family === 'major').map((l) => l.id);

test('brand-new player starts on the first levels', () => {
  const p = planSession({ progress: emptyProgress(), stats: emptyStats(), log: [] });
  assert.equal(p.length, BLOCKS);
  assert.deepEqual(p.map((b) => b.levelId), ['major-t0', 'major-t1', 'major-t2', 'major-t1']);
  assert.equal(p[0].keyPc, 0);
  assert.equal(blockLabel(1, p), '2/4 · NEW NOTE');
});

test('missing inputs are tolerated', () => {
  assert.equal(planSession().length, BLOCKS);
});

test('warm-up is the most-played level of the build-up, always in C', () => {
  const log = [...rep(5, () => ent('major-t1', 0, 0)), ...rep(9, () => ent('major-3', 0, 0)), ...rep(20, () => ent('major-dict-2', 0, 2))];
  const p = plan(prog(['major-t1', 'major-3']), log);
  assert.equal(p[0].levelId, 'major-3');
  assert.equal(p[0].keyPc, 0);
  assert.equal(p[0].kind, 'warmup');
});

test('plays logged in the old chapters count for the level that replaced theirs', () => {
  const log = [...rep(4, () => ent('major-t1', 0, 0)), ...rep(3, () => ent('pA-3', 0, 0)), ...rep(3, () => ent('one-3', 0, 0))];
  assert.equal(plan(prog(['major-t1', 'major-3']), log)[0].levelId, 'major-3');
});

test('with nothing played in the build-up the warm-up is the frontier, or the octave once that is behind', () => {
  assert.equal(plan(prog(['major-t0']), [ent('minor-oct', 0, 0)])[0].levelId, 'major-t1');
  assert.equal(plan(prog(STAGE_1), [ent('minor-oct', 0, 0)])[0].levelId, 'major-6');
});

test('weak block picks the narrowest played level containing the weakest notes', () => {
  // The fourth (5) and the fifth (7) are weak, the root is fine.
  const log = [...rep(10, () => ent('major-6', 0, 0)), ...rep(10, () => ent('major-6', 5, 4)), ...rep(10, () => ent('major-6', 7, 5))];
  const p = plan(prog(['major-t1', 'major-t2', 'major-3', 'major-6']), log);
  assert.equal(p[1].adaptive, true);
  // major-t2 (1 2 3 5) lacks the fourth; major-3 (1–5) is the narrowest with both
  assert.equal(p[1].levelId, 'major-3');
  assert.equal(p[1].label, 'WEAK NOTES');
});

test('a weak note from outside the major scale is drilled where it lives', () => {
  const log = [...rep(10, () => ent('minor-oct', 0, 0)), ...rep(10, () => ent('minor-oct', 3, 2))];
  const p = plan(prog([...STAGE_1, 'minor-t', 'minor-oct']), log);
  assert.equal(p[1].levelId, 'minor-t', 'the minor triad is the narrowest level with the flat third');
});

test('block 3 is dictation once a stage\'s whole octave is passed, else the frontier', () => {
  const early = plan(prog(['major-t0', 'major-t1']), [ent('major-t1', 0, 0)]);
  assert.equal(early[2].kind, 'new');
  assert.equal(early[2].levelId, 'major-t2');
  const fixedOnly = plan(prog(BUILD_UP), [ent('major-6', 0, 0)]);
  assert.equal(fixedOnly[2].kind, 'new', 'the octave must be passed in a random key first');
  const oct = plan(prog([...BUILD_UP, 'major-rk']), [ent('major-6', 0, 0)]);
  assert.equal(oct[2].levelId, 'major-dict-2');
  assert.equal(oct[2].label, 'DICTATION');
  assert.equal(oct[2].adaptive, true);
  assert.equal(plan(prog([...BUILD_UP, 'major-rk', 'major-dict-2']), [ent('major-6', 0, 0)])[2].levelId, 'major-dict-4');
  assert.equal(plan(prog(STAGE_1), [ent('major-6', 0, 0)])[2].levelId, 'major-dict-4', 'all passed: the hardest open one');
  const minor = plan(prog([...STAGE_1, 'minor-oct']), [ent('major-6', 0, 0)]);
  assert.equal(minor[2].levelId, 'minor-dict-2', 'the next stage with its octave passed opens its dictation');
});

test('block 4 is a random key only after the fixed-key octave is passed', () => {
  const without = plan(prog(['major-t1', 'major-5']), [ent('major-5', 0, 0)]);
  assert.equal(without[3].kind, 'weak');
  assert.equal(without[3].adaptive, true);
  const withOct = plan(prog(BUILD_UP), [ent('major-6', 0, 0)], { rng: mulberry32(1) });
  assert.equal(withOct[3].levelId, 'major-rk');
  assert.equal(withOct[3].label, 'RANDOM KEY');
  assert.equal(plan(prog(['major-6']), [ent('major-6', 0, 0)])[3].levelId, 'major-rk', 'even with earlier levels still open');
});

test('block 4 stays within what the player has reached', () => {
  // Working on the chromatic first half: the chromatic octave is still ahead, so the major one is reviewed.
  assert.equal(plan(prog(STAGE_1), [ent('major-6', 0, 0)])[3].levelId, 'major-rk');
  // At the chromatic octave it becomes the block.
  assert.equal(plan(prog([...STAGE_1, 'majorChrom-1st', 'majorChrom-2nd']), [ent('major-6', 0, 0)])[3].levelId, 'majorChrom-oct');
  // With several passed, one of them by the rng, the same for the same seed.
  const many = prog([...STAGE_1, 'majorChrom-1st', 'majorChrom-2nd', 'majorChrom-oct']);
  const a = plan(many, [ent('major-6', 0, 0)], { rng: mulberry32(1) });
  const b = plan(many, [ent('major-6', 0, 0)], { rng: mulberry32(1) });
  assert.match(a[3].levelId, /^(major-rk|majorChrom-oct)$/);
  assert.deepEqual(a, b);
});

test('planned level indices point at the named levels', () => {
  for (const p of [plan(prog(STAGE_1), rep(3, () => ent('major-6', 4, 5))), plan(prog(['major-t0']), [ent('major-t0', 0, 0)]), planSession()]) {
    assert.equal(p.length, BLOCKS);
    for (const b of p) assert.equal(LEVELS[b.level].id, b.levelId);
  }
});
