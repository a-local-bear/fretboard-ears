// localStorage wrappers. Every access is guarded: storage can be missing or throw.

import { emptyProgress } from './progress.js';

const KEYS = { settings: 'fe-settings', progress: 'fe-progress', log: 'fe-log' };
const LOG_MAX = 5000;
const DEFAULT_SETTINGS = { labels: 'solfege', ref: 'cadence', sound: 'guitar', mic: false };

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function loadSettings() {
  const s = read(KEYS.settings) || {};
  return {
    labels: ['solfege', 'letters', 'hidden'].includes(s.labels) ? s.labels : DEFAULT_SETTINGS.labels,
    ref: ['cadence', 'do', 'none'].includes(s.ref) ? s.ref : DEFAULT_SETTINGS.ref,
    sound: ['guitar', 'synth'].includes(s.sound) ? s.sound : DEFAULT_SETTINGS.sound,
    mic: s.mic === true,
  };
}
export const saveSettings = (s) => write(KEYS.settings, s);

export function loadProgress() {
  const p = read(KEYS.progress);
  if (!p || typeof p !== 'object') return emptyProgress();
  const best = {};
  for (const [k, v] of Object.entries(p.best || {})) if (Number.isInteger(v) && v >= 0 && v <= 10) best[k] = v;
  return { best };
}
export const saveProgress = (p) => write(KEYS.progress, p);

/** Append answer entries, keeping only the newest LOG_MAX. */
export function appendLog(entries) {
  const log = read(KEYS.log);
  const next = (Array.isArray(log) ? log : []).concat(entries);
  write(KEYS.log, next.length > LOG_MAX ? next.slice(-LOG_MAX) : next);
}

/** Ask the browser not to evict our data. Safe to call repeatedly. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not supported */ }
}
