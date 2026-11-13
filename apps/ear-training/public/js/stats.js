// Practice statistics. Pure functions: no DOM, no storage, "now" is always passed in.
// Log entries: { t, heard, answered, tries, ms?, hs?, as? }. Notes are counted as semitones above the
// tonic (0 = the root … 11 = the seventh, 12 = the octave), so they mean the same thing in every key and mode. `hs`/`as` hold
// that offset; older entries only have `heard`/`answered` as C-major degree indexes (0 = the root … 7 = the octave).

export const SESSION_GAP_MS = 5 * 60 * 1000; // a longer pause starts a new session
export const SESSION_LEAD_MS = 15 * 1000; // time credited for the first answer of a session
export const STATS_VERSION = 3;

const pad = (n) => String(n).padStart(2, '0');
/** Local calendar day of a timestamp as YYYY-MM-DD. */
export const dayKey = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** Timestamp (noon, DST-safe) of the calendar day `n` days after the day of `t`. */
const addDays = (t, n) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12).getTime();
};
/** Local Monday (YYYY-MM-DD) of the week containing timestamp `t`. */
export const weekKey = (t) => {
  const d = new Date(t);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7), 12).getTime());
};
export const RT_BUCKET_MS = 50; // response times are kept as a histogram of 50 ms buckets
export const RT_MAX_MS = 60000; // slower answers all land in the last bucket
const dayBefore = (t, n) => dayKey(addDays(t, -n));

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isOffset = (x) => Number.isInteger(x) && x >= 0 && x < 64;
const MAJOR_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12];
/** Fold higher octaves onto the first (0 … 12), so a third two octaves up counts as the third and any higher root as the octave. */
const fold = (o) => (o <= 12 ? o : o % 12 || 12);
/** The heard and answered notes of an entry as folded offsets, or null if it can't be read. */
export function notesOf(e) {
  if (!e || !isNum(e.t)) return null;
  if (isOffset(e.hs) && isOffset(e.as)) return { h: fold(e.hs), a: fold(e.as) };
  const h = MAJOR_OFFSETS[e.heard];
  const a = MAJOR_OFFSETS[e.answered];
  return h != null && a != null && e.hs == null ? { h, a } : null;
}
const bump = (obj, key, by = 1) => { obj[key] = (obj[key] || 0) + by; };

// ---------- aggregate ----------

export function emptyStats() {
  return {
    v: STATS_VERSION, notes: 0,
    days: {}, // dayKey → answers
    weeks: {}, // Monday dayKey → { n, ok, heard, correct (per note), rt: { bucket → count } }
    heard: {}, correct: {}, // note offset → count (first-try)
    conf: {}, // "heard>answered" → count
    miss: { n: 0, tries: 0 }, // rounds that started with a miss, and total taps they needed
    rt: { n: 0, sum: 0 }, // response time (ms) over entries that have one
    activeMs: 0, lastT: 0, // approximate practice time
  };
}

/** Fold one log entry into an aggregate (mutates and returns it). Entries must arrive in time order. */
export function addEntry(agg, e) {
  const n = notesOf(e);
  if (!n) return agg;
  agg.notes++;
  bump(agg.days, dayKey(e.t));
  bump(agg.heard, n.h);
  const wk = weekKey(e.t);
  const w = agg.weeks[wk] || (agg.weeks[wk] = { n: 0, ok: 0, heard: {}, correct: {}, rt: {} });
  w.n++;
  bump(w.heard, n.h);
  if (n.h === n.a) { w.ok++; bump(w.correct, n.h); }
  if (isNum(e.ms) && e.ms >= 0) bump(w.rt, Math.floor(Math.min(e.ms, RT_MAX_MS) / RT_BUCKET_MS));
  if (n.h === n.a) bump(agg.correct, n.h);
  else {
    bump(agg.conf, `${n.h}>${n.a}`);
    if (Number.isInteger(e.tries) && e.tries > 1) { agg.miss.n++; agg.miss.tries += e.tries; }
  }
  if (isNum(e.ms) && e.ms >= 0) { agg.rt.n++; agg.rt.sum += e.ms; }
  const gap = e.t - agg.lastT;
  agg.activeMs += agg.lastT && gap >= 0 && gap <= SESSION_GAP_MS ? gap : SESSION_LEAD_MS;
  agg.lastT = Math.max(agg.lastT, e.t);
  return agg;
}

export const buildStats = (entries) => (Array.isArray(entries) ? entries : []).reduce(addEntry, emptyStats());

/** True if `x` looks like an aggregate we can keep adding to. */
export const validStats = (x) =>
  !!x && x.v === STATS_VERSION && isNum(x.notes) && typeof x.days === 'object' && !!x.weeks && typeof x.weeks === 'object' && typeof x.heard === 'object'
  && typeof x.correct === 'object' && typeof x.conf === 'object' && !!x.miss && !!x.rt && isNum(x.activeMs);

// ---------- streaks and calendar ----------

