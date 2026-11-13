import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  newState, normalize, levelFor, addXp, todayXp, streakNow, practisedToday, recentDays, recordNote, noteStrength, strengthBand,
  isDone, isUnlocked, nextLesson, unitProgress, courseProgress, completeLesson, completePractice, skipToUnit, mergeStates, AWARDS, grantAwards, songsPlayed, starsFor,
} from '../public/js/progress.js';
import { LESSONS, UNITS, lessonById } from '../public/js/curriculum.js';
import { ICONS } from '../public/js/icons.js';
import { judgeTaps } from '../public/js/exercises.js';

const DAY = 86400000;
const at = (iso) => new Date(iso).getTime();

test('a new player starts clean, and damaged saves are repaired', () => {
  const s = newState();
  assert.equal(s.xp, 0);
  assert.equal(s.avatar, undefined, 'no colour to pick');
  assert.equal(normalize(null).name, 'Player');
  const fixed = normalize({ name: 'Bo', avatar: { tone: 'pink' }, xp: 'lots', days: null, streak: { count: 3 }, settings: { goal: 50 }, stats: { lessons: 4 } });
  assert.equal(fixed.xp, 0);
  assert.deepEqual(fixed.days, {});
  assert.equal(fixed.streak.count, 3);
  assert.equal(fixed.streak.lastDay, null);
  assert.equal(fixed.settings.goal, 50);
  assert.equal(fixed.settings.leftHanded, false, 'missing settings get their defaults');
  assert.equal(fixed.avatar, undefined);
  assert.equal(newState().settings.hearts, undefined, 'there are no hearts');
  assert.equal('hearts' in normalize({ settings: { hearts: true, goal: 30 } }).settings, false, 'an old save with hearts still loads');
  assert.equal(normalize({ settings: { hearts: false, goal: 30 } }).settings.goal, 30);
  assert.equal(fixed.stats.lessons, 4);
  assert.equal(fixed.stats.answers, 0);
});

test('levels need a little more XP each time', () => {
  assert.deepEqual([0, 59, 60, 139, 140, 240].map((xp) => levelFor(xp).level), [1, 1, 2, 2, 3, 4]);
  const l = levelFor(100);
  assert.equal(l.into, 40);
  assert.equal(l.need, 80);
  assert.ok(levelFor(100000).title);
});

test('streak: grows on consecutive days, survives until midnight, resets after a gap', () => {
  const s = newState();
  s.settings.goal = 20;
  let r = addXp(s, 10, '2026-03-30');
  assert.deepEqual([r.extended, r.goalReached, s.streak.count], [true, false, 1]);
  r = addXp(s, 10, '2026-03-30');
  assert.deepEqual([r.extended, r.goalReached, s.streak.count], [false, true, 1], 'the goal is announced exactly once');
  r = addXp(s, 5, '2026-03-30');
  assert.equal(r.goalReached, false);
  assert.equal(todayXp(s, '2026-03-30'), 25);
  addXp(s, 10, '2026-03-31');
  addXp(s, 10, '2026-04-01'); // across a month end
  assert.equal(s.streak.count, 3);
  assert.equal(streakNow(s, '2026-04-01'), 3);
  assert.equal(streakNow(s, '2026-04-02'), 3, 'still alive the next day, until that day ends');
  assert.equal(practisedToday(s, '2026-04-02'), false);
  assert.equal(streakNow(s, '2026-04-03'), 0, 'a missed day breaks it');
  addXp(s, 10, '2026-04-05');
  assert.equal(s.streak.count, 1);
  assert.equal(s.streak.best, 3);
  const week = recentDays(s, 7, '2026-04-05');
  assert.equal(week.length, 7);
  assert.deepEqual(week.map((d) => d.xp), [25, 10, 10, 0, 0, 0, 10]);
  assert.deepEqual(week.map((d) => d.met), [true, false, false, false, false, false, false]);
});

