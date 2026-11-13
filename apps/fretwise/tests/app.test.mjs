// End-to-end: the real app code, a real server, a stand-in browser.
// One long story told in order — each step builds on the one before.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootApp, classesOnScreen, httpFetch } from './support/driver.mjs';
import { LESSONS } from '../public/js/curriculum.js';

const app = await bootApp({ startDate: '2026-11-13T09:00:00' });
const { env, store, session, $, $$, need, click, go, settle, playLesson } = app;
const seen = new Set();
// called on many screens: remember the classes in use, and make sure no value leaked into the page unformatted
const note = () => {
  for (const c of classesOnScreen(env)) seen.add(c);
  const html = env.document.body.innerHTML;
  for (const bad of ['undefined', 'NaN', '[object', '>null<', '="null"', 'Infinity']) {
    const i = html.indexOf(bad);
    assert.equal(i, -1, `"${bad}" appears in the page: …${html.slice(Math.max(0, i - 120), i + 60)}…`);
  }
};
test.after(() => app.close());

test('a new visitor lands straight on the map: no name, no setup', async () => {
  assert.ok(store.state, 'progress exists without anyone asking');
  assert.doesNotMatch(app.screen(), /Welcome|Who is playing/i);
  assert.equal($('.input'), null, 'nothing to type');
  assert.match(need('.today h1').textContent, /^(Good (morning|afternoon|evening)|Still up)!$/);
  assert.equal(store.state.settings.goal, 20);
  assert.equal($$('.unit').length, 10);
  assert.equal($$('.node').length, LESSONS.length);
  assert.equal($$('.node.is-next').length, 1);
  assert.equal($$('.node.is-locked').length, LESSONS.length - 1);
  note();
  await settle(600);
  const saved = await app.serverProfile();
  assert.equal(saved.state.xp, 0, 'the new progress reached the server');
  assert.equal((await httpFetch(`http://127.0.0.1:${app.port}/api/profiles`).then((r) => r.json())).length, 1);
  await click('.tab[href="#/settings"]');
  await click('.segmented button[data-value="30"]');
  assert.equal(store.state.settings.goal, 30, 'the daily goal is chosen in Settings');
  await go('/');
});

test('a locked lesson explains itself; the first lesson starts from the map', async () => {
  await click('.node[data-lesson="u1-2"]');
  assert.match(need('.modal').textContent, /Finish .E and F. to unlock/);
  note();
  await click('.modal .btn');
  assert.equal($('.modal'), null);
  await click('.node[data-lesson="u1-1"]');
  assert.match(need('.modal').textContent, /Lesson 1 of 4/);
  await click('.start-lesson');
  await settle(30);
  assert.ok(session.active, 'the lesson is running');
  assert.equal(session.active.current.type, 'intro');
  note();
});

test('a flawless first lesson: teaching cards, single notes and phrases, results, saving', async () => {
  const kinds = new Set();
  for (let guard = 0; session.active && guard < 100; guard++) {
    kinds.add(session.active.current.type);
    note();
    await app.answer(true);
    note();
    await app.proceed();
  }
  env.assertNoErrors();
  assert.deepEqual([...kinds].sort(), ['find', 'intro', 'phrase'], 'lesson one is cards, single notes and phrases');
  assert.match(need('.results h1').textContent, /Flawless/);
  assert.match(need('.hero-xp').textContent, /\+15/);
  assert.match(need('.results').textContent, /1 day streak/);
  assert.match(need('.results').textContent, /Award: First Steps/);
  assert.match(need('.results').textContent, /Award: Clean Take/);
  note();
  assert.equal(store.state.lessons['u1-1'].stars, 3);
  assert.equal(store.state.xp, 15);
  assert.equal(store.state.streak.count, 1);
  assert.ok(Object.keys(store.state.notes).length >= 2, 'note memory was recorded');
  assert.ok(env.audioContexts.length === 1 && env.audioContexts[0].log.length > 10, 'sounds were played');
  await click('.results .continue');
  await settle(30);
  assert.equal($$('.node.is-done').length, 1);
  assert.equal(need('.node.is-next').dataset.lesson, 'u1-2');
  assert.match(need('.topbar').textContent, /15\/30/);
  const saved = await app.serverProfile();
  assert.equal(saved.state.xp, 15, 'progress reached the server');
  assert.ok(saved.rev >= 2);
});

