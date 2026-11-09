// Question order for one level. Pure: pass an rng for deterministic tests.

/** Small seedable PRNG (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const hasTripleRun = (deck) =>
  deck.some((v, i) => i >= 2 && v === deck[i - 1] && v === deck[i - 2]);

/**
 * Build a deck of `rounds` note ids from `degrees` (ascending; the last is the newest).
 * Small pools: newest appears 3x, every other note at least once, the rest random.
 * Pools too big for that (more than rounds - 2 notes): a random pick through the whole pool, no note
 * repeated before all have been used. Either way no note comes 3x in a row.
 */
export function buildDeck(degrees, rounds = 10, rng = Math.random) {
  if (degrees.length > rounds - 2) return bigDeck(degrees, rounds, rng);
  const newest = degrees[degrees.length - 1];
  const others = degrees.slice(0, -1);
  const deck = [newest, newest, newest, ...others];
  while (deck.length < rounds) deck.push(others[Math.floor(rng() * others.length)] ?? newest);
  deck.length = rounds;
  return arrange(deck, rng) ?? shuffle(deck, rng);
}

function bigDeck(pool, rounds, rng) {
  const deck = [];
  let bag = [];
  while (deck.length < rounds) {
    if (!bag.length) bag = shuffle(pool.slice(), rng);
    const v = bag.pop();
    deck.push(v);
  }
  return deck;
}

/**
 * Random order of `items` with no value three times in a row. Picks each next item at random,
 * weighted by how many of that value remain, and backtracks when stuck. Null if impossible.
 */
export function arrange(items, rng) {
  const counts = new Map();
  for (const v of items) counts.set(v, (counts.get(v) || 0) + 1);
  const out = [];
  const step = () => {
    if (out.length === items.length) return true;
    const n = out.length;
    const banned = n >= 2 && out[n - 1] === out[n - 2] ? out[n - 1] : undefined;
    // Weighted random order of the candidate values.
    const cands = [...counts.entries()].filter(([v, c]) => c > 0 && v !== banned)
      .map(([v, c]) => ({ v, key: rng() ** (1 / c) }))
      .sort((a, b) => b.key - a.key);
    for (const { v } of cands) {
      counts.set(v, counts.get(v) - 1);
      out.push(v);
      if (step()) return true;
      out.pop();
      counts.set(v, counts.get(v) + 1);
    }
    return false;
  };
  return step() ? out : null;
}
