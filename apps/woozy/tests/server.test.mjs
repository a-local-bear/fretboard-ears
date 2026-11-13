// Starts the real server on a spare port with a throw-away data directory.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
let child;
let dataDir;

// fetch() normalises "..", so path-traversal probes need a raw request.
const raw = (rawPath) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: PORT, path: rawPath, method: 'GET' }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  req.end();
});

const json = async (method, url, body) => {
  const res = await fetch(BASE + url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'woozy-test-'));
  child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', WOOZY_DATA: dataDir }, stdio: 'pipe' });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('Woozy is running')) resolve(); });
    child.on('exit', (code) => reject(new Error(`server exited early (${code})`)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
});

after(async () => {
  child?.kill();
  await rm(dataDir, { recursive: true, force: true });
});

test('serves the app', async () => {
  const res = await fetch(`${BASE}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /<title>Woozy/);
  const js = await fetch(`${BASE}/js/main.js`);
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.equal(js.headers.get('cache-control'), 'no-cache');
  const again = await fetch(`${BASE}/js/main.js`, { headers: { 'If-None-Match': js.headers.get('etag') } });
  assert.equal(again.status, 304);
  assert.equal((await fetch(`${BASE}/nope.txt`)).status, 404);
  assert.equal((await fetch(`${BASE}/`, { method: 'POST' })).status, 405);
});

test('never serves files outside public/', async () => {
  for (const probe of ['/../server.js', '/..%2fserver.js', '/%2e%2e/server.js', '/js/../../server.js', '/..\\server.js', '/%2e%2e%2f%2e%2e%2fetc/passwd', '/js/%00']) {
    const res = await raw(probe);
    assert.ok([400, 403, 404].includes(res.status), `${probe} → ${res.status}`);
    assert.ok(!res.body.includes('createServer') && !res.body.includes('root:'), `${probe} leaked a file`);
  }
});

test('progress and songs round-trip and persist to disk', async () => {
  assert.deepEqual((await json('GET', '/api/state')).data, { rev: 0, progress: {}, songs: {} });

  assert.equal((await json('PUT', '/api/progress/numbers', { done: true })).status, 200);
  assert.equal((await json('PUT', '/api/progress/numbers', { quiz: true })).status, 200);
  const song = { id: 'abc123', title: 'Demo', updatedAt: 1000, sections: [] };
  const created = await json('PUT', '/api/songs/abc123', song);
  assert.equal(created.status, 200);
  assert.equal(created.data.rev, 3, 'every write bumps the revision');
  assert.equal((await json('GET', '/api/rev')).data.rev, 3);

  let state = (await json('GET', '/api/state')).data;
  assert.equal(state.progress.numbers.done, true);
  assert.equal(state.progress.numbers.quiz, true, 'a later partial update must not wipe earlier fields');
  assert.equal(state.songs.abc123.title, 'Demo');

  assert.equal(state.songs.abc123.rev, 3);

  // Device A saves an edit based on revision 3 …
  const fromA = await json('PUT', '/api/songs/abc123', { ...song, title: 'Newer', rev: 3 });
  assert.equal(fromA.status, 200);
  assert.equal(fromA.data.rev, 4);
  // … so device B, still holding revision 3, must not overwrite it — whatever its clock says.
  const fromB = await json('PUT', '/api/songs/abc123', { ...song, title: 'Stale', rev: 3, updatedAt: 9e15 });
  assert.equal(fromB.status, 409);
  assert.equal(fromB.data.song.title, 'Newer');
  assert.equal(fromB.data.song.rev, 4);

  const onDisk = JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8'));
  assert.equal(onDisk.songs.abc123.title, 'Newer');

  assert.equal((await json('DELETE', '/api/songs/abc123')).status, 200);
  state = (await json('GET', '/api/state')).data;
  assert.equal(state.songs.abc123, undefined);
  assert.equal(state.rev, 5);
  assert.equal((await json('DELETE', '/api/songs/abc123')).data.rev, 5, 'deleting nothing is not a change');
});

test('rejects bad input', async () => {
  assert.equal((await json('PUT', '/api/songs/__proto__', { title: 'x' })).status, 400);
  assert.equal((await json('PUT', '/api/songs/has space', { title: 'x' })).status, 400);
  assert.equal((await json('PUT', `/api/songs/${'a'.repeat(60)}`, { title: 'x' })).status, 400);
  assert.equal((await json('PUT', '/api/songs/ok1', [1, 2])).status, 400);
  assert.equal((await json('GET', '/api/nothing')).status, 404);
  const notJson = await fetch(`${BASE}/api/songs/ok1`, { method: 'PUT', body: '{nope' });
  assert.equal(notJson.status, 400);
  const huge = await fetch(`${BASE}/api/songs/ok1`, { method: 'PUT', body: JSON.stringify({ blob: 'x'.repeat(700 * 1024) }) }).catch(() => ({ status: 413 }));
  assert.equal(huge.status, 413);
  assert.equal(({}).polluted, undefined);
  assert.deepEqual(Object.keys((await json('GET', '/api/state')).data.songs), []);
});