test('mistakes come back at the end and lower the stars', async () => {
  await go('/lesson/u1-2');
  const log = await playLesson({ mistakes: 2 });
  assert.equal(log.filter((x) => x.endsWith('!')).length, 2);
  assert.equal(log.filter((x) => x.includes('(retry)')).length, 2, 'both misses were asked again');
  assert.match(need('.results h1').textContent, /Lesson complete/);
  assert.equal(store.state.lessons['u1-2'].stars, 2);
  assert.equal(store.state.xp, 15 + 12);
  await click('.results .continue');
});

test('a lesson with many mistakes still completes; there are no hearts', async () => {
  await go('/lesson/u1-3');
  assert.equal($('.hearts'), null);
  const log = await playLesson({ mistakes: 8 });
  assert.ok(log.filter((x) => x.endsWith('!')).length >= 5, 'more than five wrong answers');
  assert.equal($('.results-failed'), null);
  assert.match(need('.results h1').textContent, /Lesson complete/);
  assert.ok(store.state.lessons['u1-3'].done, 'the lesson counted');
  await click('.results .continue');
  await go('/lesson/u1-3');
  const again = await playLesson();
  assert.ok(again.filter((x) => x === 'rhythmTap').length >= 5 && again.every((x) => x === 'intro' || x === 'rhythmTap'), `rhythm lesson is all rhythms (${again})`);
  assert.match(need('.results h1').textContent, /Flawless/);
  assert.equal(store.state.lessons['u1-3'].stars, 3);
  await click('.results .continue');
});

test('badly timed taps are caught', async () => {
  await go('/lesson/u1-3');
  let played = 0;
  for (let guard = 0; session.active && guard < 60; guard++) {
    const ex = session.active.current;
    if (ex.type === 'rhythmTap' && played++ === 1) { // the second rhythm is tapped badly
      await app.answer(false);
      assert.match(need('.lesson-foot').getAttribute('class'), /is-bad/);
      assert.match(need('.lesson-foot').textContent, /missed|extra|drift/i);
      note();
      break;
    }
    await app.answer(true);
    await app.proceed();
  }
  // leave through the quit button and its confirmation
  await click('.quit');
  assert.match(need('.modal').textContent, /Leave this lesson/);
  await click('.modal .btn-bad');
  await settle(30);
  assert.equal(session.active, null);
  assert.ok($('.home'));
});

test('melody lesson, then a song: Mary Had a Little Lamb', async () => {
  await go('/lesson/u1-4');
  const log = await playLesson();
  assert.ok(log.filter((x) => x === 'phrase').length >= 5 && log.every((x) => x === 'phrase' || x === 'phrase(retry)'), String(log));
  await click('.results .continue');
  for (const id of ['u2-1', 'u2-2']) { await go(`/lesson/${id}`); await playLesson(); await click('.results .continue'); }
  await go('/lesson/u2-3');
  const song = await playLesson({ mistakes: 1 });
  assert.match(need('.results h1').textContent, /You played Mary Had a Little Lamb/);
  assert.match(need('.results').textContent, /First Tune/);
  assert.ok(song.filter((x) => x.startsWith('phrase')).length >= 5);
  note();
  await click('.results .continue');
});

test('the tabs: practice, profile, settings all render', async () => {
  await click('.tab[href="#/practice"]');
  assert.match(app.screen(), /Review weak notes/);
  assert.equal($$('.link-card').length, 5);
  note();
  await click('.tab[href="#/me"]');
  assert.match(need('.profile').textContent, /Level \d/);
  assert.equal($$('.week .day').length, 7);
  assert.equal($$('.week .day.is-met').length, 1, 'today reached the goal');
  assert.ok($$('.fb-mark').length >= 6, 'the memory map shows the learned notes');
  assert.equal($$('.award.is-earned').length, Object.keys(store.state.awards).length);
  note();
  await click('.tab[href="#/settings"]');
  assert.match(need('.settings').textContent, /Daily goal/);
  assert.match(need('.addresses').textContent, new RegExp(`:${app.port}`));
  note();
});