test('note memory: one sitting is not mastery; spaced practice is', () => {
  const s = newState();
  const t0 = at('2026-01-01T10:00:00');
  assert.equal(noteStrength(s, 's1f0', t0), 0);
  assert.equal(strengthBand(0), 'new');
  recordNote(s, 's1f0', true, 1800, t0);
  const once = noteStrength(s, 's1f0', t0);
  assert.ok(once > 0.3 && once < 0.75, `one correct answer is "learning" at best (${once})`);
  // a dozen correct answers in the same sitting
  for (let i = 1; i <= 12; i++) recordNote(s, 's1f0', true, 1800, t0 + i * 20000);
  const t1 = t0 + 12 * 20000;
  assert.equal(strengthBand(noteStrength(s, 's1f0', t1)), 'strong', 'fresh in mind right after the lesson');
  assert.ok(s.notes.s1f0.hl < 2.1, `cramming leaves a short review interval (${s.notes.s1f0.hl} days)`);
  assert.notEqual(strengthBand(noteStrength(s, 's1f0', t1 + 2 * DAY)), 'strong', 'two days later it wants a review');
  // coming back on later days stretches the interval each time
  let t = t1;
  const intervals = [];
  for (const gap of [1, 2, 4, 7]) { t += gap * DAY; recordNote(s, 's1f0', true, 1800, t); intervals.push(s.notes.s1f0.hl); }
  assert.ok(intervals.every((v, i) => i === 0 || v > intervals[i - 1] * 1.4), `intervals grow: ${intervals.map((v) => v.toFixed(1))}`);
  assert.ok(s.notes.s1f0.hl > 14, 'after four spaced reviews the note is good for weeks');
  assert.equal(strengthBand(noteStrength(s, 's1f0', t + 5 * DAY)), 'strong');
  assert.ok(noteStrength(s, 's1f0', t + 200 * DAY) < 0.45, 'it still fades after months without practice');
  const before = noteStrength(s, 's1f0', t + DAY);
  const interval = s.notes.s1f0.hl;
  recordNote(s, 's1f0', false, 0, t + DAY);
  assert.ok(noteStrength(s, 's1f0', t + DAY) < before);
  assert.ok(s.notes.s1f0.hl < interval / 2, 'a miss shortens the review interval');
  assert.equal(s.stats.answers, 18);
  assert.equal(s.stats.correct, 17);
  assert.ok(s.notes.s1f0.ms > 0);
  // saves from the first version are brought back to a sensible interval
  const old = normalize({ name: 'old', v: 1, notes: { s1f0: { seen: 13, right: 13, run: 13, hl: 90, at: t0, ms: 2000 }, s1f1: { seen: 2, right: 1, run: 0, hl: 0.4, at: t0, ms: 0 } } });
  assert.equal(old.notes.s1f0.hl, 2);
  assert.equal(old.notes.s1f1.hl, 0.4);
  assert.equal(old.v, 2);
  assert.equal(normalize({ name: 'new', v: 2, notes: { s1f0: { seen: 9, right: 9, run: 9, hl: 30, at: t0, ms: 0 } } }).notes.s1f0.hl, 30);
});

