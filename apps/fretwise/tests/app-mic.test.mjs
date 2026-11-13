// End-to-end with a (pretend) microphone on a secure page: the player answers
// by playing notes on a guitar instead of tapping the screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp } from './support/driver.mjs';

const app = await bootApp({ microphone: true, secure: true });
const { env, store, session, $, need, click, go, settle } = app;
test.after(() => app.close());

test('switching to "my guitar" asks for the microphone and shows a live check', async () => {
  await go('/settings');
  await click('.segmented button[data-value="mic"]');
  await settle(100);
  assert.match(need('.modal').textContent, /Microphone check/);
  assert.equal(env.micTracks.length, 1, 'the microphone was opened');
  env.mic.play(64); // open first string
  await settle(400);
  assert.match(need('.modal .tuner-note').textContent, /^E$/);
  env.mic.play(54); // F sharp on the fourth string
  await settle(400);
  assert.match(need('.modal .tuner-note').textContent, /^F♯$/);
  await click('.modal .btn');
  env.mic.silence();
  const { prefs } = await import('../public/js/prefs.js');
  assert.equal(prefs.get('input'), 'mic');
  env.assertNoErrors();
});

test('a lesson played on the guitar: right notes, a wrong octave, a wrong note', async () => {
  await go('/lesson/u1-1');
  await settle(50);
  assert.equal(session.active.input, 'mic');
  let sawFind = false, sawPhrase = false, failedOne = false;
  for (let guard = 0; session.active && guard < 100; guard++) {
    const ex = session.active.current;
    if (ex.type === 'find' && !sawFind) {
      sawFind = true;
      assert.match(need('.prompt').textContent, /Play this note on your guitar/);
      // the right letter in the wrong octave is pointed out, not punished
      env.mic.play(ex.note.sounding - 12);
      await settle(450);
      assert.match(need('.listen-hint').textContent, /different octave/);
      assert.equal(session.active.waiting, false);
      env.mic.silence();
      await settle(250);
      await app.answer(true);
      assert.match(need('.lesson-foot').getAttribute('class'), /is-good/);
    } else if (ex.type === 'find' && !failedOne) {
      failedOne = true;
      await app.answer(false); // two clearly wrong notes
      assert.match(need('.lesson-foot').getAttribute('class'), /is-bad/);
      assert.match(need('.lesson-foot').textContent, /Answer:/);
    } else {
      if (ex.type === 'phrase') { sawPhrase = true; assert.match(need('.prompt').textContent, /Play this on your guitar/); }
      await app.answer(true);
    }
    env.mic.silence();
    await app.proceed();
  }
  env.assertNoErrors();
  assert.ok(sawFind && sawPhrase && failedOne);
  assert.match(need('.results').textContent, /Plugged In/);
  assert.equal(store.state.stats.micLessons, 1);
  assert.equal(store.state.lessons['u1-1'].stars, 2);
  await click('.results .continue');
});

test('the player can fall back to the on-screen fretboard mid-lesson', async () => {
  await go('/lesson/u1-2');
  await settle(50);
  for (let guard = 0; guard < 30 && session.active.current.type !== 'find'; guard++) { await app.answer(true); await app.proceed(); }
  assert.equal(session.active.input, 'mic');
  await click('.listen .btn');
  assert.equal(session.active.input, 'tap');
  assert.ok($('.fretboard'), 'the fretboard is shown instead');
  await app.playLesson();
  assert.match(need('.results h1').textContent, /Flawless|complete/);
  await click('.results .continue');
});

test('the tuner reads a slightly flat string and a string that is in tune', async () => {
  await go('/tuner');
  await click('.start-tuner');
  await settle(100);
  env.mic.play(44.8); // the A string, 20 cents flat
  await settle(500);
  assert.match(need('.tuner-note').textContent, /^A$/);
  assert.match(need('.tuner-detail').textContent, /String 5: (1[89]|2[012]) cents flat/);
  assert.equal(need('.tuner-face').classList.contains('is-tuned'), false);
  env.mic.silence();
  await settle(300);
  env.mic.play(40); // low E, in tune
  await settle(500);
  assert.match(need('.tuner-detail').textContent, /String 6 is in tune/);
  assert.equal(need('.tuner-face').classList.contains('is-tuned'), true);
  const live = env.micTracks.filter((t) => !t.stopped).length;
  assert.equal(live, 1);
  await go('/practice');
  assert.equal(env.micTracks.filter((t) => !t.stopped).length, 0, 'the microphone is released when leaving');
  env.assertNoErrors();
});

test('a refused microphone falls back gracefully', async () => {
  env.micPermission = 'denied';
  await go('/lesson/u1-2');
  await settle(100);
  assert.match([...env.document.querySelectorAll('.toast')].at(-1).textContent, /microphone is not available/i);
  assert.equal(session.active.input, 'tap');
  await click('.quit');
  await settle(30);
  await go('/settings');
  await click('.segmented button[data-value="tap"]');
  await click('.segmented button[data-value="mic"]');
  await settle(100);
  assert.match([...env.document.querySelectorAll('.toast')].at(-1).textContent, /permission was refused/i);
  assert.equal(need('.segmented button[data-value="tap"]').getAttribute('aria-pressed'), 'true');
  env.assertNoErrors();
});
