#!/usr/bin/env node
// Fretwise server — zero dependencies, Node 18+.
//
//  * serves the web app from ./public
//  * stores each player's progress as a JSON file in ./data/profiles so every
//    device on the network sees the same progress
//  * listens on plain HTTP (default :8420) and on HTTPS with a self-signed
//    certificate (default :8421).  Browsers only allow microphone access on
//    secure pages, so the "play your real guitar" mode needs the HTTPS address
//    when the app is opened from another device.
//
// Environment: PORT, HTTPS_PORT (0 = off), HOST, FRETWISE_DATA, FRETWISE_LOG=1

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const intEnv = (name, fallback) => {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`${name} must be a port number, got "${v}"`);
  return n;
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.webmanifest']);
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const MAX_BODY = 512 * 1024;

export function createApp(options = {}) {
  const dataDir = path.resolve(options.dataDir || process.env.FRETWISE_DATA || path.join(ROOT, 'data'));
  const profileDir = path.join(dataDir, 'profiles');
  const log = options.log ?? process.env.FRETWISE_LOG === '1';
  const ports = { http: options.port ?? 0, https: options.httpsPort ?? 0 };
  fs.mkdirSync(profileDir, { recursive: true });

  // ---- profiles ----------------------------------------------------------
  const profilePath = (id) => path.join(profileDir, id + '.json');
  const readProfile = (id) => {
    try { return JSON.parse(fs.readFileSync(profilePath(id), 'utf8')); }
    catch (err) { if (err.code === 'ENOENT') return null; throw err; }
  };
  const writeProfile = (doc) => {
    const file = profilePath(doc.id);
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(doc));
    fs.renameSync(tmp, file);
  };
  const summary = (doc) => ({
    id: doc.id,
    rev: doc.rev,
    updatedAt: doc.updatedAt,
    name: String(doc.state?.name ?? 'Player').slice(0, 40),
    avatar: doc.state?.avatar ?? null,
    xp: Number(doc.state?.xp) || 0,
    streak: Number(doc.state?.streak?.count) || 0,
    lastDay: doc.state?.streak?.lastDay ?? null,
  });
  const listProfiles = () => fs.readdirSync(profileDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => { try { return summary(JSON.parse(fs.readFileSync(path.join(profileDir, f), 'utf8'))); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const newId = (name) => {
    const slug = String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'player';
    for (;;) {
      const id = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
      if (!fs.existsSync(profilePath(id))) return id;
    }
  };

  // ---- helpers -----------------------------------------------------------
  const send = (res, status, headers, body) => {
    res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(body);
  };
  const json = (res, status, value) => send(res, status, {
    'Content-Type': MIME['.json'], 'Cache-Control': 'no-store',
  }, JSON.stringify(value));

  const readJson = (req) => new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('body too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); }
      catch { reject(Object.assign(new Error('invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });

  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  const info = (req) => ({
    app: 'fretwise',
    version: VERSION,
    hostname: os.hostname(),
    addresses: lanAddresses(),
    httpPort: ports.http || null,
    httpsPort: ports.https || null,
    secure: Boolean(req.socket.encrypted),
  });

  // ---- API ---------------------------------------------------------------
  async function api(req, res, parts) {
    const [, resource, id, extra] = parts;
    if (resource === 'info' && !id && req.method === 'GET') return json(res, 200, info(req));

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Only pages served by this server may change data: a web page from somewhere
      // else must not be able to edit progress behind the player's back.
      const origin = req.headers.origin;
      if (origin) {
        let from = null;
        try { from = new URL(origin).host; } catch { /* malformed */ }
        if (from !== req.headers.host) return json(res, 403, { error: 'cross-site requests are not allowed' });
      }
      if ((req.method === 'POST' || req.method === 'PUT') && !/^application\/json\b/i.test(req.headers['content-type'] || '')) {
        return json(res, 415, { error: 'send the body as application/json' });
      }
    }

    if (resource === 'profiles' && !extra) {
      if (!id) {
        if (req.method === 'GET') return json(res, 200, listProfiles());
        if (req.method === 'POST') {
          const body = await readJson(req);
          if (!isObject(body) || !isObject(body.state)) return json(res, 400, { error: 'expected {state}' });
          const name = String(body.state.name ?? '').trim();
          if (!name) return json(res, 400, { error: 'a name is required' });
          const doc = { id: newId(name), rev: 1, updatedAt: Date.now(), state: { ...body.state, name: name.slice(0, 40) } };
          writeProfile(doc);
          return json(res, 201, doc);
        }
        return json(res, 405, { error: 'method not allowed' });
      }
      if (!ID_RE.test(id)) return json(res, 400, { error: 'bad profile id' });
      const doc = readProfile(id);
      if (!doc) return json(res, 404, { error: 'no such profile' });
      if (req.method === 'GET') return json(res, 200, doc);
      if (req.method === 'PUT') {
        const body = await readJson(req);
        if (!isObject(body) || !isObject(body.state)) return json(res, 400, { error: 'expected {rev, state}' });
        // optimistic concurrency: the client must have seen the latest revision
        if (body.rev !== doc.rev) return json(res, 409, doc);
        const next = { id, rev: doc.rev + 1, updatedAt: Date.now(), state: body.state };
        writeProfile(next);
        return json(res, 200, { id, rev: next.rev, updatedAt: next.updatedAt });
      }
      if (req.method === 'DELETE') {
        const bin = path.join(dataDir, 'deleted');
        fs.mkdirSync(bin, { recursive: true });
        fs.renameSync(profilePath(id), path.join(bin, `${id}.${Date.now()}.json`));
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'method not allowed' });
    }
    return json(res, 404, { error: 'not found' });
  }

  // ---- static files ------------------------------------------------------
  const gzipCache = new Map(); // file -> {tag, body}
  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { 'Content-Type': MIME['.txt'] }, 'method not allowed');
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, { 'Content-Type': MIME['.txt'] }, 'bad request'); }
    if (rel.includes('\0')) return send(res, 400, { 'Content-Type': MIME['.txt'] }, 'bad request');
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(PUBLIC, path.normalize(rel));
    if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) return send(res, 403, { 'Content-Type': MIME['.txt'] }, 'forbidden');
    let stat;
    try { stat = fs.statSync(file); } catch { stat = null; }
    if (!stat || !stat.isFile()) return send(res, 404, { 'Content-Type': MIME['.txt'] }, 'not found');

    const ext = path.extname(file).toLowerCase();
    const tag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // always revalidate so every device picks up updates immediately
      'Cache-Control': ext === '.woff2' ? 'public, max-age=604800' : 'no-cache',
      ETag: tag,
    };
    if (req.headers['if-none-match'] === tag) return send(res, 304, headers);
    let body = null;
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let hit = gzipCache.get(file);
      if (!hit || hit.tag !== tag) { hit = { tag, body: zlib.gzipSync(fs.readFileSync(file)) }; gzipCache.set(file, hit); }
      body = hit.body;
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
    } else {
      body = fs.readFileSync(file);
    }
    headers['Content-Length'] = body.length;
    return send(res, 200, headers, req.method === 'HEAD' ? undefined : body);
  }

  // ---- request handler ---------------------------------------------------
  async function handler(req, res) {
    const started = Date.now();
    try {
      const url = new URL(req.url, 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'api') await api(req, res, parts);
      else serveStatic(req, res, url.pathname);
    } catch (err) {
      if (!res.headersSent) json(res, err.status || 500, { error: err.status ? err.message : 'server error' });
      else res.end();
      if (!err.status) console.error('[fretwise] request failed:', err);
    }
    if (log) console.log(`${new Date().toISOString()} ${req.socket.remoteAddress} ${req.method} ${req.url} -> ${res.statusCode} ${Date.now() - started}ms`);
  }

  return { handler, ports, dataDir };
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------
const VIRTUAL_IFACE = /^(docker|br-|veth|virbr|vmnet|vboxnet|tun|tap|tailscale|zt|wg|lo)/i;

