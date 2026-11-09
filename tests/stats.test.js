import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKey, emptyStats, addEntry, buildStats, streaks, heatmap, totals, degreeAccuracy,
  topConfusions, triesAfterMiss, avgResponseMs, trend,
} from '../js/stats.js';

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const e = (t, heard, answered, extra = {}) => ({ t, heard, answered, tries: heard === answered ? 1 : 2, ...extra });

test('empty log gives zeros and nulls', () => {
  const agg = buildStats([]);
  const now = at(2024, 3, 10);
  assert.deepEqual(streaks(agg.days, now), { current: 0, best: 0 });
  assert.deepEqual(totals(agg), { notes: 0, days: 0, minutes: 0 });
  assert.deepEqual(degreeAccuracy(agg), []);
  assert.deepEqual(topConfusions(agg), []);
  assert.equal(triesAfterMiss(agg), null);
  assert.equal(avgResponseMs(agg), null);
  assert.equal(trend([], now, 7).delta, null);
  const hm = heatmap(agg.days, now, 16);
  assert.equal(hm.length, 16);
  assert.ok(hm.flat().every((c) => c === null || c.count === 0));
});

test('streak continues across midnight', () => {
  const agg = buildStats([e(at(2024, 3, 8, 23, 50), 0, 0), e(at(2024, 3, 9, 0, 10), 1, 1), e(at(2024, 3, 9, 0, 20), 1, 1)]);
  assert.equal(dayKey(at(2024, 3, 9, 0, 10)), '2024-03-09');
  assert.deepEqual(streaks(agg.days, at(2024, 3, 9, 0, 30)), { current: 2, best: 2 });
  // still alive the next day before practising, broken a day later
  assert.equal(streaks(agg.days, at(2024, 3, 10, 9)).current, 2);
  assert.equal(streaks(agg.days, at(2024, 3, 11, 9)).current, 0);
  assert.equal(streaks(agg.days, at(2024, 3, 11, 9)).best, 2);
});

test('best streak survives a gap; month and DST boundaries count as consecutive', () => {
  const days = [[2024, 2, 28], [2024, 2, 29], [2024, 3, 1], [2024, 3, 10], [2024, 3, 11], [2024, 3, 12], [2024, 3, 13]];
  const agg = buildStats(days.map(([y, m, d]) => e(at(y, m, d, 20), 0, 0)));
  assert.deepEqual(streaks(agg.days, at(2024, 3, 13, 21)), { current: 4, best: 4 });
  const b = buildStats([e(at(2024, 3, 9), 0, 0), e(at(2024, 3, 10), 0, 0), e(at(2024, 3, 11), 0, 0), e(at(2024, 3, 20), 0, 0)]);
  assert.deepEqual(streaks(b.days, at(2024, 3, 20)), { current: 1, best: 3 });
});

test('heatmap lays out Monday to Sunday with today last and future blank', () => {
  const now = at(2024, 3, 13); // Wednesday
  const agg = buildStats([e(now, 0, 0), e(now + 1000, 0, 0), e(at(2024, 3, 12), 0, 0)]);
  const hm = heatmap(agg.days, now, 4);
  const last = hm[3];
  assert.equal(last[2].key, '2024-03-13');
  assert.equal(last[2].count, 2);
  assert.equal(last[2].level, 4);
  assert.equal(last[1].count, 1);
  assert.equal(last[0].key, '2024-03-11');
  assert.equal(last[3], null);
  assert.equal(hm[0][0].key, '2024-02-19');
});

test('totals, minutes split on session gaps', () => {
  const t0 = at(2024, 3, 10, 10);
  const agg = buildStats([
    e(t0, 0, 0), e(t0 + 60000, 0, 0), e(t0 + 120000, 0, 0), // session 1: 15s lead + 2 min
    e(t0 + 3600000, 0, 0), e(t0 + 3600000 + 60000, 0, 0), // session 2: 15s lead + 1 min
  ]);
  const t = totals(agg);
  assert.equal(t.notes, 5);
  assert.equal(t.days, 1);
  assert.equal(agg.activeMs, 15000 + 120000 + 15000 + 60000);
  assert.equal(t.minutes, 4);
});

