// Daily practice session: a pure planner that turns progress + stats into four blocks of ten rounds.
//
// Rules (planSession):
//  - A brand-new player (no stats, no scores) gets the first C-major levels: Do · Sol, then Do · Mi · Sol,
//    then Do · Re · Mi · Sol, and a last adaptive block on Do · Mi · Sol.
//  - Block 1, WARM-UP: the most-played fixed C-major single-note level (log entries per level id, ties go
//    to the earlier level); with no log, the first major level not yet passed. Always in C major.
//  - Block 2, WEAK NOTES: adaptive drilling on the narrowest played, non-chromatic fixed-key level that
//    contains the player's two weakest notes (weakest first, falling back to the weakest one); if no note
//    is weak enough, the "frontier" (first major level not yet passed).
//  - Block 3, PAIRS / DICTATION: the first unpassed step of the ladder pairs-1st, pairs-oct, dictation 2…5
//    (gated: pairs-1st needs a passed major level whose notes include Mi, the rest a passed whole-octave level), else
//    the hardest dictation. When the gate is not met, the frontier level ("NEW NOTE") instead.
//  - Block 4, RANDOM KEY: only if a whole-octave C-major level (family major, Do → Do') was passed: the
//    first unpassed of random-key major/minor, else one of them by the rng. Otherwise another WEAK NOTES
//    block, aimed at the third and fourth weakest notes.
// Blocks: { kind, label, chapterId, level (index), levelId, adaptive, keyPc (0 = C major, null = the
// player's chosen key; random-key levels draw their own) }.

import { CHAPTERS, PASS_SCORE, levelsFor, buildContext } from './data.js';
import { weakNotes, foldNote } from './adaptive.js';

export const BLOCKS = 4;

const passed = (best, id) => (best[id] ?? -1) >= PASS_SCORE;
const suffix = (l) => l.id.slice(l.chapterId.length + 1);
const allLevels = () => CHAPTERS.flatMap((c) => levelsFor(c.id));
const isCMajorSingle = (l) => l.family === 'major' && !l.random && !(l.len > 1);
const wholeOctave = (l) => l.family === 'major' && l.from === 0 && l.to === 12 && !l.random;

/** Has a level with this id suffix been passed in any chapter? (the pattern chapter doesn't change the ear work) */
const passedSuffix = (progress, sfx) => allLevels().some((l) => suffix(l) === sfx && passed(progress, l.id));

/** Played-count per level id from the log. */
function playCounts(log) {
  const m = new Map();
  for (const e of log || []) if (e && typeof e.lid === 'string') m.set(e.lid, (m.get(e.lid) || 0) + 1);
  return m;
}

const makeBlock = (kind, label, level, { adaptive = false, keyPc = null } = {}) => ({
  kind, label, chapterId: level.chapterId, level: level.idx, levelId: level.id, adaptive, keyPc,
});

/** Folded note set of a level in C (or its own mode), for matching weak notes. */
function poolOf(level) {
  return new Set(buildContext(level.chapterId, level, 0, level.mode ?? 'major').pool.map(foldNote));
}

/**
 * Plan a session. `input` = { progress, stats, log }; `opts.rng` picks between equal random-key levels.
 * Returns an array of BLOCKS blocks. Pure.
 */
export function planSession({ progress, stats, log = [] } = {}, { rng = Math.random } = {}) {
  const best = progress?.best || {};
  const singles = allLevels().filter(isCMajorSingle); // chapter order, level order
  const first = singles[0];
  const newPlayer = !(stats?.notes > 0) && !Object.keys(best).length;
  if (newPlayer) {
    const lv = levelsFor(first.chapterId).filter(isCMajorSingle);
    return [
      makeBlock('warmup', 'WARM-UP', lv[0], { keyPc: 0 }),
      makeBlock('new', 'NEW NOTE', lv[1]),
      makeBlock('new', 'NEW NOTE', lv[2]),
      makeBlock('weak', 'WEAK NOTES', lv[1], { adaptive: true }),
    ];
  }

  // The frontier: first major level not passed yet (the last one when all are).
  const frontier = singles.find((l) => !passed(best, l.id)) || singles[singles.length - 1];

  // Block 1: most played.
  const counts = playCounts(log);
  let warm = null;
  let top = 0;
  for (const l of singles) {
    const n = counts.get(l.id) || 0;
    if (n > top) { top = n; warm = l; }
  }
  warm = warm || frontier;
  const blocks = [makeBlock('warmup', 'WARM-UP', warm, { keyPc: 0 })];

  // Weak-note blocks.
  const weak = weakNotes(stats || {}, { log }).map((x) => x.note);
  const playedFixed = allLevels().filter((l) => !l.random && !l.chromatic && !(l.len > 1) && best[l.id] != null);
  const sizes = new Map(playedFixed.map((l) => [l.id, poolOf(l)]));
  const weakLevel = (targets) => {
    for (const want of [targets, targets.slice(0, 1)]) {
      if (!want.length) continue;
      const fits = playedFixed.filter((l) => want.every((n) => sizes.get(l.id).has(n)));
      fits.sort((a, b) => sizes.get(a.id).size - sizes.get(b.id).size || a.idx - b.idx);
      if (fits.length) return fits[0];
    }
    return null;
  };
  const weakBlock = (targets) => {
    const lv = weakLevel(targets);
    return lv ? makeBlock('weak', 'WEAK NOTES', lv, { adaptive: true }) : makeBlock('weak', 'WEAK NOTES', frontier, { adaptive: true });
  };
  blocks.push(weakBlock(weak.slice(0, 2)));

  // Block 3: pairs / dictation at a fitting step of the ladder, in the warm-up's chapter.
  const reachesMi = allLevels().some((l) => isCMajorSingle(l) && poolOf(l).has(4) && passed(best, l.id));
  const octave = allLevels().some((l) => wholeOctave(l) && passed(best, l.id));
  const ladder = [['pairs-1st', reachesMi], ['pairs-oct', octave], ['dict-2', octave], ['dict-3', octave], ['dict-4', octave], ['dict-5', octave]];
  const open = ladder.filter(([, ok]) => ok);
  if (open.length) {
    const step = open.find(([s]) => !passedSuffix(best, s)) || open[open.length - 1];
    const lv = levelsFor(warm.chapterId).find((l) => suffix(l) === step[0]);
    blocks.push(makeBlock('seq', lv.family === 'pairs' ? 'DEGREE PAIRS' : 'DICTATION', lv, { adaptive: true }));
  } else {
    blocks.push(makeBlock('new', 'NEW NOTE', frontier));
  }

  // Block 4: random key once whole-octave C major is passed, else more weak-note work.
  if (octave) {
    const rks = ['rk-major', 'rk-minor'].map((s) => levelsFor(warm.chapterId).find((l) => suffix(l) === s));
    const lv = rks.find((l) => !passed(best, l.id)) || rks[Math.floor(rng() * rks.length)];
    blocks.push(makeBlock('random', 'RANDOM KEY', lv));
  } else {
    blocks.push(weakBlock(weak.length > 2 ? weak.slice(2, 4) : weak.slice(0, 2)));
  }
  return blocks;
}

/** "2/4 · WEAK NOTES" */
export const blockLabel = (i, blocks) => `${i + 1}/${blocks.length} · ${blocks[i].label}`;
