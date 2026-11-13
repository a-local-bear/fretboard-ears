// The saved progress.  There is one anonymous progress document: nobody picks a
// name or a player.  start() finds it (this device's own, else the one with the
// most XP, else a fresh one).  The server keeps it as a JSON file so every
// device on the network shares the same progress; a copy is also kept in this
// browser so nothing is lost if the server is briefly unreachable.
//
// Served as plain files (GitHub Pages) there is no server at all: the first
// request comes back as a 404 page instead of JSON.  From then on the copy in
// this browser is the progress, and nothing is sent anywhere.

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
      const made = { id: `player-${Math.random().toString(16).slice(2, 8).padEnd(6, '0')}`, rev: 1, state: body.state };
      try { localStorage.setItem(CACHE + made.id, JSON.stringify({ rev: 1, dirty: false, state: made.state })); } catch { /* storage full or blocked */ }
      return reply(201, made);
    }
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const saved = key.startsWith(CACHE) ? readCache(key.slice(CACHE.length)) : null;
      if (saved?.state) list.push({ id: key.slice(CACHE.length), rev: saved.rev, xp: Number(saved.state.xp) || 0 });
    }
    return reply(200, list);
  }
  const saved = readCache(pid);
  if (!saved) return reply(404);
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
    if (r.ok) { rev = r.data.rev; store.online = true; }
    else if (r.status === 409) {
      // another device saved first: fold both copies together and try again
      state = mergeStates(state, r.data.state);
      rev = r.data.rev;
      dirty = true;
      store.online = true;
      emit('merge');
    } else if (r.status === 404) {
      // not on the server (removed there, or made while it was out of reach): keep the progress under a new id
      const made = await request('POST', '/profiles', { state });
      if (made.ok) { dropCache(pid); id = made.data.id; rev = made.data.rev; prefs.set('profile', id); store.online = true; }
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

async function listProfiles() {
  const r = await request('GET', '/profiles');
  if (!r.ok) throw new Error('could not load the saved progress');
  store.online = true;
  return r.data;
}

async function create() {
  let r = null;
  try { r = await request('POST', '/profiles', { state: newState() }); } catch { r = null; }
  if (r && r.ok) { store.online = true; adopt(r.data.id, r.data.rev, r.data.state); return; }
  // the server is out of reach: work here; the first save that finds no copy on the server creates one
  store.online = false;
  adopt(`player-${Math.random().toString(16).slice(2, 8).padEnd(6, '0')}`, 0, newState());
  dirty = true;
  writeCache();
  schedule(8000);
}

/** Open a saved document.  Returns false if it no longer exists. */
async function open(pid) {
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
  if (r && r.status === 404) {
    if (cached && cached.dirty) { // made while the server was out of reach: keep it, the save will create it there
      store.online = true;
      adopt(pid, cached.rev, cached.state);
      store.touch();
      return true;
    }
    dropCache(pid);
    if (prefs.get('profile') === pid) prefs.set('profile', null);
    return false;
  }
  if (cached) {
    store.online = false;
    adopt(pid, cached.rev, cached.state);
    dirty = Boolean(cached.dirty);
    if (dirty) schedule(8000);
    return true;
  }
  throw new Error('the server cannot be reached');
}

export const store = {
  /** false while the server cannot be reached (progress is kept locally meanwhile) */
  online: true,
  /** true on static hosting: there is no server, progress lives in this browser */
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

  /**
   * Get the progress document, silently, and never fail:
   * this device's own, else the one with the most XP, else a fresh one.
   * With the server out of reach and nothing cached, a fresh one is kept here and
   * sent to the server by the normal save once it answers.
   */
  async start() {
    const mine = prefs.get('profile');
    if (mine) { try { if (await open(mine)) return state; } catch { /* look further */ } }
    let list = [];
    try { list = await listProfiles(); } catch {
      list = local('GET', '/profiles').data; // server out of reach: whatever this browser has
      store.online = false;
    }
    list.sort((a, b) => b.xp - a.xp);
    for (const p of list) { try { if (await open(p.id)) return state; } catch { /* try the next */ } }
    await create();
    return state;
  },

  /** start the stats over: a fresh state in the same document (settings are kept) */
  reset() {
    if (!state) return Promise.resolve();
    const fresh = newState();
    fresh.settings = { ...state.settings };
    state = fresh;
    store.touch();
    return store.flush();
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