test('per-degree accuracy and confusions', () => {
  const t = at(2024, 3, 10);
  const agg = buildStats([
    e(t, 2, 2), e(t, 2, 2), e(t, 2, 3), e(t, 4, 5), e(t, 4, 5), e(t, 1, 0), e(t, 4, 4),
  ]);
  const acc = degreeAccuracy(agg);
  // Old entries are C-major degree indexes, counted as semitone offsets: Re = 2, Mi = 4, Sol = 7, La = 9.
  assert.deepEqual(acc.map((d) => d.degree), [2, 4, 7]);
  assert.equal(acc.find((d) => d.degree === 4).acc, 2 / 3);
  assert.equal(acc.find((d) => d.degree === 2).acc, 0);
  assert.deepEqual(topConfusions(agg, 2), [{ heard: 7, answered: 9, n: 2 }, { heard: 2, answered: 0, n: 1 }]);
});

test('entries with exact offsets count by note, folding higher octaves', () => {
  const t = at(2024, 3, 10);
  const agg = buildStats([
    e(t, 2, 2, { hs: 3, as: 3 }), // minor Me, not Mi
    e(t, 8 + 16, 8 + 15, { hs: 16, as: 15 }), // Mi'' heard as Me''
    e(t, 8 + 24, 8 + 24, { hs: 24, as: 24 }), // Do'' counts as Do'
  ]);
  assert.deepEqual(degreeAccuracy(agg).map((d) => d.degree), [3, 4, 12]);
  assert.deepEqual(topConfusions(agg, 1), [{ heard: 4, answered: 3, n: 1 }]);
});

test('recovery and response time ignore entries without data', () => {
  const t = at(2024, 3, 10);
  const agg = buildStats([
    e(t, 0, 1, { tries: 3, ms: 2000 }), e(t, 0, 2, { tries: 2 }), e(t, 0, 0, { ms: 1000 }), e(t, 1, 1, { ms: null }),
  ]);
  assert.equal(triesAfterMiss(agg), 2.5);
  assert.equal(avgResponseMs(agg), 1500);
});

test('incremental aggregate equals one built from the whole log', () => {
  const log = [e(at(2024, 3, 9), 0, 1, { ms: 900 }), e(at(2024, 3, 10), 3, 3), e(at(2024, 3, 10, 12, 1), 5, 4)];
  const inc = log.reduce(addEntry, emptyStats());
  assert.deepEqual(inc, buildStats(log));
  assert.deepEqual(JSON.parse(JSON.stringify(inc)), inc);
});

test('malformed entries are skipped', () => {
  const agg = buildStats([null, {}, { t: 'x', heard: 0, answered: 0 }, e(at(2024, 3, 10), 0, 0)]);
  assert.equal(agg.notes, 1);
});

test('trend compares recent days to earlier ones', () => {
  const now = at(2024, 3, 20, 15);
  const log = [
    e(at(2024, 3, 1), 0, 1), e(at(2024, 3, 2), 0, 0), // earlier: 50%
    e(at(2024, 3, 14), 0, 0), e(at(2024, 3, 20, 9), 0, 0), e(at(2024, 3, 20, 10), 0, 1), e(at(2024, 3, 17), 0, 0), // recent: 75%
  ];
  const t = trend(log, now, 7);
  assert.equal(t.recent.n, 4);
  assert.equal(t.earlier.n, 2);
  assert.equal(t.recent.acc, 0.75);
  assert.ok(Math.abs(t.delta - 0.25) < 1e-9);
  assert.equal(trend(log, now, 30).earlier.n, 0);
  assert.equal(trend(log, now, 30).delta, null);
});
