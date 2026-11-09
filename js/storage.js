// localStorage wrappers. Every access is guarded: storage can be missing or throw.

import { normalizeProgress } from './progress.js';

const KEYS = { settings: 'fe-settings', progress: 'fe-progress', log: 'fe-log', key: 'fe-key' };
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

export const loadProgress = () => normalizeProgress(read(KEYS.progress));
export const saveProgress = (p) => write(KEYS.progress, p);

/** The tonic (0 = C … 11 = B) the fixed-key levels are played in. */
export function loadKey() {
  const k = read(KEYS.key);
  return Number.isInteger(k) && k >= 0 && k < 12 ? k : 0;
}
export const saveKey = (k) => write(KEYS.key, k);

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
