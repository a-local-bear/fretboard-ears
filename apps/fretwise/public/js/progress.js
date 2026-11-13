// A player's progress: XP, streak, lesson results, per-note memory, awards.
// Pure functions over a plain JSON-serialisable state object — no DOM, no I/O.

import { dayKey, shiftDay, clamp } from './util.js';
import { LESSONS, UNITS } from './curriculum.js';
import { parsePosList } from './theory.js';

export const GOALS = [
  { xp: 10, name: 'Casual', text: 'about one lesson a day' },
  { xp: 20, name: 'Steady', text: 'two lessons a day' },
  { xp: 30, name: 'Serious', text: 'three lessons a day' },
  { xp: 50, name: 'Intense', text: 'a proper practice session' },
];
export const TONES = ['teal', 'violet', 'coral', 'blue', 'amber', 'green', 'pink', 'indigo'];
export const HEARTS = 5;

const LEVEL_TITLES = ['Open String', 'First Fret', 'Note Spotter', 'Steady Picker', 'Fret Walker', 'Sight Reader', 'Tune Smith',
  'Position Shifter', 'Neck Navigator', 'Session Player', 'Fretwise Virtuoso'];

export function newState(name, tone = 'teal') {
  return {
    v: 2,
    name: String(name).trim().slice(0, 40) || 'Player',
    avatar: { tone },
    createdAt: Date.now(),
    xp: 0,
    days: {},                                     // 'YYYY-MM-DD' -> XP earned that day
    streak: { count: 0, best: 0, lastDay: null },
    lessons: {},                                  // lesson id -> {done, stars, best, at, skipped?}
    notes: {},                                    // 's1f0' -> {seen, right, run, hl, at, ms}
    stats: { lessons: 0, answers: 0, correct: 0, perfect: 0, seconds: 0, sprintBest: 0, micLessons: 0, practice: 0 },
    awards: {},                                   // award id -> timestamp
    settings: { goal: 20, hearts: true, leftHanded: false, lowOnTop: false },
  };
}

/** fill in anything missing so old or hand-edited saves keep working */
export function normalize(raw) {
  const base = newState(raw && raw.name ? raw.name : 'Player', raw?.avatar?.tone);
  if (!raw || typeof raw !== 'object') return base;
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
  const notes = obj(raw.notes);
  // Version 1 let a single sitting push a note's review interval to months; start those over at two days.
  if (!(raw.v >= 2)) for (const n of Object.values(notes)) if (n && n.hl > 2) n.hl = 2;
  return {
    ...base,
    createdAt: num(raw.createdAt, base.createdAt),
    xp: Math.max(0, num(raw.xp)),
    days: obj(raw.days),
    streak: { count: num(raw.streak?.count), best: num(raw.streak?.best), lastDay: typeof raw.streak?.lastDay === 'string' ? raw.streak.lastDay : null },
    lessons: obj(raw.lessons),
    notes,
    stats: { ...base.stats, ...obj(raw.stats) },
    awards: obj(raw.awards),
    settings: { ...base.settings, ...obj(raw.settings) },
  };
}

// ---------------------------------------------------------------------------
// Levels, streak, daily goal
// ---------------------------------------------------------------------------
export function levelFor(xp) {
  let level = 1, need = 60, into = xp;
  while (into >= need) { into -= need; level++; need = 40 + 20 * level; }
  return { level, into, need, title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1] };
}

export const todayXp = (state, today = dayKey()) => state.days[today] || 0;
/** the streak as it stands today (0 once a day has been missed) */
export function streakNow(state, today = dayKey()) {
  const last = state.streak.lastDay;
  return last === today || last === shiftDay(today, -1) ? state.streak.count : 0;
}
export const practisedToday = (state, today = dayKey()) => state.streak.lastDay === today;

export function addXp(state, amount, today = dayKey()) {
  const before = state.days[today] || 0;
  state.days[today] = before + amount;
  state.xp += amount;
  let extended = false;
  if (state.streak.lastDay !== today) {
    state.streak.count = state.streak.lastDay === shiftDay(today, -1) ? state.streak.count + 1 : 1;
    state.streak.lastDay = today;
    state.streak.best = Math.max(state.streak.best, state.streak.count);
    extended = true;
  }
  const keys = Object.keys(state.days);
  if (keys.length > 420) for (const k of keys.sort().slice(0, keys.length - 400)) delete state.days[k];
  const goal = state.settings.goal;
  return { extended, goalReached: before < goal && before + amount >= goal };
}

