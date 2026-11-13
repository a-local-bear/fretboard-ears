// On static hosting (GitHub Pages) there is no server: players and progress live in the browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bootApp } from './support/driver.mjs';

const app = await bootApp({ staticHost: true });
const { env, store, need, click, go, settle } = app;
test.after(() => app.close());

test('without a server a player is created and plays in this browser', async () => {
  assert.match(app.screen(), /Welcome to Fretwise/);
  assert.equal(store.standalone, true);
  need('.input').value = 'Kim';
  await click('.create');
  await settle(600);
  assert.match(store.id, /^kim-[0-9a-f]{6}$/);
  await go('/lesson/u1-1');
  await app.playLesson();
  await click('.results .continue');
  await settle(1000);
  assert.equal(store.state.xp, 15);
  assert.equal(store.unsaved, false);
  assert.equal(store.online, true);
  assert.doesNotMatch(need('.topbar').textContent, /Offline/);
  const saved = JSON.parse(env.window.localStorage.getItem(`fretwise.save.${store.id}`));
  assert.equal(saved.state.xp, 15);
  assert.equal(saved.dirty, false);
  assert.deepEqual(fs.readdirSync(path.join(app.dataDir, 'profiles')), [], 'nothing reached a server');
  env.assertNoErrors();
});

test('the settings say where progress lives instead of listing server addresses', async () => {
  await go('/settings');
  const text = env.document.body.textContent;
  assert.match(text, /kept in this browser/);
  assert.doesNotMatch(text, /another device/);
});

test('players can be switched, reopened and deleted', async () => {
  const kim = store.id;
  await click('.switch-player');
  await settle(50);
  assert.match(app.screen(), /Who is playing\?/);
  assert.match(need('.player').textContent, /Kim.*15 XP/);
  await click('.new-player');
  need('.input').value = 'Ada';
  await click('.create');
  await settle(600);
  assert.notEqual(store.id, kim);
  assert.equal((await store.profiles()).map((p) => p.name).join(), 'Ada,Kim');
  await store.close();
  assert.equal(await store.open(kim), true);
  assert.equal(store.state.xp, 15, 'Kim’s progress is still there');
  assert.equal(await store.remove(kim), true);
  assert.equal((await store.profiles()).map((p) => p.name).join(), 'Ada');
  assert.equal(await store.open(kim), false);
  env.assertNoErrors();
});

test('the next visit goes straight to the browser, without asking the network', async () => {
  assert.equal(JSON.parse(env.window.localStorage.getItem('fretwise.device')).standalone, true);
  env.fetchImpl = () => Promise.reject(new Error('offline'));
  assert.equal((await store.profiles()).length, 1);
});
