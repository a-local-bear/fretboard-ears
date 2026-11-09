// Pure progress rules. progress = { best: { "<levelId>": 0..10 } }
// Level ids come from data.js (levelsFor). The original build-up levels keep "<chapterId>-<3..6>", the first three are "<chapterId>-t0..t2".
// Every level is open: this is a practice app, so there's no unlocking.

import { CHAPTERS, ROUNDS, PASS_SCORE, levelsFor } from './data.js';

/** Storage key of level number `level` (index into levelsFor) of a chapter: the level's id. */
export const levelKey = (chapterId, level) => levelsFor(chapterId)[level]?.id ?? `${chapterId}-${level}`;
export const emptyProgress = () => ({ best: {} });

/**
 * Clean up whatever was stored: keeps every valid score, whatever its key, so scores saved before
 * levels were added ("one-0" …) and scores for levels this version does not know both survive.
 */
export function normalizeProgress(raw) {
  if (!raw || typeof raw !== 'object') return emptyProgress();
  const best = {};
  for (const [k, v] of Object.entries(raw.best || {})) if (Number.isInteger(v) && v >= 0 && v <= ROUNDS) best[k] = v;
  // Build-up levels 0-2 became Do·Sol, Do·Mi·Sol, Do·Re·Mi·Sol (ids t0-t2): the old scores are for
  // other note sets. A passed Do–Sol (id -3) carries over so the player is not sent back to the start.
  for (const c of CHAPTERS.slice(0, 4)) {
    for (let l = 0; l < 3; l++) delete best[`${c.id}-${l}`];
    if (isPassed(best[`${c.id}-3`] ?? -1)) for (let l = 0; l < 3; l++) best[`${c.id}-t${l}`] = best[`${c.id}-3`];
  }
  return { best };
}

/** A score worth celebrating (plays the arpeggio, shows the level as solid). */
export const isPassed = (score) => score >= PASS_SCORE;
export const bestScore = (progress, chapterId, level) => progress.best[levelKey(chapterId, level)] ?? null;

/** Record a finished run; returns { progress, newBest }. Does not mutate the input. */
export const recordScore = (progress, chapterId, level, score) => recordBest(progress, levelKey(chapterId, level), score);

/** Record a finished run under any id (a level id or a drill id); returns { progress, newBest }. */
export function recordBest(progress, key, score) {
  const prev = progress.best[key];
  const newBest = prev == null || score > prev;
  const best = newBest ? { ...progress.best, [key]: score } : progress.best;
  return { progress: { ...progress, best }, newBest };
}

/** The level after this one, crossing into the next chapter; null at the very end. */
export function nextLevel(chapterId, level) {
  if (level + 1 < levelsFor(chapterId).length) return { chapterId, level: level + 1 };
  const i = CHAPTERS.findIndex((c) => c.id === chapterId);
  return i + 1 < CHAPTERS.length ? { chapterId: CHAPTERS[i + 1].id, level: 0 } : null;
}

/** How many levels of a chapter have been played at least once. */
export function playedCount(progress, chapterId) {
  return levelsFor(chapterId).filter((l) => progress.best[l.id] != null).length;
}