/** the last `n` days ending today: [{day, xp, met}] */
export function recentDays(state, n = 7, today = dayKey()) {
  return Array.from({ length: n }, (_, i) => {
    const day = shiftDay(today, i - n + 1);
    const xp = state.days[day] || 0;
    return { day, xp, met: xp >= state.settings.goal, active: xp > 0 };
  });
}

// ---------------------------------------------------------------------------
// Per-note memory (a small spaced-repetition model)
// ---------------------------------------------------------------------------
// Every note has a "half-life" (hl, in days): how long until the chance of
// recalling it has dropped by half.  Getting a note right after a real gap
// stretches the half-life a lot; repeating it within one sitting only nudges it
// (cramming does not build long-term memory); a miss cuts it down.
const DAY_MS = 86400000;
export function recordNote(state, key, correct, ms = 0, now = Date.now()) {
  const n = state.notes[key] || (state.notes[key] = { seen: 0, right: 0, run: 0, hl: 1, at: 0, ms: 0 });
  const elapsed = n.at ? Math.max(0, (now - n.at) / DAY_MS) : 0;
  n.seen++;
  state.stats.answers++;
  if (correct) {
    n.right++;
    n.run++;
    state.stats.correct++;
    const due = Math.min(1.5, elapsed / n.hl);            // how much of the interval had passed
    const spaced = n.hl * (1 + (ms > 0 && ms < 2500 ? 1.4 : 1) * due);
    const crammed = Math.min(2, n.hl + 0.15);             // same-sitting repeats: small steps, two days at most
    n.hl = Math.min(120, Math.max(spaced, crammed));
    if (ms > 0) n.ms = n.ms ? Math.round(n.ms * 0.7 + ms * 0.3) : Math.round(ms);
  } else {
    n.run = 0;
    n.hl = Math.max(0.25, n.hl * 0.4);
  }
  n.at = now;
}

/** 0 = never seen … 1 = known cold; fades as time passes since the last answer */
export function noteStrength(state, key, now = Date.now()) {
  const n = state.notes[key];
  if (!n || !n.seen) return 0;
  const days = Math.max(0, (now - n.at) / 86400000);
  const recall = 2 ** (-days / n.hl);
  const accuracy = (n.right + 0.5) / (n.seen + 1);
  const exposure = 0.4 + 0.6 * Math.min(1, n.right / 3);
  return clamp(recall * accuracy * exposure, 0, 1);
}
export const strengthBand = (s) => (s <= 0 ? 'new' : s < 0.45 ? 'shaky' : s < 0.75 ? 'learning' : 'strong');

// ---------------------------------------------------------------------------
// Course progress
// ---------------------------------------------------------------------------
export const isDone = (state, id) => Boolean(state.lessons[id]?.done);
export const isUnlocked = (state, lesson) => lesson.index === 0 || isDone(state, lesson.id) || isDone(state, LESSONS[lesson.index - 1].id);
export const nextLesson = (state) => LESSONS.find((l) => !isDone(state, l.id)) || null;
export const doneSet = (state) => new Set(LESSONS.filter((l) => isDone(state, l.id)).map((l) => l.id));
export function unitProgress(state, unit) {
  const done = unit.lessons.filter((l) => isDone(state, l.id)).length;
  return { done, total: unit.lessons.length, complete: done === unit.lessons.length };
}
export const courseProgress = (state) => {
  const done = LESSONS.filter((l) => isDone(state, l.id)).length;
  return { done, total: LESSONS.length, fraction: done / LESSONS.length };
};
export const songsPlayed = (state) => LESSONS.filter((l) => l.kind === 'song' && isDone(state, l.id) && !state.lessons[l.id].skipped).length;

/** stars for a finished lesson: 3 = flawless */
export const starsFor = (mistakes) => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);

