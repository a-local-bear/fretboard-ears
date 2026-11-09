import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, STEPS, levelOf, stepDone, nextStep, pathCount, guideById, stepTitle, normalizeGuides } from '../js/path.js';
import { normalizeBacking } from '../js/harmony.js';
import { emptyProgress } from '../js/progress.js';
import { PASS_SCORE } from '../js/data.js';

const guides = STEPS.filter((s) => s.kind === 'guide');
const levels = STEPS.filter((s) => s.kind === 'level');

test('every level step names a real level, once', () => {
  for (const s of levels) assert.ok(levelOf(s), `unknown level ${s.id}`);
  assert.equal(new Set(levels.map((s) => s.id)).size, levels.length);
});

test('every stage ends with a guide, and guide ids are unique', () => {
  for (const st of STAGES) assert.equal(st.steps[st.steps.length - 1].kind, 'guide', st.name);
  assert.equal(new Set(guides.map((g) => g.id)).size, guides.length);
});

test('guides have text and a valid backing loop', () => {
  for (const g of guides) {
    assert.ok(g.title && g.intro && g.tries.length >= 3, g.id);
    assert.deepEqual(normalizeBacking(g.loop), g.loop, `${g.id} loop is not a valid backing track`);
  }
});

test('the path starts at the first level and moves on as steps are done', () => {
  const p = emptyProgress();
  assert.equal(nextStep(p, []).id, 'one-0');
  p.best['one-0'] = PASS_SCORE - 1;
  assert.equal(nextStep(p, []).id, 'one-0', 'a run below the pass mark does not count');
  for (const id of ['one-0', 'one-1', 'one-2']) p.best[id] = PASS_SCORE;
  assert.equal(nextStep(p, []).id, 'g-first');
  assert.equal(nextStep(p, ['g-first']).id, 'one-3');
  assert.deepEqual(pathCount(p, ['g-first']), { done: 4, total: STEPS.length });
});

test('an earlier step left undone is next, even with later ones done', () => {
  const p = { best: { 'one-1': 10, 'one-2': 10 } };
  assert.equal(nextStep(p, ['g-first']).id, 'one-0');
});

test('the whole path done gives no next step', () => {
  const p = { best: Object.fromEntries(levels.map((s) => [s.id, 10])) };
  assert.equal(nextStep(p, guides.map((g) => g.id)), null);
  assert.ok(stepDone(STEPS[0], p, []));
});

test('helpers', () => {
  assert.equal(guideById('g-minor').kind, 'guide');
  assert.equal(guideById('one-0'), null);
  assert.equal(stepTitle(STEPS[0]), 'One string · Major scale · Do · Re');
  assert.deepEqual(normalizeGuides(['g-first', 'nope', 'g-first', 3]), ['g-first']);
  assert.deepEqual(normalizeGuides(null), []);
});
