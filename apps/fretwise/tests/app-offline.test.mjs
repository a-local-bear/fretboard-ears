// What happens when the server cannot be reached, or a profile disappears.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, httpFetch } from './support/driver.mjs';

const app = await bootApp();
const { env, store, need, click, go, settle } = app;
test.after(() => app.close());

test('progress survives a server outage and is sent when the server is back', async () => {
  const id = store.id;
  env.fetchImpl = () => Promise.reject(new Error('connection refused'));
  await go('/lesson/u1-1');
  await app.playLesson();
  await click('.results .continue');
  await settle(1000);
  assert.equal(store.state.xp, 15, 'the lesson still counted');
  assert.equal(store.online, false);
  assert.equal(store.unsaved, true);
  assert.match(need('.topbar').textContent, /Offline/);
  const cached = JSON.parse(env.window.localStorage.getItem(`fretwise.save.${id}`));
  assert.equal(cached.dirty, true);
  assert.equal(cached.state.xp, 15, 'a copy is kept in this browser');
  assert.equal((await app.serverProfile(id)).state.xp, 0, 'the server has not heard about it yet');

  env.fetchImpl = httpFetch;
  await settle(9000); // the retry timer
  assert.equal(store.unsaved, false);
  assert.equal(store.online, true);
  assert.equal((await app.serverProfile(id)).state.xp, 15);
  env.assertNoErrors();
});

test('work that never reached the server is merged in on the next visit', async () => {
  const id = store.id;
  // pretend a previous visit left unsaved progress behind in this browser
  const stale = JSON.parse(env.window.localStorage.getItem(`fretwise.save.${id}`));
  stale.dirty = true;
  stale.state.lessons['u1-2'] = { done: 1, stars: 2, best: 0.8, at: 5 };
  env.window.localStorage.setItem(`fretwise.save.${id}`, JSON.stringify(stale));
  assert.equal(await store.start(), store.state);
  await settle(800);
  assert.ok(store.state.lessons['u1-2'].done);
  assert.ok((await app.serverProfile(id)).state.lessons['u1-2'], 'the leftover progress was pushed to the server');
});

test('with the server down, the progress this browser has still opens', async () => {
  const id = store.id;
  env.fetchImpl = () => Promise.reject(new Error('connection refused'));
  assert.equal(await store.start(), store.state);
  assert.equal(store.id, id);
  assert.equal(store.online, false);
  assert.equal(store.state.name, 'Player');
  env.fetchImpl = httpFetch;
  await settle(9000);
});

test('a profile deleted on another device is recreated rather than losing the session', async () => {
  const old = store.id;
  const gone = await httpFetch(`http://127.0.0.1:${app.port}/api/profiles/${old}`, { method: 'DELETE' });
  assert.equal(gone.status, 200);
  store.update((st) => { st.settings.goal = 50; });
  await settle(1500);
  assert.notEqual(store.id, old);
  assert.match(store.id, /^player-/);
  const saved = await app.serverProfile();
  assert.equal(saved.state.settings.goal, 50);
  assert.equal(saved.state.xp, store.state.xp);
  assert.equal(env.window.localStorage.getItem(`fretwise.save.${old}`), null);
  env.assertNoErrors();
});

test('the server refuses writes from other web sites and non-JSON bodies', async () => {
  const base = `http://127.0.0.1:${app.port}/api/profiles`;
  const body = JSON.stringify({ state: { name: 'Mallory' } });
  const cross = await httpFetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body });
  assert.equal(cross.status, 403);
  const plain = await httpFetch(base, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
  assert.equal(plain.status, 415);
  const same = await httpFetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${app.port}` }, body });
  assert.equal(same.status, 201);
  const made = await same.json();
  const del = await httpFetch(`${base}/${made.id}`, { method: 'DELETE', headers: { Origin: 'http://evil.example' } });
  assert.equal(del.status, 403);
  assert.equal((await httpFetch(`${base}/${made.id}`)).status, 200, 'still there');
  const big = await httpFetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: { name: 'x', junk: 'y'.repeat(600000) } }) }).catch((err) => ({ status: err.code }));
  assert.ok(big.status === 413 || big.status === 'ECONNRESET' || big.status === 'EPIPE', `oversized bodies are rejected (${big.status})`);
});