test('settings are saved; microphone mode explains why it needs the secure address', async () => {
  assert.doesNotMatch(need('.settings').textContent, /heart/i);
  const switches = $$('.settings .switch');
  await click(switches[1]); // left-handed on
  assert.equal(store.state.settings.leftHanded, true);
  await click('.segmented button[data-value="50"]');
  assert.equal(store.state.settings.goal, 50);
  await click('.segmented button[data-value="dark"]');
  assert.equal(env.document.documentElement.getAttribute('data-theme'), 'dark');
  await click('.segmented button[data-value="auto"]');
  assert.equal(env.document.documentElement.getAttribute('data-theme'), null);
  await click('.segmented button[data-value="mic"]');
  await settle(50);
  assert.match(need('.modal').textContent, /secure \(https\) connection/);
  assert.match(need('.modal .link').getAttribute('href'), /^https:\/\/127\.0\.0\.1:8421\/\?p=player-/);
  note();
  await click('.modal .btn');
  assert.equal(need('.segmented button[data-value="tap"]').getAttribute('aria-pressed'), 'true', 'falls back to the fretboard');
  await settle(600);
  const saved = await app.serverProfile();
  assert.equal(saved.state.settings.leftHanded, true);
  assert.equal(saved.state.settings.goal, 50);
  await click(switches[1]);
  await click('.segmented button[data-value="30"]');
});

test('practice: review round', async () => {
  await go('/review');
  assert.ok(session.active);
  const log = await playLesson();
  assert.equal(log.length, 10);
  assert.match(need('.results h1').textContent, /Review complete/);
  await click('.results .continue');
  await settle(30);
  assert.ok($('.practice'));
});

test('practice: one-minute sprint keeps score against the clock', async () => {
  await go('/sprint');
  assert.match(app.screen(), /One-minute sprint/);
  note();
  await click('.go');
  await settle(20);
  let answered = 0;
  for (let i = 0; i < 14; i++) {
    await app.answer(i !== 5); // one deliberate miss
    answered++;
    await settle(i === 5 ? 1400 : 320);
    note();
  }
  assert.match(need('.sprint-top').textContent, /13/);
  await settle(61000);
  assert.match(need('.results h1').textContent, /13 notes in a minute/);
  assert.match(need('.results').textContent, /New personal best/);
  assert.equal(store.state.stats.sprintBest, 13);
  assert.equal(answered, 14);
  await click('.results .continue');
});

test('practice: rhythm gym, songbook and the song player', async () => {
  await go('/rhythm');
  await click('.go');
  await settle(30);
  const log = await playLesson();
  assert.deepEqual(log, Array(6).fill('rhythmTap'));
  await click('.results .continue');
  await go('/songs');
  assert.equal($$('.song-list .link-card').length, LESSONS.filter((l) => l.kind === 'song').length);
  assert.equal($$('.song-list .link-card.is-locked').length, $$('.song-list .link-card').length - 1);
  note();
  await click('.link-card[data-song="jingle-bells"]');
  assert.match(need('.toast').textContent, /Finish .Jingle Bells./);
  await click('.link-card[data-song="mary-lamb"]');
  await settle(30);
  assert.match(need('.song').textContent, /Mary Had a Little Lamb/);
  note();
  const before = env.audioContexts[0].log.length;
  await click('.play-song');
  await settle(1500);
  assert.ok(env.audioContexts[0].log.length - before >= 20, 'the tune was scheduled');
  assert.equal(need('.play-song').hidden, true);
  assert.notEqual(need('.staff .playhead').style.display, 'none', 'the playhead is moving');
  await click('.stop-song');
  assert.equal(need('.play-song').hidden, false);
  await click('.practise-song');
  await settle(30);
  await playLesson();
  assert.match(need('.results h1').textContent, /You played Mary Had a Little Lamb/);
  await click('.results .continue');
  await settle(30);
  assert.ok($('.song'), 'back on the song page');
});

test('the tuner needs a secure page and says so', async () => {
  await go('/tuner');
  note();
  await click('.start-tuner');
  assert.match(need('.modal').textContent, /secure/);
  await click('.modal .btn');
});

test('coming back the next day extends the streak; skipping a day resets it', async () => {
  env.clock.setDate('2026-11-14T08:00:00');
  await go('/');
  assert.match(need('.today').textContent, /keep your 1 day streak/);
  await go('/lesson/u2-4');
  await playLesson();
  assert.match(need('.results').textContent, /2 days streak/);
  assert.equal(store.state.streak.count, 2);
  await click('.results .continue');
  env.clock.setDate('2026-11-17T08:00:00');
  await go('/me');
  assert.match(need('.kpis-grid .kpi').textContent, /^0/, 'the streak shows as broken');
  await go('/');
  assert.match(need('.today').textContent, /new streak/);
});