export function lanAddresses({ includeVirtual = false } = {}) {
  const found = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (!includeVirtual && VIRTUAL_IFACE.test(name)) continue;
      found.push(a.address);
    }
  }
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return found.sort((a, b) => rank(a) - rank(b));
}

// A self-signed certificate that names every address this machine answers on.
function ensureCertificate(dataDir) {
  const dir = path.join(dataDir, 'cert');
  const keyFile = path.join(dir, 'key.pem');
  const certFile = path.join(dir, 'cert.pem');
  const sans = ['DNS:localhost', `DNS:${os.hostname()}`, `DNS:${os.hostname()}.local`, 'IP:127.0.0.1',
    ...lanAddresses({ includeVirtual: true }).map((ip) => `IP:${ip}`)];
  const wanted = [...new Set(sans)].join(',');
  try {
    const cert = new crypto.X509Certificate(fs.readFileSync(certFile));
    const have = (cert.subjectAltName || '').split(',').map((s) => s.trim().replace(/^IP Address:/, 'IP:')).join(',');
    const daysLeft = (new Date(cert.validTo).getTime() - Date.now()) / 86400000;
    if (have === wanted && daysLeft > 30) return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  } catch { /* missing or unreadable: (re)create below */ }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '820',
    '-keyout', keyFile, '-out', certFile,
    '-subj', `/CN=Fretwise on ${os.hostname()}`,
    '-addext', `subjectAltName=${wanted}`,
    '-addext', 'basicConstraints=critical,CA:FALSE',
    '-addext', 'keyUsage=critical,digitalSignature,keyEncipherment',
    '-addext', 'extendedKeyUsage=serverAuth',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  fs.chmodSync(keyFile, 0o600);
  return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(server.address().port); });
  });
}

