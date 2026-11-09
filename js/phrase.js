// Phrases for the sequence levels (degree pairs and melodic dictation). Pure: pass a seeded rng
// (deck.js mulberry32) for deterministic tests. A phrase is an array of note ids (semitone offsets
// above the tonic) drawn from a level's pool.

const mod12 = (n) => ((n % 12) + 12) % 12;

/** Stable degrees of a mode as pitch classes: Do, Mi (Me in minor), Sol. */
export const STABLE = { major: [0, 4, 7], minor: [0, 3, 7] };
export const isStable = (offset, mode = 'major') => (STABLE[mode] || STABLE.major).includes(mod12(offset));

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * One melodic phrase of `len` notes from an ascending pool: starts on or near Do (the low part of
 * the pool, favouring Do, Mi, Sol), moves mostly by step with some skips and the occasional leap
 * (a leap tends to be followed by a step back), never repeats a note straight away, and ends on a
 * stable degree (Do, Mi, Sol) with probability `endStable`.
 */
export function makePhrase(pool, len, { mode = 'major', rng = Math.random, endStable = 0.75 } = {}) {
  const n = pool.length;
  if (n < 2) return Array.from({ length: len }, () => pool[0]);
  let lows = pool.map((_, i) => i).filter((i) => pool[i] <= 7);
  if (!lows.length) lows = [0, 1, 2].filter((i) => i < n);
  const starts = lows.flatMap((i) => (isStable(pool[i], mode) ? [i, i, i] : [i]));
  const wantStable = rng() < endStable;
  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const idx = [pick(starts, rng)];
    let dir = rng() < 0.5 ? 1 : -1;
    let lastSize = 1;
    while (idx.length < len) {
      const cur = idx[idx.length - 1];
      const r = rng();
      const size = r < 0.62 ? 1 : r < 0.84 ? 2 : r < 0.94 ? 3 : 4 + Math.floor(rng() * 2);
      if (idx.length > 1) {
        if (lastSize >= 3) { if (rng() < 0.75) dir = -dir; } else if (rng() < 0.25) dir = -dir;
      }
      let next = cur + dir * size;
      if (next < 0 || next >= n) { dir = -dir; next = cur + dir * size; }
      if (next < 0 || next >= n) next = cur + dir; // the pool is too small for this step
      if (next < 0 || next >= n || next === cur) { dir = -dir; next = cur + dir; }
      dir = Math.sign(next - cur);
      lastSize = Math.abs(next - cur);
      idx.push(next);
    }
    const phrase = idx.map((i) => pool[i]);
    if (new Set(phrase).size < 2) continue;
    best = phrase;
    if (!wantStable || isStable(phrase[len - 1], mode)) break;
  }
  return best || pool.slice(0, len);
}

/** `rounds` distinct phrases (as far as the pool allows), never the same one twice in a row. */
export function buildPhraseDeck(pool, len, rounds = 10, { mode = 'major', rng = Math.random } = {}) {
  const deck = [];
  const seen = new Set();
  for (let r = 0; r < rounds; r++) {
    let p = makePhrase(pool, len, { mode, rng });
    for (let t = 0; t < 30 && seen.has(p.join()); t++) p = makePhrase(pool, len, { mode, rng });
    seen.add(p.join());
    deck.push(p);
  }
  return deck;
}

/** The deck for a sequence level: musical phrases of `level.len` notes. */
export function buildSequenceDeck(level, pool, rounds, mode, rng = Math.random) {
  return buildPhraseDeck(pool, level.len, rounds, { mode, rng });
}