test('jumping ahead with a placement test', async () => {
  await click('#unit-u4 .jump');
  assert.match(need('.modal').textContent, /short test/);
  await click('.start-jump');
  await settle(30);
  let log = await playLesson({ mistakes: 4 });
  assert.equal(log.filter((x) => !x.includes('retry')).length, 10);
  assert.match(need('.results-failed').textContent, /4 mistakes/);
  await click('.retry');
  await settle(30);
  log = await playLesson({ mistakes: 1 });
  assert.match(need('.results h1').textContent, /Fourth String unlocked/);
  await click('.results .continue');
  await settle(30);
  assert.equal(need('.node.is-next').dataset.lesson, 'u4-1', 'everything before unit four now counts as known');
  assert.equal($('#unit-u4 .jump'), null);
  assert.ok(store.state.lessons['u3-5'].skipped);
  await click('.node[data-lesson="u4-1"]');
  await click('.start-lesson');
  await settle(30);
  assert.ok(session.active, 'unit four can be started');
  await click('.quit');
  await settle(30);
});

test('progress made on another device shows up when this one wakes', async () => {
  await go('/');
  const doc = await app.serverProfile();
  doc.state.xp += 500;
  const res = await fetch(`http://127.0.0.1:${app.port}/api/profiles/${store.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rev: doc.rev, state: doc.state }) });
  assert.equal(res.status, 200);
  env.fire(env.window, 'focus', { bubbles: false });
  await settle(300);
  assert.equal(store.state.xp, doc.state.xp);
});

test('two devices saving at once are merged, not overwritten', async () => {
  const doc = await app.serverProfile();
  doc.state.lessons['u2-5'] = { done: 1, stars: 3, best: 1, at: 1 };
  await fetch(`http://127.0.0.1:${app.port}/api/profiles/${store.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rev: doc.rev, state: doc.state }) });
  store.update((st) => { st.settings.goal = 10; }); // this device still has the old revision
  await settle(1500);
  const merged = await app.serverProfile();
  assert.equal(merged.state.settings.goal, 10, 'this device’s change survived');
  assert.equal(merged.state.lessons['u2-5'].stars, 3, 'the other device’s lesson survived');
  assert.equal(store.unsaved, false);
});

test('reset progress asks first, then starts the stats over in the same document', async () => {
  await go('/settings');
  assert.doesNotMatch(need('.settings').textContent, /Switch player|Delete/);
  const id = store.id;
  const xp = store.state.xp;
  const goal = store.state.settings.goal;
  assert.ok(xp > 500);
  await click('.reset-progress');
  note();
  await click('.modal .btn-soft'); // the "no" button
  assert.equal(store.state.xp, xp, 'cancelling keeps everything');
  await click('.reset-progress');
  await click('.modal .btn-bad');
  await settle(600);
  assert.equal(store.id, id, 'same document');
  assert.equal(store.state.xp, 0);
  assert.deepEqual(store.state.lessons, {});
  assert.equal(store.state.settings.goal, goal, 'settings survive');
  assert.equal($$('.node.is-locked').length, LESSONS.length - 1, 'back at the start of the map');
  const saved = await app.serverProfile();
  assert.equal(saved.state.xp, 0);
  assert.equal((await httpFetch(`http://127.0.0.1:${app.port}/api/profiles`).then((r) => r.json())).length, 1);
});

test('every class the app puts on screen has a style rule (or is a known hook)', () => {
  const css = fs.readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');
  const styled = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  // classes that exist only so scripts and tests can find an element
  const hooks = new Set(['quit', 'continue', 'next', 'start', 'retry', 'go', 'back', 'hear', 'start-lesson', 'start-jump', 'cta-icon',
    'reset-progress', 'play-song', 'stop-song', 'practise-song', 'start-tuner', 'home', 'system', 'clef', 'keysig', 'timesig', 'beam',
    'staff-line', 'ledger', 'stem', 'barline', 'tie', 'rest', 'btn-primary', 'btn-label', 'ex-intro', 'ex-name', 'ex-find', 'ex-phrase', 'ex-rhythm', 'banner', 'results-failed', 'choice-note',
    'is-show', 'is-pick', 'is-open', 'is-done', 'is-earned-none', 'practice', 'songs', 'song', 'tuner', 'sprint', 'rhythm-gym', 'profile', 'settings',
    'me', 'ring-goal', 'unit-title', 'link-text', 'results-main', 'fb-cells', 'today-text', 'me-text', 'award', 'day', 'legend', 'unit']);
  const missing = [...seen].filter((c) => !styled.has(c) && !hooks.has(c)).sort();
  assert.deepEqual(missing, [], `classes without any CSS rule: ${missing.join(', ')}`);
  assert.ok(seen.size > 150, `saw ${seen.size} classes`);
});
