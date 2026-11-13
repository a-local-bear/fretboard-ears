// Adaptive practice: per-note weights from the stats, and decks drawn with those weights.
// Pure: pass the stats aggregate (stats.js), optionally the recent log, and a seeded rng.
//
// Weight model (per note of a pool; notes are semitone offsets, folded onto one octave like the stats):
//   neutral 1.0 when the note has no data; otherwise
//   weight = FLOOR + MISS_GAIN * (1 - acc) + SLOW_GAIN * slow + confusion bonus
//   acc  = first-try accuracy, smoothed towards PRIOR_ACC with PRIOR_N imaginary answers, taken from the
//          last RECENT entries of the log when the note appears there at least MIN_RECENT times, else
//          from the lifetime aggregate;
//   slow = how much slower than the player's average response (0 = at or below it, 1 = twice as slow),
//          from the same recent entries, 0 when untimed;
//   confusion bonus = min(CONF_CAP, CONF_GAIN * rate) for both notes of a mix-up seen in the pool,
//          rate = times heard-as-the-other / times heard.
// A mastered note therefore sits at FLOOR (< neutral), so it still appears but less often.

import { arrange } from './deck.js';
import { notesOf } from './stats.js';
import { phraseFor } from './phrase.js';

export const FLOOR = 0.5;
export const NEUTRAL = 1;
const MISS_GAIN = 3;
const SLOW_GAIN = 0.5;
const PRIOR_ACC = 0.8;
const PRIOR_N = 2;
const RECENT = 400;
const MIN_RECENT = 3;
const MIN_HEARD = 3; // fewer answers than this count as "no data" when choosing weak notes
const CONF_GAIN = 4;
const CONF_CAP = 2;

/** Fold higher octaves onto the first one (0 … 12) like stats.js does. */
export const foldNote = (o) => (o <= 12 ? o : o % 12 || 12);

/** Recent per-note numbers from the log: Map note → { n, ok, ms, timed }. */
function recentStats(log) {
  const out = new Map();
  for (const e of (log || []).slice(-RECENT)) {
    const n = notesOf(e);
    if (!n) continue;
    const r = out.get(n.h) || { n: 0, ok: 0, ms: 0, timed: 0 };
    r.n++;
    if (n.h === n.a) r.ok++;
    if (Number.isFinite(e.ms) && e.ms >= 0) { r.ms += e.ms; r.timed++; }
    out.set(n.h, r);
  }
  return out;
}

/** The player's average response time (ms) over the recent log or the aggregate; null if untimed. */
function averageMs(recent, stats) {
  let sum = 0;
  let n = 0;
  for (const r of recent.values()) { sum += r.ms; n += r.timed; }
  if (n >= MIN_RECENT) return sum / n;
  return stats?.rt?.n ? stats.rt.sum / stats.rt.n : null;
}

/** Extra weight per note for mix-ups between two notes of the list (both notes get it). */
function confusionBonus(stats, notes) {
  const bonus = new Map();
  const set = new Set(notes);
  for (const [k, c] of Object.entries(stats?.conf || {})) {
    const [h, a] = k.split('>').map(Number);
    if (!set.has(h) || !set.has(a) || h === a) continue;
    const heard = stats.heard?.[h] || 0;
    if (!heard) continue;
    const b = CONF_GAIN * (c / heard);
    for (const n of [h, a]) bonus.set(n, Math.min(CONF_CAP, (bonus.get(n) || 0) + b));
  }
  return bonus;
}

/**
 * Weights for the notes of a pool: Map(note id → weight > 0). `stats` is the aggregate, `log` the
 * (recent) log entries. Notes of other octaves share the weight of their folded name.
 */