test('finishing lessons: XP, stars, unlocking, replay keeps the best result', () => {
  const s = newState();
  const now = at('2026-05-01T18:00:00');
  assert.equal(nextLesson(s).id, 'u1-1');
  assert.equal(isUnlocked(s, LESSONS[0]), true);
  assert.equal(isUnlocked(s, LESSONS[1]), false);
  let r = completeLesson(s, LESSONS[0], { mistakes: 0, total: 14, seconds: 150 }, now);
  assert.deepEqual([r.xp, r.bonus, r.stars, r.first, r.streakExtended], [15, 5, 3, true, true]);
  assert.deepEqual(r.awards.map((a) => a.id), ['first-lesson', 'perfect-1']);
  assert.equal(isUnlocked(s, LESSONS[1]), true);
  assert.equal(nextLesson(s).id, 'u1-2');
  r = completeLesson(s, LESSONS[0], { mistakes: 4, total: 14, seconds: 100 }, now + 1000);
  assert.deepEqual([r.xp, r.stars, r.first], [10, 1, false]);
  assert.equal(s.lessons['u1-1'].stars, 3, 'a worse replay does not lose stars');
  assert.equal(s.lessons['u1-1'].done, 2);
  assert.equal(s.xp, 25);
  assert.equal(s.stats.lessons, 2);
  assert.equal(s.stats.seconds, 250);
  assert.deepEqual([starsFor(0), starsFor(2), starsFor(3)], [3, 2, 1]);
  assert.deepEqual(unitProgress(s, UNITS[0]), { done: 1, total: 4, complete: false });
  assert.equal(courseProgress(s).done, 1);
  const song = lessonById('u2-3');
  assert.equal(completeLesson(s, song, { mistakes: 1, total: 5, seconds: 90 }, now).xp, 17);
  assert.equal(songsPlayed(s), 1);
  assert.ok(s.awards['song-1']);
});

test('practice rounds, sprint records and jumping ahead', () => {
  const s = newState();
  const now = at('2026-05-01T18:00:00');
  let r = completePractice(s, { xp: 8, seconds: 60, sprintScore: 21 }, now);
  assert.deepEqual([r.xp, r.record, r.streakExtended], [8, true, true]);
  assert.ok(r.awards.some((a) => a.id === 'sprint-20'));
  r = completePractice(s, { xp: 6, seconds: 60, sprintScore: 12 }, now);
  assert.equal(r.record, false);
  assert.equal(s.stats.sprintBest, 21);
  skipToUnit(s, UNITS[3], now);
  assert.equal(nextLesson(s).id, 'u4-1');
  assert.ok(LESSONS.filter((l) => l.unit.index < 3).every((l) => isDone(s, l.id) && s.lessons[l.id].skipped));
  assert.equal(songsPlayed(s), 0, 'skipped songs do not count as played');
  completeLesson(s, lessonById('u2-3'), { mistakes: 0, total: 5, seconds: 60 }, now);
  assert.equal(s.lessons['u2-3'].skipped, undefined, 'playing a skipped lesson makes it a real result');
  assert.equal(songsPlayed(s), 1);
});

test('every award is well formed and can actually be earned', () => {
  assert.equal(new Set(AWARDS.map((a) => a.id)).size, AWARDS.length);
  for (const a of AWARDS) assert.ok(ICONS[a.icon] && a.title && a.text, a.id);
  const s = newState();
  const now = at('2026-06-01T12:00:00');
  assert.deepEqual(grantAwards(s, now), []);
  for (const l of LESSONS) completeLesson(s, l, { mistakes: 0, total: 10, seconds: 60, mic: true }, now);
  s.streak.best = 30;
  s.stats.sprintBest = 40;
  s.xp = 5000;
  for (const key of ['s1f0', 's1f1', 's1f3', 's2f0', 's2f1', 's2f3', 's3f0', 's3f2', 's4f0', 's4f2', 's4f3', 's5f0', 's5f2', 's5f3', 's6f0', 's6f1', 's6f3']) {
    for (let i = 0; i < 5; i++) recordNote(s, key, true, 1500, now);
  }
  grantAwards(s, now);
  assert.deepEqual(AWARDS.filter((a) => !s.awards[a.id]).map((a) => a.id), []);
});