/** Current streak (today may still be empty if yesterday was practised) and best streak, in days. */
export function streaks(days, now) {
  const keys = Object.keys(days || {}).filter((k) => days[k] > 0).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = prev !== null && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    const [y, m, d] = k.split('-').map(Number);
    prev = new Date(y, m - 1, d, 12).getTime();
    best = Math.max(best, run);
  }
  let current = 0;
  const start = days?.[dayKey(now)] > 0 ? 0 : 1; // an unplayed today doesn't break the streak yet
  while (days?.[dayBefore(now, start + current)] > 0) current++;
  return { current, best: Math.max(best, current) };
}

/**
 * Heatmap grid: `weeks` columns (oldest first), each 7 cells Monday → Sunday.
 * Cell: { key, count, level 0-4 } or null for days after today.
 */
export function heatmap(days, now, weeks = 16) {
  const dow = (new Date(now).getDay() + 6) % 7; // Monday = 0
  const max = Math.max(0, ...Object.values(days || {}));
  const todayKey = dayKey(now);
  const cols = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const key = dayBefore(now, w * 7 + dow - d);
      if (key > todayKey) { col.push(null); continue; }
      const count = days?.[key] || 0;
      const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
      col.push({ key, count, level });
    }
    cols.push(col);
  }
  return cols;
}

// ---------- totals and per-degree numbers ----------

export function totals(agg) {
  return {
    notes: agg.notes,
    days: Object.keys(agg.days).length,
    minutes: Math.round(agg.activeMs / 60000),
  };
}

/** Per-degree first-try accuracy: [{ degree, heard, correct, acc }], only degrees seen. */
export function degreeAccuracy(agg) {
  return Object.keys(agg.heard).map(Number).sort((a, b) => a - b).map((degree) => {
    const heard = agg.heard[degree];
    const correct = agg.correct[degree] || 0;
    return { degree, heard, correct, acc: heard ? correct / heard : null };
  });
}

/** Most frequent mix-ups: [{ heard, answered, n }]. */
export function topConfusions(agg, n = 3) {
  return Object.entries(agg.conf)
    .map(([k, c]) => { const [heard, answered] = k.split('>').map(Number); return { heard, answered, n: c }; })
    .sort((a, b) => b.n - a.n || a.heard - b.heard || a.answered - b.answered)
    .slice(0, n);
}

/** Average taps needed to find the note after a first-try miss, or null. */
export const triesAfterMiss = (agg) => (agg.miss.n ? agg.miss.tries / agg.miss.n : null);

/** Average prompt-to-first-tap time in ms, or null if nothing was timed. */
export const avgResponseMs = (agg) => (agg.rt.n ? agg.rt.sum / agg.rt.n : null);

// ---------- trend (raw log) ----------

function accuracyOf(entries) {
  let ok = 0;
  for (const e of entries) if (e.heard === e.answered) ok++;
  return { n: entries.length, acc: entries.length ? ok / entries.length : null };
}

/**
 * First-try accuracy over the last `days` calendar days (including today) versus everything before.
 * Returns { recent: {n, acc}, earlier: {n, acc}, delta } where delta is null unless both have data.
 */
export function trend(entries, now, days) {
  const cutoff = dayBefore(now, days - 1);
  const recent = [];
  const earlier = [];
  for (const e of entries || []) {
    if (!notesOf(e)) continue;
    (dayKey(e.t) >= cutoff ? recent : earlier).push(e);
  }
  const r = accuracyOf(recent);
  const o = accuracyOf(earlier);
  return { recent: r, earlier: o, delta: r.acc != null && o.acc != null ? r.acc - o.acc : null };
}

// ---------- weekly series ----------

/** Median (ms, bucket midpoint) of a response-time histogram, or null when empty. */
export function histMedian(rt) {
  const keys = Object.keys(rt || {}).map(Number).sort((a, b) => a - b);
  const total = keys.reduce((s, k) => s + rt[k], 0);
  if (!total) return null;
  let seen = 0;
  for (const k of keys) {
    seen += rt[k];
    if (seen * 2 >= total) return k * RT_BUCKET_MS + RT_BUCKET_MS / 2;
  }
  return null;
}

/**
 * Consecutive weeks (Monday starts) from the first practised week to the one containing `now`,
 * gaps included as empty weeks: [{ week, n, ok, acc, medianMs, heard, correct }].
 */
export function weeklySeries(agg, now) {
  const keys = Object.keys(agg?.weeks || {}).sort();
  if (!keys.length) return [];
  const [y, m, d] = keys[0].split('-').map(Number);
  const last = weekKey(Math.max(now, new Date(keys[keys.length - 1] + 'T12:00:00').getTime()));
  const out = [];
  for (let t = new Date(y, m - 1, d, 12).getTime(), k = weekKey(t); k <= last; t = addDays(t, 7), k = weekKey(t)) {
    const w = agg.weeks[k];
    out.push(w
      ? { week: k, n: w.n, ok: w.ok, acc: w.n ? w.ok / w.n : null, medianMs: histMedian(w.rt), heard: w.heard, correct: w.correct }
      : { week: k, n: 0, ok: 0, acc: null, medianMs: null, heard: {}, correct: {} });
  }
  return out;
}