/**
 * Record a finished lesson.
 * result: {mistakes, total, seconds, mic}
 * Returns what the results screen needs to celebrate.
 */
export function completeLesson(state, lesson, result, now = Date.now()) {
  const today = dayKey(new Date(now));
  const mistakes = Math.max(0, result.mistakes | 0);
  const total = Math.max(1, result.total | 0);
  const accuracy = clamp((total - mistakes) / total, 0, 1);
  const stars = starsFor(mistakes);
  const bonus = mistakes === 0 ? 5 : mistakes <= 2 ? 2 : 0;
  const xp = lesson.xp + bonus;
  const before = state.lessons[lesson.id];
  const first = !before || !before.done || Boolean(before.skipped);
  state.lessons[lesson.id] = {
    done: (before?.done || 0) + 1,
    stars: Math.max(before?.stars || 0, stars),
    best: Math.max(before?.best || 0, accuracy),
    at: now,
  };
  state.stats.lessons++;
  if (mistakes === 0) state.stats.perfect++;
  if (result.mic) state.stats.micLessons++;
  state.stats.seconds += Math.max(0, Math.round(result.seconds || 0));
  const levelBefore = levelFor(state.xp).level;
  const { extended, goalReached } = addXp(state, xp, today);
  const level = levelFor(state.xp);
  return {
    xp, base: lesson.xp, bonus, stars, accuracy, mistakes, first,
    streakExtended: extended, streak: state.streak.count, goalReached,
    levelUp: level.level > levelBefore ? level : null,
    awards: grantAwards(state, now),
  };
}

/** Record a practice session (review, sprint, rhythm gym). */
export function completePractice(state, { xp, seconds = 0, sprintScore = null, mic = false }, now = Date.now()) {
  state.stats.practice++;
  state.stats.seconds += Math.max(0, Math.round(seconds));
  if (mic) state.stats.micLessons++;
  let record = false;
  if (sprintScore != null && sprintScore > state.stats.sprintBest) { state.stats.sprintBest = sprintScore; record = sprintScore > 0; }
  const levelBefore = levelFor(state.xp).level;
  const { extended, goalReached } = addXp(state, xp, dayKey(new Date(now)));
  const level = levelFor(state.xp);
  return { xp, record, streakExtended: extended, streak: state.streak.count, goalReached, levelUp: level.level > levelBefore ? level : null, awards: grantAwards(state, now) };
}

/** Jump ahead: mark every lesson before `unit` as done (used after passing a placement test). */
export function skipToUnit(state, unit, now = Date.now()) {
  for (const l of LESSONS) {
    if (l.unit.index >= unit.index) break;
    if (!isDone(state, l.id)) state.lessons[l.id] = { done: 1, stars: 0, best: 0, at: now, skipped: true };
  }
}

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------
const OPEN_NATURALS = parsePosList('1:0 1:1 1:3 2:0 2:1 2:3 3:0 3:2 4:0 4:2 4:3 5:0 5:2 5:3 6:0 6:1 6:3').map((n) => n.key);
const unitDone = (state, id) => unitProgress(state, UNITS.find((u) => u.id === id)).complete;

