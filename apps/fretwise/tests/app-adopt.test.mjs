// Saved progress that already exists is adopted silently: the one with the most XP.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp } from './support/driver.mjs';
import { newState } from '../public/js/progress.js';

const saved = (xp) => ({ ...newState(), xp, streak: { count: 2, best: 2, lastDay: '2026-11-12' } });
const app = await bootApp({
  startDate: '2026-11-13T09:00:00',
  profiles: [{ id: 'ada-111111', rev: 4, state: saved(120) }, { id: 'kim-222222', rev: 9, state: saved(700) }, { id: 'bo-333333', rev: 1, state: saved(40) }],
});
const { store, need, $, settle } = app;
test.after(() => app.close());

test('an existing save with the most XP is adopted without asking anything', async () => {
  assert.equal(store.id, 'kim-222222');
  assert.equal(store.state.xp, 700);
  assert.ok(need('.unit'), 'on the map');
  assert.equal($('.input'), null);
  assert.doesNotMatch(app.screen(), /Who is playing|Welcome/);
  assert.match(need('.topbar').textContent, /2/, 'the streak is still there');
});

test('no extra document is created, and a later start keeps using it', async () => {
  await settle(600);
  assert.equal((await app.listProfiles()).length, 3);
  const again = await store.start();
  assert.equal(again.xp, 700);
  assert.equal(store.id, 'kim-222222');
});
