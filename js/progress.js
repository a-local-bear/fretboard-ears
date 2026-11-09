// Pure progression rules. progress = { best: { "<chapterId>-<level>": 0..10 }, unlockAll: bool }

import { CHAPTERS, LEVELS_PER_CHAPTER, PASS_SCORE } from './data.js';

export const levelKey = (chapterId, level) => `${chapterId}-${level}`;
export const emptyProgress = () => ({ best: {}, unlockAll: false });

export const isPassed = (score) => score >= PASS_SCORE;
export const bestScore = (progress, chapterId, level) => progress.best[levelKey(chapterId, level)] ?? null;
export const levelPassed = (progress, chapterId, level) => isPassed(bestScore(progress, chapterId, level) ?? 0);

export function chapterUnlocked(progress, chapterId) {
  if (progress.unlockAll) return true;
  const i = CHAPTERS.findIndex((c) => c.id === chapterId);
  if (i <= 0) return i === 0;
  return levelPassed(progress, CHAPTERS[i - 1].id, LEVELS_PER_CHAPTER - 1);
}

export function isUnlocked(progress, chapterId, level) {
  if (progress.unlockAll) return true;
  if (!chapterUnlocked(progress, chapterId)) return false;
  return level === 0 || levelPassed(progress, chapterId, level - 1);
}

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

export function passedCount(progress) {
  let n = 0;
  for (const c of CHAPTERS) for (let l = 0; l < LEVELS_PER_CHAPTER; l++) if (levelPassed(progress, c.id, l)) n++;
  return n;
}