test('merging two copies of a profile keeps the best of both', () => {
  const base = newState();
  completeLesson(base, LESSONS[0], { mistakes: 2, total: 10, seconds: 60 }, at('2026-07-01T10:00:00'));
  const phone = JSON.parse(JSON.stringify(base)), tablet = JSON.parse(JSON.stringify(base));
  completeLesson(phone, LESSONS[1], { mistakes: 0, total: 10, seconds: 60 }, at('2026-07-02T10:00:00'));
  recordNote(phone, 's1f3', true, 1000, at('2026-07-02T10:00:00'));
  completeLesson(tablet, LESSONS[0], { mistakes: 0, total: 10, seconds: 60 }, at('2026-07-03T10:00:00'));
  tablet.settings.goal = 50;
  const merged = mergeStates(tablet, phone);
  assert.equal(merged.lessons['u1-1'].stars, 3);
  assert.ok(merged.lessons['u1-2'].done);
  assert.equal(merged.settings.goal, 50, 'settings come from the device doing the merge');
  assert.deepEqual(Object.keys(merged.days).sort(), ['2026-07-01', '2026-07-02', '2026-07-03']);
  assert.deepEqual([merged.streak.count, merged.streak.lastDay], [3, '2026-07-03'], 'the streak is rebuilt from the combined calendar');
  assert.ok(merged.notes.s1f3);
  assert.ok(merged.xp >= Math.max(phone.xp, tablet.xp));
  assert.deepEqual(mergeStates(base, base).lessons, base.lessons, 'merging identical copies changes nothing');
});

test('rhythm judging: forgiving about a steady delay, strict about the rhythm', () => {
  const beat = 60 / 72;
  const expected = [0, 1, 2, 2.5, 3].map((b) => b * beat); // quarter quarter eighth eighth quarter
  const ok = (taps, opts) => judgeTaps(expected, taps, opts);
  assert.equal(ok(expected).correct, true);
  assert.equal(ok(expected.map((t) => t + 0.12)).correct, true, 'a constant 120 ms lag is latency, not a mistake');
  assert.ok(Math.abs(ok(expected.map((t) => t + 0.12)).shift - 0.12) < 0.01);
  assert.equal(ok(expected.map((t) => t - 0.07)).correct, true, 'tapping slightly ahead of the beat is fine too');
  const jitter = [0.03, -0.04, 0.02, -0.03, 0.04];
  assert.equal(ok(expected.map((t, i) => t + jitter[i])).correct, true);
  assert.equal(ok(expected.slice(0, 4)).correct, false, 'a missing note');
  assert.equal(ok(expected.slice(0, 4)).misses, 1);
  assert.equal(ok([...expected, 1.5 * beat]).correct, true, 'one stray tap is forgiven');
  assert.equal(ok([...expected, 1.5 * beat, 0.5 * beat]).correct, false, 'two stray taps are not');
  assert.equal(ok([0, 1, 2, 3].map((b) => b * beat)).correct, false, 'quarters instead of the eighth pair');
  assert.equal(ok([-2 * beat, -beat, ...expected]).correct, true, 'taps during the count-in are ignored');
  assert.equal(ok([]).correct, false);
  const long = Array.from({ length: 10 }, (_, i) => i * beat * 0.5);
  assert.equal(judgeTaps(long, long.slice(0, 9)).correct, true, 'one slip is allowed in a long pattern');
  assert.equal(judgeTaps(long, long.slice(0, 8)).correct, false);
  // sixteenth notes at a slow tempo: neighbouring notes must not be confused with each other
  const sixteenths = [0, 0.25, 0.5, 0.75, 1].map((b) => b * (60 / 56));
  assert.equal(judgeTaps(sixteenths, sixteenths.map((t) => t + 0.05)).correct, true);
  assert.equal(judgeTaps(sixteenths, [sixteenths[0], sixteenths[2], sixteenths[4]]).correct, false);
});

test('no module imports something it does not use', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js');
  const unused = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const body = src.replace(/import\s*\{[^}]*\}\s*from\s*'[^']+';/g, '').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, names] of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']+';/g)) {
      for (const part of names.split(',').map((x) => x.trim()).filter(Boolean)) {
        const local = part.split(/\s+as\s+/).pop();
        if (!new RegExp(`(^|[^\\w$.])${local.replace(/\$/g, '\\$')}\\b`).test(body)) unused.push(`${file}: ${local}`);
      }
    }
  }
  assert.deepEqual(unused, []);
});
