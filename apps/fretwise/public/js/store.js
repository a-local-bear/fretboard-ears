// The player's saved progress.  The server keeps one JSON document per player
// so every device on the network sees the same progress; a copy is also kept in
// this browser so nothing is lost if the server is briefly unreachable.
//
// Served as plain files (GitHub Pages) there is no server at all: the first
// request comes back as a 404 page instead of JSON.  From then on the copies in
// this browser are the players, and nothing is sent anywhere.

import { newState, normalize, mergeStates } from './progress.js';
import { prefs } from './prefs.js';

const CACHE = 'fretwise.save.';
let state = null;
let id = null;
let rev = 0;
let dirty = false;
let saving = false;
let timer = null;
const listeners = new Set();
const emit = (why) => { for (const fn of [...listeners]) fn(state, why); };

async function request(method, path, body) {
  if (store.standalone) return local(method, path, body);
  // relative, so the app works from any folder, not only the site root
  const res = await fetch('api' + path, {
    method, cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (data === null && res.status === 404) {
    // the Fretwise server answers every /api address with JSON; this is static hosting
    store.standalone = true;
    prefs.set('standalone', true);
    return local(method, path, body);
  }
  return { ok: res.ok, status: res.status, data };
}

/** The server's API, answered from this browser's storage: what request() does on static hosting. */
function local(method, path, body) {
  const reply = (status, data = null) => ({ ok: status < 300, status, data });
  const [, resource, pid] = path.split('/');
  if (resource !== 'profiles') return reply(404);
  if (!pid) {
    if (method === 'POST') {
      const slug = String(body.state.name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'player';
      const made = { id: `${slug}-${Math.random().toString(16).slice(2, 8).padEnd(6, '0')}`, rev: 1, state: body.state };
      try { localStorage.setItem(CACHE + made.id, JSON.stringify({ rev: 1, dirty: false, state: made.state })); } catch { /* storage full or blocked */ }
      return reply(201, made);
    }
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const saved = key.startsWith(CACHE) ? readCache(key.slice(CACHE.length)) : null;
      if (saved?.state) list.push({ id: key.slice(CACHE.length), rev: saved.rev, name: saved.state.name, avatar: saved.state.avatar ?? null, xp: Number(saved.state.xp) || 0, streak: Number(saved.state.streak?.count) || 0 });
    }
    return reply(200, list.sort((a, b) => String(a.name).localeCompare(String(b.name))));
  }
  const saved = readCache(pid);
  if (!saved) return reply(404);
  if (method === 'DELETE') { dropCache(pid); return reply(200); }
  // PUT: save() writes the copy itself once it has the new revision
  return reply(200, { id: pid, rev: method === 'PUT' ? saved.rev + 1 : saved.rev, state: method === 'PUT' ? body.state : saved.state });
}

const readCache = (pid) => { try { return JSON.parse(localStorage.getItem(CACHE + pid) || 'null'); } catch { return null; } };
const writeCache = () => { if (id) try { localStorage.setItem(CACHE + id, JSON.stringify({ rev, dirty, state })); } catch { /* storage full or blocked */ } };
const dropCache = (pid) => { try { localStorage.removeItem(CACHE + pid); } catch { /* ignore */ } };

function adopt(pid, revision, raw) {
  id = pid;
  rev = revision;
  state = normalize(raw);
  dirty = false;
  prefs.set('profile', pid);
  writeCache();
  emit('open');
}

function schedule(ms) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; save(); }, ms);
}

