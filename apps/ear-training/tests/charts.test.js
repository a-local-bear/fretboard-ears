import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStats, addEntry, emptyStats, weekKey, weeklySeries, histMedian, STATS_VERSION, validStats } from '../public/js/stats.js';
import { accuracyChart, responseChart, volumeChart, noteSparklines, progressHTML } from '../public/js/charts.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const e = (t, hs, as, ms) => ({ t, hs, as, heard: 0, answered: 0, tries: hs === as ? 1 : 2, ...(ms != null ? { ms } : {}) });
const isSvg = (s) => /^<svg [^>]*viewBox="0 0 320 \d+"[^>]*aria-label="[^"]+"/.test(s) && s.endsWith('</svg>');

test('weeks start on Monday, local time', () => {
  assert.equal(weekKey(at(2024, 3, 4, 0)), '2024-03-04'); // Monday
  assert.equal(weekKey(at(2024, 3, 10, 23)), '2024-03-04'); // Sunday night
  assert.equal(weekKey(at(2024, 3, 11, 0)), '2024-03-11');
  assert.equal(weekKey(at(2024, 1, 1, 12)), '2024-01-01'); // year boundary Monday
  assert.equal(weekKey(at(2024, 3, 3, 12)), '2024-02-26'); // crosses month
});

test('version bumped and aggregate has weeks', () => {
  assert.ok(STATS_VERSION >= 3);
  assert.ok(validStats(emptyStats()));
  assert.equal(validStats({ ...emptyStats(), weeks: undefined }), false);
});

test('rebuild equals incremental', () => {
  const log = [e(at(2024, 3, 4), 0, 0, 800), e(at(2024, 3, 5), 2, 4, 1200), e(at(2024, 3, 12), 7, 7, 500), e(at(2024, 3, 12, 13), 7, 7)];
  let inc = emptyStats();
  for (const x of log) inc = addEntry(inc, x);
  assert.deepEqual(inc, buildStats(log));
  const w = inc.weeks['2024-03-04'];
  assert.equal(w.n, 2);
  assert.equal(w.ok, 1);
  assert.deepEqual(w.heard, { 0: 1, 2: 1 });
  assert.deepEqual(w.correct, { 0: 1 });
});

test('histogram median', () => {
  assert.equal(histMedian({}), null);
  assert.equal(histMedian({ 20: 1 }), 1025); // 1000-1050 ms bucket midpoint
  const agg = buildStats([100, 200, 300, 400, 5000].map((ms, i) => e(at(2024, 3, 4, 9 + i), 0, 0, ms)));
  const m = histMedian(agg.weeks['2024-03-04'].rt);
  assert.ok(m >= 300 && m < 350);
  const huge = buildStats([e(at(2024, 3, 4), 0, 0, 9e9)]);
  assert.equal(Object.keys(huge.weeks['2024-03-04'].rt).length, 1);
});

test('weeklySeries fills gaps and runs to now', () => {
  const agg = buildStats([e(at(2024, 3, 4), 0, 0), e(at(2024, 3, 20), 0, 2)]);
  const s = weeklySeries(agg, at(2024, 3, 27));
  assert.deepEqual(s.map((w) => w.week), ['2024-03-04', '2024-03-11', '2024-03-18', '2024-03-25']);
  assert.equal(s[1].n, 0);
  assert.equal(s[1].acc, null);
  assert.equal(s[2].acc, 0);
  assert.deepEqual(weeklySeries(emptyStats(), Date.now()), []);
});

const many = (weeks) => {
  const log = [];
  for (let w = 0; w < weeks; w++) for (let k = 0; k < 8; k++) log.push(e(at(2023, 1, 2) + (w * 7 + k % 5) * 86400000 + k * 3600000, k % 4 * 2, k % 3 ? k % 4 * 2 : 1, 500 + w * 10));
  return buildStats(log);
};

test('empty input gives empty states, not svg', () => {
  const s = weeklySeries(emptyStats(), Date.now());
  for (const f of [accuracyChart, responseChart, volumeChart, noteSparklines]) assert.match(f(s), /^<p class="chart-empty">/);
});

test('charts with one week', () => {
  const agg = buildStats([e(at(2024, 3, 4), 0, 0, 700), e(at(2024, 3, 4, 13), 2, 2, 900), e(at(2024, 3, 4, 14), 2, 2, 900), e(at(2024, 3, 4, 15), 2, 4, 900)]);
  const s = weeklySeries(agg, at(2024, 3, 5));
  assert.equal(s.length, 1);
  for (const f of [accuracyChart, responseChart, volumeChart, noteSparklines]) {
    const out = f(s);
    assert.ok(isSvg(out), out.slice(0, 80));
    assert.ok(!/NaN|undefined|Infinity/.test(out));
  }
  assert.match(accuracyChart(s), /circle/); // lone point is visible
});

test('charts with 60 weeks', () => {
  const s = weeklySeries(many(60), at(2024, 3, 1));
  assert.ok(s.length >= 60);
  for (const f of [accuracyChart, responseChart, volumeChart, noteSparklines]) {
    const out = f(s);
    assert.ok(isSvg(out));
    assert.ok(!/NaN|undefined|Infinity/.test(out));
    assert.ok(out.length < 60000);
  }
});

test('sparse weeks are dotted, full weeks solid', () => {
  const full = Array.from({ length: 6 }, (_, i) => e(at(2024, 3, 4, 8 + i), 0, 0));
  const few = [e(at(2024, 3, 11), 0, 0), e(at(2024, 3, 12), 0, 2)];
  const out = accuracyChart(weeklySeries(buildStats([...full, ...few]), at(2024, 3, 12)));
  assert.match(out, /stroke-dasharray/);
  assert.ok(!/stroke-dasharray/.test(accuracyChart(weeklySeries(buildStats([...full, ...full.map((x) => ({ ...x, t: x.t + 7 * 86400000 }))]), at(2024, 3, 12)))));
});

test('sparklines are labelled and coloured per note', () => {
  const log = [0, 0, 0, 7, 7, 7].map((n, i) => e(at(2024, 3, 4, 8 + i), n, n));
  const out = noteSparklines(weeklySeries(buildStats(log), at(2024, 3, 5)));
  assert.match(out, />1</);
  assert.match(out, />5</);
  assert.match(out, /aria-label="[^"]*fifth 100%/);
});

test('progressHTML combines four blocks', () => {
  const html = progressHTML(many(3), at(2023, 1, 30));
  assert.equal((html.match(/class="chartblock"/g) || []).length, 4);
  assert.equal((html.match(/<svg /g) || []).length, 4);
});