// ---------------------------------------------------------------------------
async function main() {
  const host = process.env.HOST || '0.0.0.0';
  const wantHttp = intEnv('PORT', 8420);
  const wantHttps = intEnv('HTTPS_PORT', 8421);
  const app = createApp();
  const servers = [];

  const httpServer = http.createServer(app.handler);
  try {
    app.ports.http = await listen(httpServer, wantHttp, host);
    servers.push(httpServer);
  } catch (err) {
    console.error(err.code === 'EADDRINUSE'
      ? `Port ${wantHttp} is already in use. Stop the other program or start Fretwise with PORT=<another port>.`
      : `Could not start the HTTP server: ${err.message}`);
    process.exit(1);
  }

  if (wantHttps) {
    try {
      const tls = ensureCertificate(app.dataDir);
      const httpsServer = https.createServer(tls, app.handler);
      app.ports.https = await listen(httpsServer, wantHttps, host);
      servers.push(httpsServer);
    } catch (err) {
      console.warn(`HTTPS is off (${err.code === 'ENOENT' ? 'openssl was not found' : err.message}). ` +
        'The app works normally, but microphone mode is only available at http://localhost.');
    }
  }

  const ips = lanAddresses();
  const line = (label, proto, port) => {
    const urls = [`${proto}://localhost:${port}`, ...ips.map((ip) => `${proto}://${ip}:${port}`)];
    console.log(`  ${label.padEnd(22)} ${urls.join('   ')}`);
  };
  console.log(`\nFretwise ${VERSION} is running.\n`);
  line('Open in a browser:', 'http', app.ports.http);
  if (app.ports.https) line('With microphone mode:', 'https', app.ports.https);
  console.log(`\n  Progress is saved in ${path.join(app.dataDir, 'profiles')}`);
  if (app.ports.https) console.log('  (The https address shows a certificate warning the first time — that is expected for a home-made certificate.)');
  console.log('');

  // lets the control script (fretwise.sh) find this process
  const pidFile = path.join(app.dataDir, 'server.pid');
  fs.writeFileSync(pidFile, String(process.pid));
  const stop = () => {
    try { if (fs.readFileSync(pidFile, 'utf8').trim() === String(process.pid)) fs.unlinkSync(pidFile); } catch { /* already gone */ }
    for (const s of servers) { s.close(); s.closeAllConnections?.(); }
    setTimeout(() => process.exit(0), 200).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