export const AWARDS = [
  { id: 'first-lesson', icon: 'rocket-launch', title: 'First Steps', text: 'Finish your first lesson', test: (s) => s.stats.lessons >= 1 },
  { id: 'streak-3', icon: 'fire', title: 'Warming Up', text: 'Practise 3 days in a row', test: (s) => s.streak.best >= 3 },
  { id: 'streak-7', icon: 'fire', title: 'A Week of Strings', text: 'Practise 7 days in a row', test: (s) => s.streak.best >= 7 },
  { id: 'streak-30', icon: 'fire', title: 'Daily Player', text: 'Practise 30 days in a row', test: (s) => s.streak.best >= 30 },
  { id: 'perfect-1', icon: 'sparkle', title: 'Clean Take', text: 'Finish a lesson without a single mistake', test: (s) => s.stats.perfect >= 1 },
  { id: 'perfect-10', icon: 'sparkle', title: 'Studio Ready', text: 'Finish 10 flawless lessons', test: (s) => s.stats.perfect >= 10 },
  { id: 'xp-100', icon: 'lightning', title: 'Charged Up', text: 'Earn 100 XP', test: (s) => s.xp >= 100 },
  { id: 'xp-500', icon: 'lightning', title: 'High Voltage', text: 'Earn 500 XP', test: (s) => s.xp >= 500 },
  { id: 'xp-2000', icon: 'lightning', title: 'Power Station', text: 'Earn 2000 XP', test: (s) => s.xp >= 2000 },
  { id: 'song-1', icon: 'music-notes', title: 'First Tune', text: 'Play your first song', test: (s) => songsPlayed(s) >= 1 },
  { id: 'song-8', icon: 'book-open', title: 'Setlist', text: 'Play 8 songs', test: (s) => songsPlayed(s) >= 8 },
  { id: 'six-strings', icon: 'guitar', title: 'Six-String Reader', text: 'Finish the Sixth String unit', test: (s) => unitDone(s, 'u6') },
  { id: 'open-naturals', icon: 'target', title: 'Open Position Pro', text: 'Get all 17 natural notes of the open position to “strong”', test: (s, now) => OPEN_NATURALS.every((k) => noteStrength(s, k, now) >= 0.75) },
  { id: 'sprint-20', icon: 'timer', title: 'Quick Eyes', text: 'Read 20 notes in a one-minute sprint', test: (s) => s.stats.sprintBest >= 20 },
  { id: 'sprint-35', icon: 'timer', title: 'Lightning Reader', text: 'Read 35 notes in a one-minute sprint', test: (s) => s.stats.sprintBest >= 35 },
  { id: 'mic', icon: 'microphone', title: 'Plugged In', text: 'Finish a lesson by playing your real guitar', test: (s) => s.stats.micLessons >= 1 },
  { id: 'graduate', icon: 'graduation-cap', title: 'Fretwise Graduate', text: 'Finish every lesson in the course', test: (s) => LESSONS.every((l) => isDone(s, l.id)) },
];

/** hand out any newly earned awards; returns the new ones */
export function grantAwards(state, now = Date.now()) {
  const fresh = [];
  for (const award of AWARDS) {
    if (state.awards[award.id]) continue;
    if (award.test(state, now)) { state.awards[award.id] = now; fresh.push(award); }
  }
  return fresh;
}

// ---------------------------------------------------------------------------
// Merging two copies of the same profile (two devices saved at the same time)
// ---------------------------------------------------------------------------
export function mergeStates(mine, theirs) {
  const a = normalize(JSON.parse(JSON.stringify(mine)));
  const b = normalize(theirs);
  for (const [day, xp] of Object.entries(b.days)) a.days[day] = Math.max(a.days[day] || 0, Number(xp) || 0);
  for (const [id, r] of Object.entries(b.lessons)) {
    const m = a.lessons[id];
    if (!m) { a.lessons[id] = r; continue; }
    const merged = { done: Math.max(m.done || 0, r.done || 0), stars: Math.max(m.stars || 0, r.stars || 0), best: Math.max(m.best || 0, r.best || 0), at: Math.max(m.at || 0, r.at || 0) };
    if (m.skipped && r.skipped) merged.skipped = true;
    a.lessons[id] = merged;
  }
  for (const [key, n] of Object.entries(b.notes)) { const m = a.notes[key]; if (!m || (n.seen || 0) > (m.seen || 0)) a.notes[key] = n; }
  for (const [id, at] of Object.entries(b.awards)) a.awards[id] = Math.min(a.awards[id] || Infinity, at);
  for (const k of Object.keys(a.stats)) a.stats[k] = Math.max(a.stats[k] || 0, b.stats[k] || 0);
  a.xp = Math.max(a.xp, b.xp);
  a.createdAt = Math.min(a.createdAt, b.createdAt);
  // rebuild the streak from the merged calendar
  const active = Object.keys(a.days).filter((d) => a.days[d] > 0).sort();
  if (active.length) {
    const lastDay = active.at(-1);
    let count = 1;
    for (let d = shiftDay(lastDay, -1); a.days[d] > 0; d = shiftDay(d, -1)) count++;
    a.streak = { count, lastDay, best: Math.max(a.streak.best, b.streak.best, count) };
  }
  return a;
}
