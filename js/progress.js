// Pure progress rules. progress = { best: { "<chapterId>-<level>": 0..10 } }
// Every level is open: this is a practice app, so there's no unlocking.

import { CHAPTERS, LEVELS_PER_CHAPTER, PASS_SCORE } from './data.js';

export const levelKey = (chapterId, level) => `${chapterId}-${level}`;
export const emptyProgress = () => ({ best: {} });

/** A score worth celebrating (plays the arpeggio, shows the level as solid). */
export const isPassed = (score) => score >= PASS_SCORE;
export const bestScore = (progress, chapterId, level) => progress.best[levelKey(chapterId, level)] ?? null;

/** Record a finished run; returns { progress, newBest }. Does not mutate the input. */
export function recordScore(progress, chapterId, level, score) {
  const key = levelKey(chapterId, level);
  const prev = progress.best[key];
  const newBest = prev == null || score > prev;
  const best = newBest ? { ...progress.best, [key]: score } : progress.best;
  return { progress: { ...progress, best }, newBest };
}

/** The level after this one, crossing into the next chapter; null at the very end. */
export function nextLevel(chapterId, level) {
  if (level + 1 < LEVELS_PER_CHAPTER) return { chapterId, level: level + 1 };
  const i = CHAPTERS.findIndex((c) => c.id === chapterId);
  return i + 1 < CHAPTERS.length ? { chapterId: CHAPTERS[i + 1].id, level: 0 } : null;
}

/** How many levels of a chapter have been played at least once. */
export function playedCount(progress, chapterId) {
  let n = 0;
  for (let l = 0; l < LEVELS_PER_CHAPTER; l++) if (bestScore(progress, chapterId, l) != null) n++;
  return n;
}