async function save() {
  if (saving || !dirty || !id) return;
  saving = true;
  dirty = false;
  const pid = id;
  try {
    const r = await request('PUT', `/profiles/${pid}`, { rev, state });
    if (pid !== id) { /* the player was switched while saving; nothing to update */ }
    else if (r.ok) { rev = r.data.rev; store.online = true; }
    else if (r.status === 409) {
      // another device saved first: fold both copies together and try again
      state = mergeStates(state, r.data.state);
      rev = r.data.rev;
      dirty = true;
      store.online = true;
      emit('merge');
    } else if (r.status === 404) {
      // deleted on another device while we were playing: keep the progress under a new id
      const made = await request('POST', '/profiles', { state });
      if (made.ok) { dropCache(pid); id = made.data.id; rev = made.data.rev; prefs.set('profile', id); }
      else dirty = true;
    } else { dirty = true; store.online = false; }
  } catch {
    dirty = true;
    store.online = false;
  }
  saving = false;
  writeCache();
  if (dirty && id) schedule(store.online ? 150 : 8000);
}

export const store = {
  /** false while the server cannot be reached (progress is kept locally meanwhile) */
  online: true,
  /** true on static hosting: there is no server, players and progress live in this browser */
  standalone: Boolean(prefs.get('standalone')),
  /** server facts: addresses, ports, whether this page is secure */
  info: null,
  get state() { return state; },
  get id() { return id; },
  get unsaved() { return dirty || saving; },

  /** fn(state, reason) on every change; returns an unsubscribe function */
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  async loadInfo() {
    try { const r = await request('GET', '/info'); if (r.ok) store.info = r.data; } catch { /* offline */ }
    return store.info;
  },

  async profiles() {
    const r = await request('GET', '/profiles');
    if (!r.ok) throw new Error('could not load the players');
    store.online = true;
    return r.data;
  },

  async create(name, tone) {
    const r = await request('POST', '/profiles', { state: newState(name, tone) });
    if (!r.ok) throw new Error(r.data?.error || 'could not create the player');
    adopt(r.data.id, r.data.rev, r.data.state);
    return state;
  },

  /** Open a player.  Returns false if that player no longer exists. */
  async open(pid) {
    const cached = readCache(pid);
    let r = null;
    try { r = await request('GET', `/profiles/${pid}`); } catch { r = null; }
    if (r && r.ok) {
      store.online = true;
      const unsynced = cached && cached.dirty;
      adopt(pid, r.data.rev, unsynced ? mergeStates(cached.state, r.data.state) : r.data.state);
      if (unsynced) store.touch(); // push the work that never reached the server last time
      return true;
    }
    if (r && r.status === 404) { dropCache(pid); if (prefs.get('profile') === pid) prefs.set('profile', null); return false; }
    if (cached) {
      store.online = false;
      adopt(pid, cached.rev, cached.state);
      dirty = Boolean(cached.dirty);
      if (dirty) schedule(8000);
      return true;
    }
    throw new Error('the server cannot be reached');
  },

  /** reopen the player this device used last */
  async resume() {
    const pid = prefs.get('profile');
    if (!pid) return false;
    try { return await store.open(pid); } catch { return false; }
  },

  /** switch player: forget who is playing on this device */
  async close() {
    await store.flush();
    state = null;
    id = null;
    dirty = false;
    prefs.set('profile', null);
    emit('close');
  },

  async remove(pid) {
    const r = await request('DELETE', `/profiles/${pid}`);
    dropCache(pid);
    if (pid === id) { state = null; id = null; dirty = false; prefs.set('profile', null); emit('close'); }
    return r.ok;
  },

  /** change the state (fn mutates it) and save soon */
  update(fn) {
    if (!state) return;
    if (fn) fn(state);
    store.touch();
  },
  touch() {
    if (!state) return;
    dirty = true;
    writeCache();
    emit('change');
    schedule(400);
  },
  /** save right now */
  async flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    await save();
  },
  /** pick up progress made on another device (skipped while this device has unsaved work) */
  async refresh() {
    if (!id || dirty || saving) return false;
    try {
      const r = await request('GET', `/profiles/${id}`);
      if (!r.ok) return false;
      store.online = true;
      if (r.data.rev !== rev && !dirty && !saving) {
        state = normalize(r.data.state);
        rev = r.data.rev;
        writeCache();
        emit('refresh');
        return true;
      }
    } catch { store.online = false; }
    return false;
  },
};
