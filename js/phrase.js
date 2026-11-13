// Phrases for the dictation levels. Pure: pass a seeded rng (deck.js mulberry32) for deterministic
// tests. A phrase is an array of note ids (semitone offsets above the tonic) drawn from a level's pool.

import { SCALES } from './data.js';

const mod12 = (n) => ((n % 12) + 12) % 12;

/** Stable degrees of a mode as pitch classes: the root, the third (flat in minor) and the fifth. */
export const STABLE = { major: [0, 4, 7], minor: [0, 3, 7] };
export const isStable = (offset, mode = 'major') => (STABLE[mode] || STABLE.major).includes(mod12(offset));

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/**
 * One melodic phrase of `len` notes from an ascending pool: starts on or near the root (the low part
 * of the pool, favouring root, third and fifth), moves mostly by step with some skips and the
 * occasional leap (a leap tends to be followed by a step back), never repeats a note straight away,
 * and ends on a stable degree (root, third, fifth) with probability `endStable`.
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

/**
 * A phrase for a chromatic level: a phrase of the scale in which one note is swapped for a note from
 * outside the scale a half step from its neighbour (the note after it, or for the last note the one
 * before). A chromatic note is heard by where it leans, so it never stands alone.
 */
export function makeChromaticPhrase(pool, len, { mode = 'major', rng = Math.random } = {}) {
  const scale = SCALES[mode] || SCALES.major;
  const inScale = (o) => scale.includes(mod12(o));
  const outside = new Set(pool.filter((o) => !inScale(o)));
  const phrase = makePhrase(pool.filter(inScale), len, { mode, rng });
  const spots = [];
  for (let i = 0; i < len; i++) {
    const neighbour = i < len - 1 ? phrase[i + 1] : phrase[i - 1];
    for (const c of [neighbour - 1, neighbour + 1]) if (outside.has(c)) spots.push([i, c]);
  }
  if (!spots.length) return phrase;
  const [i, c] = pick(spots, rng);
  return phrase.map((n, k) => (k === i ? c : n));
}

/** A phrase of `level.len` notes for a level: from the scale, or with one chromatic note. */
export const phraseFor = (level, pool, mode, rng = Math.random) =>
  (level.chromatic ? makeChromaticPhrase : makePhrase)(pool, level.len, { mode, rng });

/** The deck of a dictation level: `rounds` distinct phrases (as far as the pool allows). */
export function buildPhraseDeck(level, pool, rounds = 10, { mode = 'major', rng = Math.random } = {}) {
  const deck = [];
  const seen = new Set();
  for (let r = 0; r < rounds; r++) {
    let p = phraseFor(level, pool, mode, rng);
    for (let t = 0; t < 30 && seen.has(p.join()); t++) p = phraseFor(level, pool, mode, rng);
    seen.add(p.join());
    deck.push(p);
  }
  return deck;
}
