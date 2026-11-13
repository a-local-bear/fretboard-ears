// On static hosting a save already in this browser is adopted too.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp } from './support/driver.mjs';
import { newState } from '../public/js/progress.js';

const doc = (xp) => JSON.stringify({ rev: 3, dirty: false, state: { ...newState(), xp } });
const app = await bootApp({
  staticHost: true,
  storage: { 'fretwise.save.old-aaaaaa': doc(50), 'fretwise.save.old-bbbbbb': doc(300) },
});
const { store, need } = app;
test.after(() => app.close());

test('the browser copy with the most XP opens straight on the map', () => {
  assert.equal(store.id, 'old-bbbbbb');
  assert.equal(store.state.xp, 300);
  assert.ok(need('.unit'));
  assert.doesNotMatch(app.screen(), /Welcome|name/i);
});
