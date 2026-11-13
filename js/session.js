// Daily practice session: a pure planner that turns progress + stats into four blocks of ten rounds.
//
// Rules (planSession):
//  - A brand-new player (no stats, no scores) gets the first three levels: root and fifth, the triad,
//    the triad with the second, and a last adaptive block on the triad.
//  - Block 1, WARM-UP: the most-played level of the major build-up (log entries per level id, ties go
//    to the earlier level); with no log, the frontier if it is one of them, else the whole octave.
//    Always in C major.
//  - Block 2, WEAK NOTES: adaptive drilling on the narrowest played one-octave single-note level that
//    contains the player's two weakest notes (weakest first, falling back to the weakest one); if no
//    note is weak enough, the frontier.
//  - Block 3, DICTATION: the first unpassed dictation level of a stage whose whole octave is passed,
//    else the hardest of those. When no stage has got that far, the frontier ("NEW NOTE") instead.
//  - Block 4, RANDOM KEY: only once the fixed-key major octave is passed: the first unpassed whole
//    octave in a random key the player has reached (major, then with chromatic notes, minor, minor
//    with chromatic notes), else one of the reached ones by the rng. Otherwise another WEAK NOTES
//    block, aimed at the third and fourth weakest notes.
// The frontier is the first single-note level not passed yet (the last one when all are).
// Blocks: { kind, label, level (index in LEVELS), levelId, adaptive, keyPc (0 = C major, null = the
// player's chosen key; random-key levels draw their own) }.

import { LEVELS, PASS_SCORE, DEFAULT_POSITION, buildContext, levelById } from './data.js';
import { legacyLevelId } from './progress.js';
import { weakNotes, foldNote } from './adaptive.js';

export const BLOCKS = 4;

const passed = (best, id) => (best[id] ?? -1) >= PASS_SCORE;
const single = (l) => !(l.len > 1);
/** The whole-octave level that opens a stage's dictation and its random-key review. */
const OCTAVES = { major: 'major-rk', majorChrom: 'majorChrom-oct', minor: 'minor-oct', minorChrom: 'minorChrom-oct' };

/** Played-count per level id from the log; plays logged before the single ladder count for the level that replaced theirs. */
function playCounts(log) {
  const m = new Map();
  for (const e of log || []) {
    if (!e || typeof e.lid !== 'string') continue;
    const id = legacyLevelId(e.lid) ?? e.lid;
    m.set(id, (m.get(id) || 0) + 1);
  }
  return m;
}

const makeBlock = (kind, label, level, { adaptive = false, keyPc = null } = {}) => ({
  kind, label, level: level.idx, levelId: level.id, adaptive, keyPc,
});

/** Folded note set of a level (the position does not change it), for matching weak notes. */
function poolOf(level) {
  return new Set(buildContext(DEFAULT_POSITION, level, 0, level.mode ?? 'major').pool.map(foldNote));
}

/**
 * Plan a session. `input` = { progress, stats, log }; `opts.rng` picks between equal random-key levels.
 * Returns an array of BLOCKS blocks. Pure.
 */
export function planSession({ progress, stats, log = [] } = {}, { rng = Math.random } = {}) {
  const best = progress?.best || {};
  const singles = LEVELS.filter(single);
  const buildUp = singles.filter((l) => l.family === 'major' && !l.random);
  const newPlayer = !(stats?.notes > 0) && !Object.keys(best).length;
  if (newPlayer) {
    return [
      makeBlock('warmup', 'WARM-UP', buildUp[0], { keyPc: 0 }),
      makeBlock('new', 'NEW NOTE', buildUp[1]),
      makeBlock('new', 'NEW NOTE', buildUp[2]),
      makeBlock('weak', 'WEAK NOTES', buildUp[1], { adaptive: true }),
    ];
  }

  const frontier = singles.find((l) => !passed(best, l.id)) || singles[singles.length - 1];

  // Block 1: most played level of the build-up.
  const counts = playCounts(log);
  let warm = null;
  let top = 0;
  for (const l of buildUp) {
    const n = counts.get(l.id) || 0;
    if (n > top) { top = n; warm = l; }
  }
  warm = warm || (buildUp.includes(frontier) ? frontier : buildUp[buildUp.length - 1]);
  const blocks = [makeBlock('warmup', 'WARM-UP', warm, { keyPc: 0 })];

  // Weak-note blocks.
  const weak = weakNotes(stats || {}, { log }).map((x) => x.note);
  const played = singles.filter((l) => !l.neck && best[l.id] != null);
  const sizes = new Map(played.map((l) => [l.id, poolOf(l)]));
  const weakLevel = (targets) => {
    for (const want of [targets, targets.slice(0, 1)]) {
      if (!want.length) continue;
      const fits = played.filter((l) => want.every((n) => sizes.get(l.id).has(n)));
      fits.sort((a, b) => sizes.get(a.id).size - sizes.get(b.id).size || a.idx - b.idx);
      if (fits.length) return fits[0];
    }
    return null;
  };
  const weakBlock = (targets) => makeBlock('weak', 'WEAK NOTES', weakLevel(targets) || frontier, { adaptive: true });
  blocks.push(weakBlock(weak.slice(0, 2)));

  // Block 3: dictation in the stages whose whole octave is passed.
  const open = LEVELS.filter((l) => l.len > 1 && passed(best, OCTAVES[l.family]));
  if (open.length) {
    blocks.push(makeBlock('seq', 'DICTATION', open.find((l) => !passed(best, l.id)) || open[open.length - 1], { adaptive: true }));
  } else {
    blocks.push(makeBlock('new', 'NEW NOTE', frontier));
  }

  // Block 4: a whole octave in a random key once the fixed-key octave is passed, else more weak-note work.
  if (passed(best, 'major-6')) {
    const octaves = Object.values(OCTAVES).map(levelById);
    const upTo = octaves.filter((l) => l.idx <= frontier.idx || passed(best, l.id));
    const reached = upTo.length ? upTo : octaves.slice(0, 1); // the major octave is the first to leave the fixed key
    const lv = reached.find((l) => !passed(best, l.id)) || reached[Math.floor(rng() * reached.length)];
    blocks.push(makeBlock('random', 'RANDOM KEY', lv));
  } else {
    blocks.push(weakBlock(weak.length > 2 ? weak.slice(2, 4) : weak.slice(0, 2)));
  }
  return blocks;
}

/** "2/4 · WEAK NOTES" */
export const blockLabel = (i, blocks) => `${i + 1}/${blocks.length} · ${blocks[i].label}`;
