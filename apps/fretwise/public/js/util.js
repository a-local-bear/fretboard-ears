// Small shared helpers (no DOM).

/** deterministic random number generator (mulberry32) */
export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle: (list) => {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** pick one item; `weight(item)` must return a non-negative number */
    weighted: (list, weight) => {
      const weights = list.map(weight);
      const total = weights.reduce((a2, b) => a2 + b, 0);
      if (total <= 0) return list[Math.floor(next() * list.length)];
      let r = next() * total;
      for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r < 0) return list[i]; }
      return list[list.length - 1];
    },
    /** n distinct items (or as many as exist) */
    sample: (list, n) => rng.shuffle(list).slice(0, n),
  };
  return rng;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const uniqueBy = (list, keyOf) => {
  const seen = new Set();
  return list.filter((item) => { const k = keyOf(item); if (seen.has(k)) return false; seen.add(k); return true; });
};

/** local calendar day as YYYY-MM-DD */
export function dayKey(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** the day `offset` days away from a YYYY-MM-DD key */
export function shiftDay(key, offset) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + offset, 12));
}
export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

export const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
export const formatTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
