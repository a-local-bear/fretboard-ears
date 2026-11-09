// localStorage wrappers. Every access is guarded: storage can be missing or throw.

import { normalizeProgress } from './progress.js';
import { OVER_OPTIONS, normalizeBacking } from './harmony.js';
import { addEntry, buildStats, validStats } from './stats.js';

const KEYS = { settings: 'fe-settings', progress: 'fe-progress', log: 'fe-log', stats: 'fe-stats', key: 'fe-key', backing: 'fe-backing' };
const LOG_MAX = 5000;
const DEFAULT_SETTINGS = { labels: 'solfege', ref: 'cadence', refWhen: 'each', resolve: 'on', over: 'off', sound: 'guitar', mic: false, adaptive: 'off' };

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
    ref: ['cadence', 'do', 'drone', 'none'].includes(s.ref) ? s.ref : DEFAULT_SETTINGS.ref,
    refWhen: ['each', 'level'].includes(s.refWhen) ? s.refWhen : DEFAULT_SETTINGS.refWhen,
    resolve: ['on', 'off'].includes(s.resolve) ? s.resolve : DEFAULT_SETTINGS.resolve,
    over: OVER_OPTIONS.includes(s.over) ? s.over : DEFAULT_SETTINGS.over,
    sound: ['guitar', 'synth'].includes(s.sound) ? s.sound : DEFAULT_SETTINGS.sound,
    mic: s.mic === true,
    adaptive: ['on', 'off'].includes(s.adaptive) ? s.adaptive : DEFAULT_SETTINGS.adaptive,
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

/** The last backing track: { key, mode, slots (roman numerals), tempo, bars }, always valid. */
export const loadBacking = () => normalizeBacking(read(KEYS.backing));
export const saveBacking = (b) => write(KEYS.backing, normalizeBacking(b));

export function loadLog() {
  const log = read(KEYS.log);
  return Array.isArray(log) ? log : [];
}

/** Lifetime aggregate. Built from the log the first time (or if it is unreadable). */
export function loadStats() {
  const s = read(KEYS.stats);
  if (validStats(s)) return s;
  const built = buildStats(loadLog());
  write(KEYS.stats, built);
  return built;
}

/** Append answer entries, keeping only the newest LOG_MAX; the stats aggregate keeps everything. */
export function appendLog(entries) {
  const stats = loadStats(); // before the append, so a first-time build doesn't count entries twice
  write(KEYS.stats, entries.reduce(addEntry, stats));
  const next = loadLog().concat(entries);
  write(KEYS.log, next.length > LOG_MAX ? next.slice(-LOG_MAX) : next);
}

/** Ask the browser not to evict our data. Safe to call repeatedly. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not supported */ }
}
