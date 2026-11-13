import test from 'node:test';
import assert from 'node:assert/strict';
import { noteWeights, weakNotes, buildAdaptiveDeck, buildAdaptivePhraseDeck, buildAdaptiveDeckFor, FLOOR, NEUTRAL } from '../js/adaptive.js';
import { emptyStats, addEntry } from '../js/stats.js';
import { mulberry32, hasTripleRun } from '../js/deck.js';
import { LEVELS, levelById, buildContext, ROUNDS, SCALES } from '../js/data.js';
import { loadSettings } from '../js/storage.js';

const POOL = [0, 2, 4, 5, 7];
let t = 1e12;
const ent = (h, a, ms = 1000) => ({ t: (t += 1000), hs: h, as: a, tries: h === a ? 1 : 2, ms });
const statsOf = (entries) => entries.reduce(addEntry, emptyStats());
const rep = (n, f) => Array.from({ length: n }, f);

test('no data gives neutral weights', () => {
  const w = noteWeights(emptyStats(), POOL);
  for (const n of POOL) assert.equal(w.get(n), NEUTRAL);
});

test('weak notes weigh more, mastered ones keep a floor', () => {
  const log = [...rep(20, () => ent(0, 0)), ...rep(20, (_, i) => ent(4, i % 2 ? 4 : 5))];
  const w = noteWeights(statsOf(log), POOL, { log });
  assert.ok(w.get(4) > w.get(0) + 0.5);
  assert.ok(w.get(0) >= FLOOR && w.get(0) < NEUTRAL);
  assert.equal(w.get(7), NEUTRAL, 'unseen note is neutral');
});

test('slow notes weigh more than quick ones at equal accuracy', () => {
  const log = [...rep(10, () => ent(0, 0, 500)), ...rep(10, () => ent(2, 2, 3000))];
  const w = noteWeights(statsOf(log), POOL, { log });
  assert.ok(w.get(2) > w.get(0));
});

test('recent play outweighs old mistakes', () => {
  const old = rep(450, () => ent(4, 5));
  const recent = rep(400, () => ent(4, 4));
  const stats = statsOf([...old, ...recent]);
  const w = noteWeights(stats, POOL, { log: [...old, ...recent] });
  assert.ok(w.get(4) < noteWeights(stats, POOL).get(4));
});

test('confusions raise both notes', () => {
  const base = [...rep(20, () => ent(4, 4)), ...rep(20, () => ent(5, 5))];
  const conf = [...rep(20, () => ent(4, 5)), ...rep(20, () => ent(5, 5))];
  const a = noteWeights(statsOf(base), POOL);
  const b = noteWeights(statsOf(conf), POOL);
  assert.ok(b.get(5) > a.get(5), 'the confused-with note rises');
  assert.ok(b.get(4) > a.get(4));
  // a mix-up with a note outside the pool adds nothing to the partner
  assert.ok(noteWeights(statsOf(conf), [0, 2, 4]).get(4) < b.get(4));
});

test('weakNotes lists the weakest first and ignores thin data', () => {
  const log = [...rep(10, () => ent(0, 0)), ...rep(10, () => ent(4, 5)), ent(2, 5)];
  const w = weakNotes(statsOf(log), { log });
  assert.equal(w[0].note, 4);
  assert.ok(!w.some((x) => x.note === 2));
});

test('adaptive deck: weights bias, floor keeps all, rules hold, seeded', () => {
  const weights = new Map(POOL.map((n) => [n, n === 4 ? 3.5 : FLOOR]));
  const counts = new Map(POOL.map((n) => [n, 0]));
  for (let seed = 1; seed <= 200; seed++) {
    const deck = buildAdaptiveDeck(POOL, weights, ROUNDS, mulberry32(seed));
    assert.equal(deck.length, ROUNDS);
    assert.ok(!hasTripleRun(deck));
    assert.ok(deck.every((d) => POOL.includes(d)));
    for (const d of deck) counts.set(d, counts.get(d) + 1);
  }
  assert.ok(counts.get(4) > 2 * counts.get(0));
  for (const n of POOL) assert.ok(counts.get(n) > 0, `note ${n} still appears`);
  assert.deepEqual(buildAdaptiveDeck(POOL, weights, ROUNDS, mulberry32(9)), buildAdaptiveDeck(POOL, weights, ROUNDS, mulberry32(9)));
});

test('adaptive deck keeps the newest note of a growing level', () => {
  const weights = new Map(POOL.map((n) => [n, n === 0 ? 5 : FLOOR]));
  for (let seed = 1; seed <= 100; seed++) {
    const deck = buildAdaptiveDeck(POOL, weights, ROUNDS, mulberry32(seed), { keepNewest: true });
    assert.ok(deck.filter((d) => d === 7).length >= 2);
  }
});

test('adaptive deck keeps an explicit newest note that is not the top of the pool', () => {
  const pool = [0, 2, 4, 7];
  const weights = new Map(pool.map((n) => [n, n === 7 ? 5 : FLOOR]));
  for (let seed = 1; seed <= 100; seed++) {
    const deck = buildAdaptiveDeck(pool, weights, ROUNDS, mulberry32(seed), { keepNewest: true, newest: 2 });
    assert.ok(deck.filter((d) => d === 2).length >= 2);
  }
  const lv = levelById('major-t2');
  const deck = buildAdaptiveDeckFor(lv, pool, weights, ROUNDS, 'major', mulberry32(4));
  assert.ok(deck.filter((d) => d === lv.newest).length >= 2);
});

test('adaptive decks work on every level and respect their shape', () => {
  for (const level of LEVELS) {
    const ctx = buildContext('A', level, 0, level.mode ?? 'major');
    const weights = noteWeights(emptyStats(), ctx.pool);
    const deck = buildAdaptiveDeckFor(level, ctx.pool, weights, ROUNDS, ctx.mode, mulberry32(3));
    assert.equal(deck.length, ROUNDS, level.id);
    for (const item of deck) for (const n of [].concat(item)) assert.ok(ctx.pool.includes(n), level.id);
    if (level.len > 1) assert.ok(deck.every((p) => p.length === level.len), level.id);
    else assert.ok(deck.every((n) => Number.isInteger(n)), level.id);
    // A chromatic dictation level keeps its shape when adaptive: one note from outside the scale.
    if (level.len > 1 && level.chromatic) {
      for (const p of deck) assert.equal(p.filter((n) => !SCALES[ctx.mode].includes(n % 12)).length, 1, `${level.id}: ${p}`);
    }
  }
});

test('phrase decks lean towards weak notes', () => {
  const pool = [0, 2, 4, 5, 7, 9, 11, 12];
  const weights = new Map(pool.map((n) => [n, n === 5 ? 4 : FLOOR]));
  const even = new Map(pool.map((n) => [n, NEUTRAL]));
  const share = (w, len) => {
    let withWeak = 0;
    for (let seed = 1; seed <= 100; seed++) {
      for (const p of buildAdaptivePhraseDeck({ len }, pool, w, 10, { rng: mulberry32(seed) })) if (p.includes(5)) withWeak++;
    }
    return withWeak / 1000;
  };
  assert.ok(share(weights, 3) > 0.4, `three notes ${share(weights, 3)}`);
  for (const len of [2, 4]) assert.ok(share(weights, len) > share(even, len) + 0.1, `${len} notes: ${share(weights, len)} vs ${share(even, len)}`);
});

test('the adaptive setting defaults to off', () => {
  assert.equal(loadSettings().adaptive, 'off');
});
