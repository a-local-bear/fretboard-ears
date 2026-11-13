// First visit while the server cannot be reached and nothing is cached: the app still starts.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, httpFetch } from './support/driver.mjs';

const app = await bootApp({ serverDown: true });
const { env, store, need, go, settle } = app;
test.after(() => app.close());

test('there is no dead end: the app opens on the map and works in the browser', async () => {
  assert.ok(store.state);
  assert.ok(need('.unit'));
  assert.doesNotMatch(app.screen(), /Cannot reach/i);
  assert.equal(store.online, false);
  await go('/lesson/u1-1');
  await app.playLesson();
  await settle(100);
  assert.equal(store.state.xp, 15);
  assert.equal(JSON.parse(env.window.localStorage.getItem(`fretwise.save.${store.id}`)).state.xp, 15);
});

test('once the server answers, the progress is sent to it', async () => {
  env.fetchImpl = httpFetch;
  await settle(9000);
  assert.equal(store.unsaved, false);
  assert.equal(store.online, true);
  assert.equal((await app.serverProfile()).state.xp, 15);
  assert.equal((await app.listProfiles()).length, 1);
});
