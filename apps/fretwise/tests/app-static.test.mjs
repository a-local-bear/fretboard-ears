// On static hosting (GitHub Pages) there is no server: progress lives in the browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bootApp } from './support/driver.mjs';

const app = await bootApp({ staticHost: true });
const { env, store, need, click, go, settle } = app;
test.after(() => app.close());

test('without a server the app opens on the map and plays in this browser', async () => {
  assert.doesNotMatch(app.screen(), /Welcome|name/i);
  assert.ok(need('.unit'), 'the learning map is showing');
  assert.equal(store.standalone, true);
  assert.match(store.id, /^player-[0-9a-f]{6}$/);
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

test('reset progress starts over in the same browser copy', async () => {
  const id = store.id;
  await go('/settings');
  await click('.reset-progress');
  await click('.modal .btn-bad');
  await settle(600);
  assert.equal(store.id, id);
  assert.equal(store.state.xp, 0);
  assert.equal(JSON.parse(env.window.localStorage.getItem(`fretwise.save.${id}`)).state.xp, 0);
  env.assertNoErrors();
});

test('the next visit goes straight to the browser, without asking the network', async () => {
  assert.equal(JSON.parse(env.window.localStorage.getItem('fretwise.device')).standalone, true);
  env.fetchImpl = () => Promise.reject(new Error('offline'));
  const saves = [];
  for (let i = 0; i < env.window.localStorage.length; i++) if (env.window.localStorage.key(i).startsWith('fretwise.save.')) saves.push(i);
  assert.equal(saves.length, 1, 'one document, however often the app is opened');
});
