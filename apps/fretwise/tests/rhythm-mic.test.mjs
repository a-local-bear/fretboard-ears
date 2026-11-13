// The rhythm exercise played on a guitar: no taps on the screen, just plucks.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp } from './support/driver.mjs';

const app = await bootApp({ microphone: true, secure: true });
const { env, settle } = app;
test.after(() => app.close());

const { createExercise } = await import('../public/js/exercises.js');
const { mic } = await import('../public/js/mic.js');
await mic.start();

const ex = { type: 'rhythmTap', melody: 'G3:q G3:q G3:e G3:e G3:q | G3:h G3:q G3:q', timeSig: [4, 4], bpm: 72, counts: 'eighths' };
// beats at which the notes of that rhythm begin
const GOOD = [0, 1, 2, 2.5, 3, 4, 6, 7];

function run(input = 'mic') {
  const results = [];
  const view = createExercise(ex, { input, width: 360, staffWidth: 340, done: (r) => results.push(r), useTapInstead() {} });
  const root = env.document.createElement('div');
  root.append(view.el);
  env.document.body.append(root);
  return { view, results, root };
}

async function onGo(root, limitMs = 30000) {
  for (let t = 0; t < limitMs; t += 10) {
    if (root.querySelector('.count-in').textContent === 'Go!') return env.clock.now;
    await settle(10);
  }
  throw new Error('never reached "Go!"');
}

/** pluck at these beats (counted from the moment "Go!" appears), each `lateMs` after the beat */
async function playBeats(t0, beats, lateMs = 20) {
  const spb = 60 / ex.bpm;
  for (const b of beats) {
    await settle(Math.max(0, t0 + b * spb * 1000 + lateMs - env.clock.now));
    env.mic.play(55);
  }
}

test('no tap is needed: no pad, no Start button, and it runs by itself', async () => {
  const { view, results, root } = run();
  assert.equal(root.querySelector('.tap-pad'), null);
  assert.equal(root.querySelector('.start'), null);
  assert.deepEqual([...root.querySelectorAll('button')].map((b) => b.textContent), ['Use the on-screen fretboard instead']);
  assert.match(root.textContent, /Play this rhythm on your guitar/);
  const t0 = await onGo(root);
  await playBeats(t0, GOOD);
  await settle(3000);
  assert.equal(results.length, 1);
  assert.equal(results[0].correct, true);
  assert.equal(results[0].mic, true);
  assert.equal(results[0].tries, 1);
  view.stop();
  env.mic.silence();
  env.assertNoErrors();
});

test('a pluck during the demonstration does not count', async () => {
  const { view, results, root } = run();
  env.mic.play(55);
  await settle(400);
  env.mic.silence();
  const t0 = await onGo(root);
  await playBeats(t0, GOOD);
  await settle(3000);
  assert.equal(results[0].correct, true);
  view.stop();
  env.mic.silence();
});

test('badly timed playing is explained and counted in again, then given up after three tries', async () => {
  const { view, results, root } = run();
  let firstHint = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = await onGo(root);
    assert.equal(results.length, 0);
    await playBeats(t0, [0, 1.4, 2.9, 3.7, 5, 6.3]); // wobbly
    await settle(2200);
    if (attempt === 1) firstHint = root.querySelector('.listen-hint').textContent;
  }
  await settle(200);
  assert.match(firstHint, /missed or off the beat/);
  assert.match(firstHint, /try 2 of 3/);
  assert.equal(results.length, 1);
  assert.equal(results[0].correct, false);
  assert.equal(results[0].mic, true);
  assert.equal(results[0].tries, 3);
  assert.match(results[0].tip, /Count out loud/);
  view.stop();
  env.mic.silence();
  env.assertNoErrors();
});

test('playing nothing is reported, and a second try can pass', async () => {
  const { view, results, root } = run();
  await onGo(root);
  await settle(7600);
  assert.match(root.querySelector('.listen-hint').textContent, /did not hear any plucks/);
  const t0 = await onGo(root);
  await playBeats(t0, GOOD, 40);
  await settle(3000);
  assert.equal(results[0].correct, true);
  assert.equal(results[0].tries, 2);
  view.stop();
  env.mic.silence();
});

test('with taps the exercise is unchanged', () => {
  const { view, root } = run('tap');
  assert.ok(root.querySelector('.tap-pad'));
  assert.ok(root.querySelector('.start'));
  view.stop();
});

test('after stop() the exercise no longer listens', async () => {
  const { view, results } = run();
  view.stop();
  env.mic.play(55);
  await settle(1000);
  assert.equal(results.length, 0);
  env.mic.silence();
  env.assertNoErrors();
});
