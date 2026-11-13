// App state: lesson progress + songs live on the server (data/state.json) so
// every device on the network shares them.
//
// · A localStorage copy keeps things working if the server is unreachable;
//   anything saved while offline is queued and pushed when it comes back.
// · Every server write bumps a revision number.  Open tabs poll it, so a
//   change made on one device shows up on the others within seconds.
// · If two devices edit the same song at once, nothing is thrown away: the
//   version that reached the server first keeps the song, and the other
//   device's edits are saved as "<title> (copy)".
// · Served as plain files (e.g. GitHub Pages) there is no API at all: the
//   first request comes back 404, and from then on everything stays in this
//   browser's storage without trying the network again.

import { debounce, uid } from './dom.js';

const STATE_KEY = 'woozy.state.v1';
const PREFS_KEY = 'woozy.prefs.v1';
const POLL_MS = 10000;

export const store = {
  progress: {}, // lessonId → { done, quiz }
  songs: {}, // songId → song
  rev: 0, // the last server revision this tab has seen
  online: false,
  standalone: false, // no server behind these files: browser storage only
  prefs: { theme: 'auto', volume: 0.8, wobble: 0.45, reverb: 0.35, tone: 0.5 },
};

let pending = { songs: [], deletes: [], progress: [] };
const listeners = new Set();
const inflight = new Map(); // songId → promise of the save in progress
const again = new Set(); // songs edited while a save was in progress
const songPushers = new Map(); // songId → debounced save

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = (what, detail) => {
  for (const fn of [...listeners]) fn(what, detail);
};

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function saveLocal() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ progress: store.progress, songs: store.songs, pending }));
  } catch { /* private mode / storage full: the server copy still works */ }
}