export function noteWeights(stats, pool, { log = [] } = {}) {
  const recent = recentStats(log);
  const avg = averageMs(recent, stats);
  const folded = [...new Set(pool.map(foldNote))];
  const bonus = confusionBonus(stats, folded);
  const byFold = new Map();
  for (const f of folded) {
    const r = recent.get(f);
    let heard = stats?.heard?.[f] || 0;
    let ok = stats?.correct?.[f] || 0;
    if (r && r.n >= MIN_RECENT) { heard = r.n; ok = r.ok; }
    let w;
    if (!heard) w = NEUTRAL + (bonus.get(f) || 0);
    else {
      const acc = (ok + PRIOR_ACC * PRIOR_N) / (heard + PRIOR_N);
      let slow = 0;
      if (avg && r && r.timed >= MIN_RECENT) slow = Math.min(1, Math.max(0, r.ms / r.timed / avg - 1));
      w = FLOOR + MISS_GAIN * (1 - acc) + SLOW_GAIN * slow + (bonus.get(f) || 0);
    }
    byFold.set(f, w);
  }
  return new Map(pool.map((n) => [n, byFold.get(foldNote(n))]));
}

/** Notes with enough data, weakest first, at or above `minWeight`: [{ note, weight }] (folded offsets). */
export function weakNotes(stats, { log = [], minWeight = NEUTRAL } = {}) {
  const seen = Object.keys(stats?.heard || {}).map(Number).filter((n) => (stats.heard[n] || 0) >= MIN_HEARD);
  const w = noteWeights(stats, seen, { log });
  return seen.map((note) => ({ note, weight: w.get(note) })).filter((x) => x.weight >= minWeight)
    .sort((a, b) => b.weight - a.weight || a.note - b.note);
}

// ---------- weighted drawing ----------

function draw(keys, weight, rng) {
  const total = keys.reduce((s, k) => s + weight(k), 0);
  let x = rng() * total;
  for (const k of keys) { x -= weight(k); if (x < 0) return k; }
  return keys[keys.length - 1];
}

/**
 * A deck of single-note ids. With `keepNewest` (`newest`, default the last of the pool) it
 * appears at least twice. Notes are drawn in proportion to their weight, with a per-note cap so one
 * weak note cannot take the whole deck, and no note comes three times in a row.
 */
export function buildAdaptiveDeck(pool, weights, rounds = 10, rng = Math.random, { keepNewest = false, newest } = {}) {
  const w = (n) => weights.get(n) ?? NEUTRAL;
  const counts = new Map(pool.map((n) => [n, 0]));
  const deck = [];
  const add = (n) => { deck.push(n); counts.set(n, counts.get(n) + 1); };
  if (keepNewest && pool.length) { const nw = pool.includes(newest) ? newest : pool[pool.length - 1]; add(nw); add(nw); }
  const cap = Math.max(Math.ceil(rounds * 0.4), Math.ceil(rounds / pool.length) + 1);
  while (deck.length < rounds) {
    let open = pool.filter((n) => counts.get(n) < cap);
    if (!open.length) open = pool;
    add(draw(open, w, rng));
  }
  return arrange(deck, rng) ?? deck;
}

/** Weighted sample without replacement (Efraimidis–Spirakis): items ordered by rng()^(1/weight). */
function weightedOrder(items, weight, rng) {
  return items.map((it) => ({ it, key: rng() ** (1 / Math.max(1e-6, weight(it))) }))
    .sort((a, b) => b.key - a.key).map((x) => x.it);
}

/** Phrase deck leaning towards phrases with weak notes: candidates are drawn by mean note weight. */
export function buildAdaptivePhraseDeck(level, pool, weights, rounds = 10, { mode = 'major', rng = Math.random } = {}) {
  const w = (n) => weights.get(n) ?? NEUTRAL;
  const cands = new Map();
  for (let i = 0; i < rounds * 8; i++) {
    const p = phraseFor(level, pool, mode, rng);
    cands.set(p.join(), p);
  }
  const ordered = weightedOrder([...cands.values()], (p) => p.reduce((s, n) => s + w(n), 0) / p.length, rng);
  const deck = [];
  for (let i = 0; deck.length < rounds; i++) {
    const p = ordered[i % ordered.length];
    if (ordered.length > 1 && deck.length && deck[deck.length - 1].join() === p.join()) continue;
    deck.push(p);
  }
  return deck;
}

/** Adaptive deck for any level: single notes, or phrases for a dictation level. */
export function buildAdaptiveDeckFor(level, pool, weights, rounds, mode, rng = Math.random) {
  if (level.len > 1) return buildAdaptivePhraseDeck(level, pool, weights, rounds, { mode, rng });
  return buildAdaptiveDeck(pool, weights, rounds, rng, { keepNewest: level.newest != null, newest: level.newest });
}
