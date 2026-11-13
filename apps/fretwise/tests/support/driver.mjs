// Drives the real app inside the fake browser: boots it against a real server
// and answers exercises the way a person would, by clicking what is on screen.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installFakeDom } from './fake-dom.mjs';
import { createApp } from '../../server.js';

/**
 * A tiny fetch built on node:http.  Node's own fetch schedules its timeouts with
 * the global setTimeout, which the fake browser has replaced with a virtual clock.
 */
export function httpFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = init.body ?? null;
    const headers = { ...(init.headers || {}) };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: init.method || 'GET', headers, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: async () => text, json: async () => JSON.parse(text) });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * profiles: saved documents ({id, rev, state}) already on the server; storage: keys already in the browser;
 * serverDown: the server cannot be reached at all
 */
export async function bootApp({ microphone = false, secure = false, startDate, staticHost = false, serverDown = false, profiles = [], storage = {} } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fretwise-test-'));
  fs.mkdirSync(path.join(dataDir, 'profiles'), { recursive: true });
  for (const doc of profiles) fs.writeFileSync(path.join(dataDir, 'profiles', `${doc.id}.json`), JSON.stringify({ updatedAt: Date.now(), ...doc }));
  const app = createApp({ dataDir, log: false });
  const server = http.createServer(app.handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  app.ports.http = port;
  app.ports.https = 8421;

  const env = installFakeDom({ url: `http://127.0.0.1:${port}/`, microphone, secure, startDate });
  // staticHost: plain file hosting, where every /api address is a 404 page
  for (const [key, value] of Object.entries(storage)) env.window.localStorage.setItem(key, value);
  if (serverDown) env.fetchImpl = () => Promise.reject(new Error('connection refused'));
  else env.fetchImpl = staticHost ? async () => ({ ok: false, status: 404, text: async () => '<h1>Not Found</h1>', json: async () => JSON.parse('<h1>') }) : httpFetch;
  const root = env.document.createElement('div');
  root.setAttribute('id', 'app');
  env.document.body.append(root);

  await import('../../public/js/main.js');
  const { session } = await import('../../public/js/lesson.js');
  const { store } = await import('../../public/js/store.js');
  const theory = await import('../../public/js/theory.js');
  await env.clock.advance(50);

  const $ = (sel) => env.document.querySelector(sel);
  const $$ = (sel) => env.document.querySelectorAll(sel);
  const need = (sel) => { const el = $(sel); if (!el) throw new Error(`nothing on screen matches "${sel}"\n${screen()}`); return el; };
  const screen = () => env.document.body.textContent.replace(/\s+/g, ' ').slice(0, 400);
  const settle = (ms = 0) => env.clock.advance(ms);
  const click = async (target) => { const el = typeof target === 'string' ? need(target) : target; el.click(); await settle(); env.assertNoErrors(); };
  const go = async (to) => { env.window.location.hash = `#${to}`; await settle(20); env.assertNoErrors(); };
  const cell = (key) => { const n = theory.noteFromKey(key); return need(`.fb-cell[data-s="${n.s}"][data-f="${n.f}"]`); };

  /** carry out one exercise; `right` = answer correctly */
  async function answer(right = true) {
    const lesson = session.active;
    if (!lesson) throw new Error(`no exercise is running\n${screen()}`);
    const ex = lesson.current;
    const other = (list, good) => list.find((x) => x !== good);
    switch (ex.type) {
      case 'intro':
        if (lesson.input === 'mic') { // the guitar turns the cards: the card's own note, or any note
          for (let i = ex.at ?? 0; i < ex.cards.length; i++) {
            const card = ex.cards[i];
            await settle(900); // a new card waits a moment before it listens
            env.mic.play(card.note ? card.note.sounding : 64);
            await settle(450);
            env.mic.silence();
            await settle(250);
          }
          return ex;
        }
        for (let i = 0; i < ex.cards.length; i++) await click('.next');
        return ex;
      case 'name': // the Practice sprint
        await click(`.choice[data-id="${right ? ex.answer : other(ex.choices, ex.answer)}"]`);
        break;
      case 'find': {
        if (lesson.input === 'mic') {
          if (right) { env.mic.play(ex.note.sounding); await settle(400); }
          else { // two wrong notes show the hint; the exercise waits until the right one is played
            for (let i = 0; i < 2; i++) { env.mic.play(ex.note.sounding + 3); await settle(450); env.mic.silence(); await settle(250); }
            env.mic.play(ex.note.sounding);
            await settle(450);
          }
          break;
        }
        const wrong = ex.note.f === ex.frets[1] ? ex.note.f - 1 : ex.note.f + 1;
        await click(right ? cell(ex.note.key) : need(`.fb-cell[data-s="${ex.note.s}"][data-f="${Math.max(wrong, ex.frets[0] === 0 ? 0 : ex.frets[0])}"]`));
        break;
      }
      case 'phrase': {
        const wrongKeys = right ? [] : ex.where.slice(0, Math.floor(ex.where.length * 0.2) + 1);
        for (let i = 0; i < ex.where.length; i++) {
          const n = theory.noteFromKey(ex.where[i]);
          if (lesson.input === 'mic') {
            if (i < wrongKeys.length) { env.mic.play(n.sounding + 5); await settle(420); env.mic.silence(); await settle(220); }
            env.mic.play(n.sounding);
            await settle(420);
            env.mic.silence();
            await settle(220);
          } else {
            if (i < wrongKeys.length) await click(need(`.fb-cell[data-s="${n.s}"][data-f="${n.f === ex.frets[1] ? n.f - 1 : n.f + 1}"]`));
            await click(cell(ex.where[i]));
          }
        }
        break;
      }
      case 'rhythmTap': {
        if (lesson.input === 'mic') { // no tap: wait for "Go!", then pluck the rhythm (or sit it out)
          const spb = 60 / ex.bpm;
          const onsetBeats = theory.onsets(theory.parseMelody(ex.melody)).map((o) => o.t);
          for (let guard = 0; guard < 4000 && need('.count-in').textContent !== 'Go!'; guard++) await settle(10);
          const t0 = env.clock.now;
          if (right) for (const b of onsetBeats) { await settle(Math.max(0, t0 + b * spb * 1000 + 20 - env.clock.now)); env.mic.play(55); }
          for (let guard = 0; guard < 2000 && !lesson.waiting; guard++) await settle(100);
          env.mic.silence();
          break;
        }
        const beats = theory.onsets(theory.parseMelody(ex.melody));
        const spb = 60 / ex.bpm;
        const perBar = theory.measureBeats(ex.timeSig);
        const total = theory.parseMelody(ex.melody).flat().reduce((a, e) => a + e.dur.beats, 0);
        await click('.start');
        const t0 = env.clock.now + (0.35 + perBar * spb + 0.02) * 1000; // when beat 0 is heard
        const pad = need('.tap-pad');
        const times = right ? beats.map((o) => o.t * spb) : beats.slice(0, Math.max(0, beats.length - 2)).map((o) => o.t * spb + 0.3 * spb);
        for (const t of times) {
          await settle(Math.max(0, t0 + t * 1000 + 25 - env.clock.now)); // a human-ish 25 ms late
          env.fire(pad, 'pointerdown', { pointerId: 1 });
        }
        await settle(Math.max(0, t0 + (total * spb + 0.6) * 1000 - env.clock.now));
        env.assertNoErrors();
        break;
      }
      default: throw new Error(`driver cannot answer exercise type ${ex.type}`);
    }
    return ex;
  }

  /**
   * Play the lesson on screen to the end with the guitar alone: no click, no key.  Every banner has to move on
   * by itself.  mistakes = how many exercises to play wrongly on purpose; returns the types played.
   */
  async function guitarLesson({ mistakes = 0, log = [], gaps = [] } = {}) {
    let wrongLeft = mistakes;
    for (let guard = 0; session.active && guard < 200; guard++) {
      const lesson = session.active;
      const ex = lesson.current;
      const fail = wrongLeft > 0 && ex.type !== 'intro' && !ex.retry;
      if (fail) wrongLeft--;
      log.push(`${ex.type}${ex.retry ? '(retry)' : ''}${fail ? '!' : ''}`);
      await answer(!fail);
      const shownAt = env.clock.now;
      for (let t = 0; t < 30000 && session.active === lesson && lesson.current === ex; t += 50) await settle(50);
      if (ex.type !== 'intro') gaps.push({ type: ex.type, fail, ms: env.clock.now - shownAt });
      if (session.active === lesson && lesson.current === ex) throw new Error(`the lesson did not move on by itself after ${ex.type}`);
    }
    env.assertNoErrors();
    return log;
  }

  /** press Continue if the feedback banner is waiting */
  async function proceed() {
    await settle(10);
    if (session.active && session.active.waiting) await click('.continue');
  }

  /** play the lesson on screen to the end; mistakes = how many exercises to get wrong on purpose */
  async function playLesson({ mistakes = 0, log = [] } = {}) {
    let wrongLeft = mistakes;
    for (let guard = 0; session.active && guard < 200; guard++) {
      const ex = session.active.current;
      const fail = wrongLeft > 0 && ex.type !== 'intro' && !ex.retry;
      if (fail) wrongLeft--;
      log.push(`${ex.type}${ex.retry ? '(retry)' : ''}${fail ? '!' : ''}`);
      await answer(!fail);
      await proceed();
    }
    env.assertNoErrors();
    return log;
  }

  return {
    env, store, session, port, dataDir, $, $$, need, screen, settle, click, go, answer, proceed, playLesson, guitarLesson,
    async listProfiles() { return (await httpFetch(`http://127.0.0.1:${port}/api/profiles`)).json(); },
    async serverProfile(id = store.id) { return (await httpFetch(`http://127.0.0.1:${port}/api/profiles/${id}`)).json(); },
    async close() { await store.flush(); env.restore(); await new Promise((resolve) => server.close(resolve)); fs.rmSync(dataDir, { recursive: true, force: true }); },
  };
}

/** every class name present in the page right now */
export function classesOnScreen(env) {
  const found = new Set();
  const walk = (node) => {
    for (const c of node.childNodes) {
      if (c.nodeType !== 1) continue;
      for (const cls of (c.getAttribute('class') || '').split(/\s+/)) if (cls) found.add(cls);
      walk(c);
    }
  };
  walk(env.document);
  return found;
}