async function api(method, path, body) {
  if (store.standalone) throw new Error('no server');
  // Relative, so the app works from any folder, not only the site root.
  const res = await fetch(path.replace(/^\//, ''), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 404 && path === '/api/state' && !data) {
    // Static hosting: no server to talk to. Stop trying.
    store.standalone = true;
    pending = { songs: [], deletes: [], progress: [] };
    emit('online');
    throw new Error('no server');
  }
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${path} → ${res.status}`);
  return { status: res.status, data: data || {} };
}

const queue = (list, id) => {
  if (store.standalone) return; // nothing to sync to
  if (!list.includes(id)) list.push(id);
};
const unqueue = (list, id) => {
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
};
const hasPending = () => pending.songs.length + pending.deletes.length + pending.progress.length > 0;

// A song's content, ignoring bookkeeping fields.
const contentOf = ({ rev, updatedAt, ...rest }) => JSON.stringify(rest);

function setOnline(value) {
  if (store.standalone) return;
  if (store.online !== value) {
    store.online = value;
    emit('online');
  }
}

// Our own write came back as revision `rev`.  If that is exactly one more
// than we knew about, nobody else wrote in between.
function sawRev(rev) {
  if (typeof rev !== 'number') return;
  if (rev === store.rev + 1) store.rev = rev;
}

// The server holds a version of this song that we did not base our edits on.
// Theirs keeps the song's id; ours lives on as a copy.
function resolveConflict(mine, theirs) {
  const id = theirs.id;
  unqueue(pending.songs, id);
  again.delete(id);
  store.songs[id] = theirs;
  if (contentOf(mine) !== contentOf(theirs)) {
    mine.id = uid();
    mine.title = `${mine.title} (copy)`;
    mine.updatedAt = Date.now();
    delete mine.rev;
    store.songs[mine.id] = mine;
    queue(pending.songs, mine.id);
    emit('conflict', { title: theirs.title, copy: mine.title });
    pushSong(mine.id);
  }
  saveLocal();
  emit('songs');
}

async function putSong(id) {
  const song = store.songs[id];
  if (!song) return;
  const sent = contentOf(song);
  try {
    const { status, data } = await api('PUT', `/api/songs/${id}`, song);
    setOnline(true);
    if (status === 409 && data.song) {
      resolveConflict(song, data.song);
      return;
    }
    song.rev = data.rev;
    sawRev(data.rev);
    if (contentOf(song) === sent) unqueue(pending.songs, id); // nothing changed while it was in the air
  } catch {
    queue(pending.songs, id);
    setOnline(false);
  }
  saveLocal();
}

// Saves of one song never overlap: an edit made mid-save is sent afterwards.
function pushSong(id) {
  if (inflight.has(id)) {
    again.add(id);
    return inflight.get(id);
  }
  const run = (async () => {
    do {
      again.delete(id);
      await putSong(id);
    } while (again.has(id) && store.songs[id] && store.online);
  })().finally(() => inflight.delete(id));
  inflight.set(id, run);
  return run;
}

async function pushDelete(id) {
  try {
    const { data } = await api('DELETE', `/api/songs/${id}`);
    unqueue(pending.deletes, id);
    sawRev(data.rev);
    setOnline(true);
  } catch {
    queue(pending.deletes, id);
    setOnline(false);
  }
  saveLocal();
}

async function pushProgress(id) {
  try {
    const { data } = await api('PUT', `/api/progress/${id}`, store.progress[id]);
    unqueue(pending.progress, id);
    sawRev(data.rev);
    setOnline(true);
  } catch {
    queue(pending.progress, id);
    setOnline(false);
  }
  saveLocal();
}

function schedulePush(id) {
  if (!songPushers.has(id)) songPushers.set(id, debounce(() => pushSong(id), 700));
  songPushers.get(id)();
}

// Send any debounced saves right now (the tab is being hidden or closed).
export function flushSaves() {
  for (const [id, fn] of songPushers) {
    if (store.songs[id] && pending.songs.includes(id)) fn.flush();
  }
}

// Pull the server's copy, then replay anything that was saved offline.
let syncing = null;
export function sync() {
  if (!syncing) syncing = runSync().finally(() => { syncing = null; });
  return syncing;
}

async function runSync() {
  if (inflight.size) await Promise.allSettled([...inflight.values()]);
  let remote;
  try {
    remote = (await api('GET', '/api/state')).data;
  } catch {
    setOnline(false);
    return false;
  }
  const before = JSON.stringify([store.progress, store.songs]);
  const progress = { ...(remote.progress || {}) };
  const songs = { ...(remote.songs || {}) };
  for (const id of pending.progress) if (store.progress[id]) progress[id] = store.progress[id];

  const conflicts = [];
  for (const id of [...pending.songs]) {
    const mine = store.songs[id];
    if (!mine) {
      unqueue(pending.songs, id);
      continue;
    }
    const theirs = songs[id];
    if (theirs && theirs.rev !== mine.rev) {
      conflicts.push([mine, theirs]); // changed elsewhere while we had unsaved edits
    } else {
      if (!theirs) delete mine.rev; // deleted elsewhere: our edits bring it back as new
      songs[id] = mine;
    }
  }
  for (const id of pending.deletes) delete songs[id];

  store.progress = progress;
  store.songs = songs;
  store.rev = Number(remote.rev) || 0;
  setOnline(true);
  for (const [mine, theirs] of conflicts) resolveConflict(mine, theirs);
  saveLocal();

  await Promise.all([
    ...pending.progress.slice().map(pushProgress),
    ...pending.songs.slice().map(pushSong),
    ...pending.deletes.slice().map(pushDelete),
  ]);
  if (JSON.stringify([store.progress, store.songs]) !== before) emit('sync');
  return true;
}

// Ask the server whether anything changed since we last looked.
async function poll() {
  if (store.standalone || document.visibilityState !== 'visible' || syncing) return;
  try {
    const { data } = await api('GET', '/api/rev');
    setOnline(true);
    if (data.rev !== store.rev || hasPending()) await sync();
  } catch {
    setOnline(false);
  }
}

export async function initStore() {
  const local = readJson(STATE_KEY);
  if (local) {
    store.progress = local.progress || {};
    store.songs = local.songs || {};
    pending = { songs: [], deletes: [], progress: [], ...(local.pending || {}) };
  }
  Object.assign(store.prefs, readJson(PREFS_KEY) || {});
  await sync();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSaves();
    else sync();
  });
  window.addEventListener('pagehide', flushSaves);
  window.addEventListener('focus', poll);
  setInterval(poll, POLL_MS);
}

export function setPref(name, value) {
  store.prefs[name] = value;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(store.prefs));
  } catch { /* ignore */ }
  emit('prefs');
}

export function setProgress(id, patch) {
  store.progress[id] = { done: false, quiz: false, ...(store.progress[id] || {}), ...patch };
  queue(pending.progress, id);
  saveLocal();
  emit('progress');
  pushProgress(id);
}

export const isDone = (id) => !!store.progress[id]?.done;

export function saveSong(song) {
  song.updatedAt = Date.now();
  store.songs[song.id] = song;
  queue(pending.songs, song.id);
  saveLocal();
  schedulePush(song.id);
}

export function deleteSong(id) {
  delete store.songs[id];
  unqueue(pending.songs, id);
  songPushers.delete(id);
  queue(pending.deletes, id);
  saveLocal();
  emit('songs');
  pushDelete(id);
}

export const songList = () => Object.values(store.songs).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
