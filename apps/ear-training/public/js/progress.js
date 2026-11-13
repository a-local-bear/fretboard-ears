// Pure progress rules. progress = { best: { "<levelId>": 0..10 } }
// Level ids come from data.js (LEVELS). Every level is open: this is a practice app, so there's no unlocking.

import { LEVELS, ROUNDS, PASS_SCORE } from './data.js';

export const emptyProgress = () => ({ best: {} });

/** A score worth celebrating (plays the arpeggio, marks the level done). */
export const isPassed = (score) => score >= PASS_SCORE;

/**
 * Before the single ladder, every level existed once per chapter (one string, three patterns, the
 * whole neck) under the id "<chapter>-<suffix>". The ear work was the same in each, so an old score
 * counts for the level that now covers it. Suffixes with no counterpart are not listed.
 */
const LEGACY = {
  t0: 'major-t0', t1: 'major-t1', t2: 'major-t2', 3: 'major-3', 4: 'major-4', 5: 'major-5', 6: 'major-6',
  'major-oct': 'major-6', 'rk-major': 'major-rk', 'major-2oct': 'major-2oct',
  'pairs-oct': 'major-dict-2', 'pairs-rk': 'major-dict-2', 'dict-2': 'major-dict-2',
  'dict-4': 'major-dict-4', 'dict-5': 'major-dict-4', 'dict-rk': 'major-dict-4',
  'majorChrom-1st': 'majorChrom-1st', 'majorChrom-2nd': 'majorChrom-2nd', 'majorChrom-oct': 'majorChrom-oct', 'majorChrom-2oct': 'majorChrom-2oct',
  'minor-oct': 'minor-oct', 'rk-minor': 'minor-oct', 'minor-2oct': 'minor-2oct',
  'pairs-minor': 'minor-dict-2', 'dict-minor': 'minor-dict-4',
  'minorChrom-1st': 'minorChrom-1st', 'minorChrom-2nd': 'minorChrom-2nd', 'minorChrom-oct': 'minorChrom-oct', 'minorChrom-2oct': 'minorChrom-2oct',
};
const OLD_ID = /^(one|pA|pB|pC|neck)-(.+)$/;

/** The level that replaced an old per-chapter level id, or null (also for an id of today's ladder). */
export function legacyLevelId(id) {
  const m = OLD_ID.exec(String(id));
  return m ? LEGACY[m[2]] ?? null : null;
}

/**
 * Clean up whatever was stored. Every valid score is kept, whatever its key, and each score from
 * before the single ladder also counts for the level that replaced it (the best one wins).
 */
export function normalizeProgress(raw) {
  if (!raw || typeof raw !== 'object') return emptyProgress();
  const best = {};
  for (const [k, v] of Object.entries(raw.best || {})) if (Number.isInteger(v) && v >= 0 && v <= ROUNDS) best[k] = v;
  const carry = (id, score) => { if (score > (best[id] ?? -1)) best[id] = score; };
  for (const [k, v] of Object.entries(best)) {
    const id = legacyLevelId(k);
    if (id) carry(id, v);
    // The first three levels were once other note sets; a passed "first half" stands in for them, so
    // nobody is sent back to the start.
    if (/^(one|pA|pB|pC)-3$/.test(k) && isPassed(v)) for (const t of ['major-t0', 'major-t1', 'major-t2']) carry(t, v);
  }
  return { best };
}

export const bestScore = (progress, levelId) => progress.best[levelId] ?? null;

/** Record a finished run of a level; returns { progress, newBest }. Does not mutate the input. */
export function recordBest(progress, levelId, score) {
  const prev = progress.best[levelId];
  const newBest = prev == null || score > prev;
  const best = newBest ? { ...progress.best, [levelId]: score } : progress.best;
  return { progress: { ...progress, best }, newBest };
}

/** The level after this one on the ladder; null at the very end. */
export const levelAfter = (level) => LEVELS[level.idx + 1] ?? null;
