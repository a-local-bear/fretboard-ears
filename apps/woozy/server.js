#!/usr/bin/env node
// Woozy — zero-dependency local server.
// Serves the static app from ./public and keeps lesson progress + songs in
// ./data/state.json so every device on the LAN sees the same work.
//
//   node server.js              → http://0.0.0.0:3210
//   PORT=4000 node server.js    → different port
//   HOST=127.0.0.1 node server.js → this machine only

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.WOOZY_DATA || path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PORT = Number(process.env.PORT) || 3210;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 512 * 1024;
const ID_RE = /^[A-Za-z0-9-]{1,48}$/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// ---------------------------------------------------------------- state ----

// rev counts every write.  Each song remembers the rev of its last save, which
// is how two devices editing the same song are told apart (no clocks involved).
let state = { rev: 0, progress: {}, songs: {} };

async function loadState() {
  try {
    const raw = JSON.parse(await readFile(STATE_FILE, 'utf8'));
    state = {
      rev: Number.isInteger(raw?.rev) ? raw.rev : 0,
      progress: raw && typeof raw.progress === 'object' && raw.progress ? raw.progress : {},
      songs: raw && typeof raw.songs === 'object' && raw.songs ? raw.songs : {},
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Never overwrite a file we could not read: keep it aside and start clean.
      const aside = `${STATE_FILE}.unreadable-${Date.now()}`;
      await rename(STATE_FILE, aside).catch(() => {});
      console.warn(`! Could not read ${STATE_FILE} (${err.message}). Moved it to ${aside}.`);
    }
  }
}

// Writes are serialised and atomic (tmp file + rename) so a crash mid-write
// can't leave a half-written state file behind.
let writeChain = Promise.resolve();
function saveState() {
  const snapshot = JSON.stringify(state, null, 2);
  writeChain = writeChain
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      const tmp = `${STATE_FILE}.tmp`;
      await writeFile(tmp, snapshot);
      await rename(tmp, STATE_FILE);
    })
    .catch((err) => console.error('! Failed to save state:', err.message));
  return writeChain;
}

// ----------------------------------------------------------------- http ----

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': MIME['.json'],
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname) {
  const parts = pathname.split('/').filter(Boolean); // ['api', resource, id?]
  const [, resource, id] = parts;

  if (resource === 'health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true });
  }

  if (resource === 'state' && req.method === 'GET' && parts.length === 2) {
    return sendJson(res, 200, state);
  }

  // Cheap "has anything changed?" check that open tabs poll.
  if (resource === 'rev' && req.method === 'GET' && parts.length === 2) {
    return sendJson(res, 200, { rev: state.rev });
  }

  if ((resource === 'progress' || resource === 'songs') && parts.length === 3) {
    if (!ID_RE.test(id)) return sendJson(res, 400, { error: 'Bad id' });

    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return sendJson(res, 400, { error: 'Expected a JSON object' });
      }
      if (resource === 'progress') {
        const prev = state.progress[id] || {};
        state.progress[id] = {
          done: typeof body.done === 'boolean' ? body.done : !!prev.done,
          quiz: typeof body.quiz === 'boolean' ? body.quiz : !!prev.quiz,
          ts: Date.now(),
        };
        state.rev += 1;
        await saveState();
        return sendJson(res, 200, { ...state.progress[id], rev: state.rev });
      }
      // Songs: a save must be based on the copy the server currently holds.
      // If another device saved in between, hand that copy back instead of
      // overwriting it — the client keeps its own edits as a separate song.
      const existing = state.songs[id];
      if (existing && body.rev !== existing.rev) {
        return sendJson(res, 409, { error: 'This song was changed on another device', song: existing });
      }
      state.rev += 1;
      state.songs[id] = { ...body, id, rev: state.rev };
      await saveState();
      return sendJson(res, 200, { ok: true, rev: state.rev });
    }

    if (req.method === 'DELETE' && resource === 'songs') {
      if (state.songs[id]) {
        delete state.songs[id];
        state.rev += 1;
        await saveState();
      }
      return sendJson(res, 200, { ok: true, rev: state.rev });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
}

async function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (rel.includes('\0')) {
    res.writeHead(400).end('Bad request');
    return;
  }
  let file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let info = await stat(file).catch(() => null);
  if (info && info.isDirectory()) {
    file = path.join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info || !info.isFile()) {
    res.writeHead(404, { 'Content-Type': MIME['.txt'] }).end('Not found');
    return;
  }

  const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const headers = {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    // Always revalidate: edits show up on every device straight away.
    'Cache-Control': 'no-cache',
    ETag: etag,
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers).end();
    return;
  }
  headers['Content-Length'] = info.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(req, res, pathname);
    } else {
      res.writeHead(405).end('Method not allowed');
    }
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('! Request failed:', err);
    if (!res.headersSent) sendJson(res, status, { error: err.message || 'Server error' });
    else res.destroy();
  }
});

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

await loadState();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: PORT=${PORT + 1} node server.js`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('\n  Woozy is running\n');
  console.log(`  This machine:   http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    for (const addr of lanAddresses()) console.log(`  On your network: http://${addr}:${PORT}`);
  }
  console.log(`\n  Songs & progress are saved in ${STATE_FILE}\n`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close();
    writeChain.finally(() => process.exit(0));
  });
}
