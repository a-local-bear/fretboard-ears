import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, STEPS, levelOf, drillOf, stepOf, stepDone, nextStep, pathCount, guideById, stepTitle, normalizeGuides, guideParagraphs } from '../js/path.js';
import { tuneById, progressionById } from '../js/songs.js';
import { normalizeBacking } from '../js/harmony.js';
import { emptyProgress } from '../js/progress.js';
import { PASS_SCORE } from '../js/data.js';

const guides = STEPS.filter((s) => s.kind === 'guide');
const levels = STEPS.filter((s) => s.kind === 'level');
const drills = STEPS.filter((s) => s.kind === 'drill');
const scored = STEPS.filter((s) => s.kind !== 'guide');

test('every level and drill step names a real one, once, with a tip', () => {
  for (const s of levels) assert.ok(levelOf(s), `unknown level ${s.id}`);
  for (const s of drills) assert.ok(drillOf(s), `unknown drill ${s.id}`);
  assert.equal(new Set(scored.map((s) => s.id)).size, scored.length);
  for (const s of scored) assert.ok(s.tip && s.tip.length > 20, `${s.id} has no tip`);
  assert.equal(stepOf('d-mode').kind, 'drill');
  assert.equal(stepOf('nope'), null);
});

test('stages explain themselves and the path ends with songs, keys and progressions covered', () => {
  for (const st of STAGES) assert.ok(st.desc && st.about.length > 100, st.name);
  const ids = new Set(drills.map((s) => s.id));
  for (const id of ['d-quality', 'd-func-145', 'd-prog-dia', 'd-named-all', 'd-mode', 'd-tonic-any', 'd-tune-major']) assert.ok(ids.has(id), id);
});

test('every stage ends with a guide, and guide ids are unique', () => {
  for (const st of STAGES) assert.equal(st.steps[st.steps.length - 1].kind, 'guide', st.name);
  assert.equal(new Set(guides.map((g) => g.id)).size, guides.length);
});

test('guides have deep text, valid examples and a valid backing loop', () => {
  for (const g of guides) {
    assert.ok(g.title && g.tries.length >= 3, g.id);
    assert.ok(guideParagraphs(g).length >= 2, `${g.id} intro`);
    for (const t of g.tries) assert.ok(t.length > 80, `${g.id}: short try "${t}"`);
    for (const id of g.examples?.tunes || []) assert.ok(tuneById(id), `${g.id}: tune ${id}`);
    for (const id of g.examples?.progs || []) assert.ok(progressionById(id), `${g.id}: progression ${id}`);
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
  const p = { best: Object.fromEntries(scored.map((s) => [s.id, 10])) };
  assert.equal(nextStep({ best: Object.fromEntries(levels.map((s) => [s.id, 10])) }, guides.map((g) => g.id)).kind, 'drill');
  assert.equal(nextStep(p, guides.map((g) => g.id)), null);
  assert.ok(stepDone(STEPS[0], p, []));
});

test('helpers', () => {
  assert.equal(guideById('g-minor').kind, 'guide');
  assert.equal(guideById('one-0'), null);
  assert.equal(stepTitle(STEPS[0]), 'One string · Major scale · Do · Re');
  assert.equal(stepTitle(stepOf('d-quality')), 'Ear drill · Major or minor chord');
  assert.deepEqual(normalizeGuides(['g-first', 'nope', 'g-first', 3]), ['g-first']);
  assert.deepEqual(normalizeGuides(null), []);
});
