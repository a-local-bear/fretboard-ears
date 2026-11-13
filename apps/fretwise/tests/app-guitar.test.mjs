// Lessons that need nothing but the guitar: with the (pretend) microphone listening, teaching cards, single
// notes, phrases and rhythms are all done by playing, and every banner moves on by itself.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp } from './support/driver.mjs';
import { LESSONS, lessonById } from '../public/js/curriculum.js';
import { MIC_NEXT_RIGHT, MIC_NEXT_WRONG } from '../public/js/lesson.js';

const app = await bootApp({ microphone: true, secure: true });
const { env, store, session, $, need, click, go, settle, guitarLesson } = app;
const { prefs } = await import('../public/js/prefs.js');
test.after(() => app.close());

// every tap, click or key press the page receives
const touches = [];
for (const type of ['click', 'keydown', 'pointerdown', 'pointerup', 'touchstart']) env.document.addEventListener(type, () => touches.push(type));

/** mark every lesson before `id` as finished, so that it can be started */
function unlockUpTo(id) {
  const at = lessonById(id).index;
  store.update((st) => { for (const l of LESSONS) if (l.index < at && !st.lessons[l.id]) st.lessons[l.id] = { done: 1, stars: 3, best: 1, at: 1 }; });
}
const titleOfCard = () => need('.bubble h2').textContent;
/** wait until the feedback banner is up; returns the time it appeared */
async function untilBanner(limit = 15000) {
  for (let t = 0; t < limit; t += 20) { if (session.active && session.active.waiting) return env.clock.now; await settle(20); }
  throw new Error(`no banner appeared\n${app.screen()}`);
}
async function playNote(midi, ms = 450) { env.mic.play(midi); await settle(ms); env.mic.silence(); await settle(250); }

test('the guitar is the default way to answer', async () => {
  assert.equal(prefs.get('input'), 'mic');
  await click('.tab[href="#/settings"]');
  assert.equal(need('.segmented button[data-value="mic"]').getAttribute('aria-pressed'), 'true');
  assert.ok(touches.length > 0, 'the instrument sees clicks (sanity check)');
  await go('/');
});

test('a notes lesson from the first teaching card to the results, with the guitar alone', async () => {
  await go('/lesson/u1-1');
  await settle(100);
  assert.equal(session.active.input, 'mic');
  assert.equal(session.active.current.type, 'intro');
  assert.match(app.screen(), /Play any note to continue/);
  const from = touches.length;
  const log = await guitarLesson({ mistakes: 1 });
  assert.equal(touches.length, from, `no click or key press (${touches.slice(from)})`);
  assert.ok(log.includes('find!') && log.includes('find(retry)'), `the missed note came back: ${log}`);
  assert.ok(log.includes('phrase'));
  assert.match(need('.results h1').textContent, /Lesson complete/);
  assert.ok(store.state.lessons['u1-1'].done);
  assert.equal(store.state.stats.micLessons, 1);
  assert.ok(Object.keys(store.state.notes).length >= 2, 'per-note memory still recorded');
  await go('/');
});

test('a rhythm lesson is played on the guitar: cards, then rhythms, no tap', async () => {
  unlockUpTo('u1-3');
  await go('/lesson/u1-3');
  await settle(100);
  assert.equal(session.active.current.type, 'intro');
  const from = touches.length;
  const log = await guitarLesson();
  assert.equal(touches.length, from, 'no click or key press');
  assert.ok(log.filter((x) => x === 'rhythmTap').length >= 5 && log.every((x) => x === 'intro' || x === 'rhythmTap'), String(log));
  assert.match(need('.results h1').textContent, /Flawless/);
  assert.equal(store.state.lessons['u1-3'].stars, 3);
  await go('/');
});

test('an accidentals lesson: single altered notes and bar-line phrases, played on the guitar', async () => {
  unlockUpTo('u7-4');
  await go('/lesson/u7-4');
  await settle(100);
  assert.equal(session.active.current.type, 'intro');
  const from = touches.length;
  const log = await guitarLesson();
  assert.equal(touches.length, from, 'no click or key press');
  assert.ok(log.every((x) => ['intro', 'find', 'phrase'].includes(x)) && log.filter((x) => x === 'phrase').length >= 6, String(log));
  assert.match(need('.results h1').textContent, /Flawless/);
  await go('/');
});

test('two wrong notes show where the note is and the exercise waits for the right one', async () => {
  await go('/lesson/u1-1');
  await settle(100);
  await app.answer(true); // the teaching cards
  const ex = session.active.current;
  assert.equal(ex.type, 'find');
  const hintBefore = $('.ex-find .fb-wrap .fretboard');
  assert.equal(hintBefore, null, 'nothing is shown before the second mistake');
  await playNote(ex.note.sounding + 3);
  assert.match(need('.listen-hint').textContent, /one more go/);
  assert.equal($('.ex-find .fretboard'), null);
  await playNote(ex.note.sounding + 3);
  assert.match(need('.listen-hint').textContent, /It is on the .*(string)/);
  assert.ok($('.ex-find .fretboard'), 'the fretboard shows the place');
  assert.equal(session.active.waiting, false);
  await settle(8000);
  assert.equal(session.active.current, ex, 'it keeps listening, no banner, no end');
  assert.equal(session.active.waiting, false);
  await playNote(ex.note.sounding + 4); // still wrong
  assert.equal(session.active.waiting, false);
  assert.match(need('.listen-hint').textContent, /The note is on the/);
  env.mic.play(ex.note.sounding);
  const shown = await untilBanner();
  assert.match(need('.lesson-foot').getAttribute('class'), /is-bad/);
  // a wrong answer stays about 2.5 s
  await settle(MIC_NEXT_WRONG - 200);
  assert.equal(session.active.current, ex);
  await settle(400);
  assert.notEqual(session.active.current, ex);
  assert.ok(env.clock.now - shown >= MIC_NEXT_WRONG - 100);
  env.mic.silence();
  // it comes back once at the end
  const log = await guitarLesson();
  assert.ok(log.includes('find(retry)'), String(log));
  await go('/');
});

test('right answers move on after about a second, wrong ones after about two and a half, by themselves', async () => {
  await go('/lesson/u1-2');
  await settle(100);
  await app.answer(true);
  let ex = session.active.current;
  assert.equal(ex.type, 'find');
  env.mic.play(ex.note.sounding);
  let shown = await untilBanner();
  assert.match(need('.lesson-foot').getAttribute('class'), /is-good/);
  await settle(MIC_NEXT_RIGHT - 150);
  assert.equal(session.active.current, ex, 'still showing');
  await settle(300);
  assert.notEqual(session.active.current, ex);
  env.mic.silence();
  await settle(300);
  // a phrase: the result of phraseView used to wait for a tap
  while (session.active.current.type !== 'phrase') { await app.answer(true); await settle(1500); }
  ex = session.active.current;
  const notes = ex.where.map((k) => k);
  const theory = await import('../public/js/theory.js');
  for (let i = 0; i < notes.length; i++) {
    const n = theory.noteFromKey(notes[i]);
    if (i === 0) await playNote(n.sounding + 5, 420); // a slip on the first note
    if (i < 2) await playNote(n.sounding + 5, 420); // and again: more than one fifth of a short phrase
    if (i === notes.length - 1) { env.mic.play(n.sounding); break; }
    await playNote(n.sounding, 420);
  }
  shown = await untilBanner();
  const bad = /is-bad/.test(need('.lesson-foot').getAttribute('class'));
  const wait = bad ? MIC_NEXT_WRONG : MIC_NEXT_RIGHT;
  await settle(wait - 200);
  assert.equal(session.active.current, ex);
  await settle(400);
  assert.notEqual(session.active.current, ex);
  env.mic.silence();
  assert.ok(bad, 'the phrase with slips counts as missed');
  await click('.quit');
  await settle(30);
  if ($('.modal')) await click('.modal .btn-bad');
  await settle(30);
});

test('one ringing note cannot skip several teaching cards, and a note card wants its own note', async () => {
  await go('/lesson/u1-2');
  await settle(100);
  const ex = session.active.current;
  assert.equal(ex.type, 'intro');
  const first = ex.cards[0];
  assert.ok(first.note, 'meet G is introduced by a note card');
  assert.match(app.screen(), /Play it to continue/);
  await settle(900);
  await playNote(first.note.sounding + 2); // some other note: the card waits
  assert.equal(titleOfCard(), first.title);
  assert.match(need('.listen-hint').textContent, /This card is about G/);
  env.mic.play(first.note.sounding);
  await settle(500);
  assert.equal(session.active.current.type, 'find', 'that was the only card; the lesson goes on');
  env.mic.silence();
  await settle(300);

  // a lesson with several cards: a note that rings on for seconds turns one card
  await go('/lesson/u1-1');
  await settle(100);
  const cards = session.active.current.cards;
  assert.ok(cards.length >= 4);
  await settle(900);
  assert.equal(titleOfCard(), cards[0].title);
  env.mic.play(64);
  await settle(3000); // still ringing, never silenced
  assert.equal(titleOfCard(), cards[1].title, 'exactly one card turned');
  await settle(3000);
  assert.equal(titleOfCard(), cards[1].title);
  env.mic.silence();
  await settle(500);
  // a note that rings in from before the card appeared does not count either
  await playNote(64);
  assert.equal(titleOfCard(), cards[2].title);
  // the Continue button still works for tap and keyboard
  await click('.next');
  assert.equal(titleOfCard(), cards[3].title);
  env.assertNoErrors();
  await click('.quit');
  await settle(30);
  if ($('.modal')) await click('.modal .btn-bad');
});

test('the rhythm workout in Practice listens to the guitar too', async () => {
  await go('/rhythm');
  await click('.go');
  await settle(50);
  assert.equal(session.active.input, 'mic');
  assert.equal(session.active.current.type, 'rhythmTap');
  assert.equal($('.tap-pad'), null);
  assert.ok($('.ex-rhythm .listen'));
  await click('.quit');
  await settle(30);
  if ($('.modal')) await click('.modal .btn-bad');
  await settle(30);
});

test('choosing the on-screen fretboard still completes a lesson by tapping', async () => {
  await click('.tab[href="#/settings"]');
  await click('.segmented button[data-value="tap"]');
  assert.equal(prefs.get('input'), 'tap');
  await go('/lesson/u2-1');
  await settle(100);
  assert.equal(session.active.input, 'tap');
  const log = await app.playLesson({ mistakes: 1 });
  assert.ok(log.includes('find') && log.includes('phrase'));
  assert.match(need('.results h1').textContent, /Lesson complete/);
  assert.equal(env.micTracks.filter((t) => !t.stopped).length, 0, 'the microphone is off in tap mode');
  await click('.results .continue');
  // and a rhythm lesson taps the pad
  await go('/lesson/u1-3');
  await settle(100);
  const rhythm = await app.playLesson();
  assert.ok(rhythm.filter((x) => x === 'rhythmTap').length >= 5);
  assert.ok(!$('.results-failed'));
  await click('.results .continue');
  env.assertNoErrors();
});
