// The lesson screen: runs a list of exercises one after another, with a
// progress bar, hearts, instant feedback, and a second chance at mistakes.

import { h, mount, icon } from './dom.js';
import { createExercise } from './exercises.js';
import { audio } from './audio.js';
import { mic } from './mic.js';
import { prefs } from './prefs.js';
import { store } from './store.js';
import { recordNote, HEARTS } from './progress.js';
import { button, mascot, confirmDialog, toast, stars, confetti } from './ui.js';
import { formatTime, plural } from './util.js';

/** the lesson that is currently on screen (null when none) */
export const session = { active: null };

const PRAISE = ['Nice!', 'Correct!', 'Exactly right!', 'You got it!', 'Spot on!', 'Well read!'];
const OOPS = ['Not quite', 'Almost', 'Let’s look at that one'];
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * @param host  element to render into
 * @param opts  {exercises, hearts, onComplete(summary), onFail(summary), onExit()}
 */
export function runLesson(host, opts) {
  const useHearts = Boolean(opts.hearts);
  const settings = store.state ? store.state.settings : {};
  let input = prefs.get('input') === 'mic' && mic.on ? 'mic' : 'tap';
  // listening exercises make no sense with the sound switched off
  const queue = opts.exercises.filter((ex) => audio.enabled || (ex.type !== 'hearPhrase' && ex.type !== 'rhythmHear'));
  const scored = queue.filter((ex) => ex.type !== 'intro').length;
  const startedAt = performance.now();
  let index = -1, settled = 0, mistakes = 0, hearts = HEARTS, combo = 0, bestCombo = 0, usedMic = false;
  let view = null, shownAt = 0, autoTimer = null, waiting = false, closed = false;

  const fill = h('i');
  const heartCount = h('b', null, String(hearts));
  const heartsEl = h('span', { class: 'hearts', title: 'Hearts left' }, icon('heart'), heartCount);
  const body = h('main', { class: 'lesson-body' });
  const foot = h('footer', { class: 'lesson-foot' });
  const root = h('div', { class: 'lesson' },
    h('header', { class: 'lesson-top' },
      button(null, { kind: 'ghost', icon: 'x', cls: 'icon-only quit', title: 'Leave lesson', onclick: quit }),
      h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Lesson progress', 'aria-valuemin': 0, 'aria-valuemax': scored }, fill),
      useHearts ? heartsEl : null),
    body, foot);
  mount(host, root);

  const api = {
    el: root,
    /** the exercise on screen and its view (used by tests) */
    current: null,
    view: null,
    get waiting() { return waiting; },
    get input() { return input; },
    proceed,
    close: teardown,
  };
  session.active = api;

  const context = () => {
    const width = Math.max(260, Math.min(560, body.clientWidth || window.innerWidth) - 32);
    return {
    width,
    staffWidth: width - 30, // a staff sits inside a padded card
    input,
    board: { leftHanded: Boolean(settings.leftHanded), lowOnTop: Boolean(settings.lowOnTop) },
    done: onDone,
    setFooter(node) { foot.className = 'lesson-foot'; mount(foot, node ? h('div', { class: 'foot-inner' }, node) : null); },
    useTapInstead() {
      input = 'tap';
      toast('Using the on-screen fretboard for the rest of this lesson', { icon: 'hand-tap' });
      show(api.current);
    },
    };
  };

  function show(ex) {
    if (view && view.stop) view.stop();
    clearTimeout(autoTimer);
    waiting = false;
    api.current = ex;
    foot.className = 'lesson-foot';
    mount(foot);
    view = createExercise(ex, context());
    api.view = view;
    mount(body, ex.retry ? h('p', { class: 'retry-note' }, icon('arrows-clockwise'), 'One you missed earlier') : null, view.el);
    body.scrollTop = 0;
    if (view.start) view.start();
    shownAt = performance.now();
  }

  function onDone(result) {
    if (closed) return;
    if (result.skip) { next(); return; }
    const ms = performance.now() - shownAt;
    const ex = api.current;
    if (result.mic) usedMic = true;
    if (result.notes && result.notes.length && store.state) {
      const single = result.notes.length === 1;
      store.update((st) => { for (const n of result.notes) if (n.key) recordNote(st, n.key, n.correct, single ? ms : 0); });
    }
    if (result.correct) {
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      settled++;
      audio.sfx('good');
    } else {
      combo = 0;
      mistakes++;
      audio.sfx('bad');
      if (useHearts) {
        hearts = Math.max(0, hearts - 1);
        heartCount.textContent = String(hearts);
        heartsEl.classList.add('is-hit');
        setTimeout(() => heartsEl.classList.remove('is-hit'), 500);
      }
      // a missed exercise comes back once at the end of the lesson
      if (!ex.retry) queue.push({ ...ex, retry: true }); else settled++;
    }
    fill.style.setProperty('width', `${Math.round((settled / Math.max(1, scored)) * 100)}%`);
    banner(result, ex);
  }

  function banner(result, ex) {
    waiting = true;
    const good = result.correct;
    const title = good ? (ex.retry ? 'Fixed it!' : result.praise || pickOne(PRAISE)) : pickOne(OOPS);
    foot.className = `lesson-foot ${good ? 'is-good' : 'is-bad'}`;
    mount(foot, h('div', { class: 'foot-inner banner' },
      h('div', { class: 'banner-text', role: 'status' },
        h('strong', null, icon(good ? 'check-circle' : 'x-circle'), h('span', null, title),
          good && combo >= 3 ? h('span', { class: 'combo' }, icon('fire'), `${combo} in a row`) : null),
        !good && result.answer ? h('p', null, h('span', { class: 'banner-label' }, 'Answer: '), result.answer) : null,
        !good && !result.answer && result.tip ? h('p', null, result.tip) : null,
        !good && useHearts && hearts === 0 ? h('p', null, 'That was your last heart.') : null),
      button('Continue', { kind: good ? 'good' : 'bad', cls: 'btn-wide continue', onclick: proceed })));
    if (good && result.auto) autoTimer = setTimeout(proceed, 950);
  }

  function proceed() {
    if (!waiting || closed) return;
    clearTimeout(autoTimer);
    waiting = false;
    if (useHearts && hearts === 0) { teardown(); opts.onFail(summary()); return; }
    next();
  }

  function next() {
    index++;
    if (index >= queue.length) { teardown(); opts.onComplete(summary()); return; }
    show(queue[index]);
  }

  const summary = () => ({ mistakes, total: scored, seconds: (performance.now() - startedAt) / 1000, bestCombo, mic: usedMic });

  async function quit() {
    const leave = settled === 0 || await confirmDialog({ title: 'Leave this lesson?', text: 'What you have done in this lesson so far will not be saved.', yes: 'Leave', no: 'Keep going', danger: true });
    if (leave && !closed) { teardown(); opts.onExit(); }
  }

  function onKey(ev) {
    if (closed || ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector('.modal-wrap')) return; // a dialog is open
    if (waiting) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); proceed(); }
      return;
    }
    if (view && view.key && view.key(ev)) ev.preventDefault();
  }
  document.addEventListener('keydown', onKey);

  function teardown() {
    if (closed) return;
    closed = true;
    clearTimeout(autoTimer);
    document.removeEventListener('keydown', onKey);
    if (view && view.stop) view.stop();
    audio.stopAll();
    if (session.active === api) session.active = null;
  }

  next();
  return api;
}

// ---------------------------------------------------------------------------
// End-of-lesson screens
// ---------------------------------------------------------------------------
/**
 * The celebration after a finished lesson or practice round.
 * outcome is what progress.completeLesson / completePractice returned.
 */
export function showResults(host, { heading, sub, outcome, summary, onContinue, extra }) {
  const accuracy = summary.total ? Math.round(((summary.total - summary.mistakes) / summary.total) * 100) : 100;
  const notes = [];
  if (outcome.streakExtended) notes.push(h('li', null, icon('fire', 'tint-fire'), h('span', null, h('strong', null, `${plural(outcome.streak, 'day')} streak`), outcome.streak > 1 ? ' — keep it going tomorrow' : ' — your streak starts today')));
  if (outcome.goalReached) notes.push(h('li', null, icon('target', 'tint-good'), h('span', null, h('strong', null, 'Daily goal reached'))));
  if (outcome.levelUp) notes.push(h('li', null, icon('crown', 'tint-accent'), h('span', null, h('strong', null, `Level ${outcome.levelUp.level}`), ` — ${outcome.levelUp.title}`)));
  if (outcome.record) notes.push(h('li', null, icon('trophy', 'tint-accent'), h('span', null, h('strong', null, 'New personal best'))));
  for (const award of outcome.awards || []) notes.push(h('li', null, icon(award.icon, 'tint-accent'), h('span', null, h('strong', null, `Award: ${award.title}`), ` — ${award.text}`)));

  const go = button('Continue', { cls: 'btn-wide continue', onclick: finish });
  const root = h('div', { class: 'results' },
    h('div', { class: 'results-main' },
      mascot('cheer', 'mascot-big bounce'),
      h('h1', null, heading),
      sub ? h('p', { class: 'results-sub' }, sub) : null,
      outcome.stars ? stars(outcome.stars, 'stars-big') : null,
      // one headline number, two supporting figures
      h('div', { class: 'hero-xp' }, h('strong', null, `+${outcome.xp}`), h('span', null, 'XP earned', outcome.bonus ? ` (includes ${outcome.bonus} bonus)` : '')),
      h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, icon('target'), h('strong', null, `${accuracy}%`), h('span', null, 'Accuracy')),
        h('div', { class: 'kpi' }, icon('clock'), h('strong', null, formatTime(summary.seconds)), h('span', null, 'Time')),
        summary.bestCombo >= 3 ? h('div', { class: 'kpi' }, icon('fire'), h('strong', null, String(summary.bestCombo)), h('span', null, 'Best run')) : null),
      notes.length ? h('ul', { class: 'results-notes' }, notes) : null,
      extra || null),
    h('div', { class: 'results-foot' }, go));
  mount(host, root);
  confetti(root);
  audio.sfx(outcome.streakExtended ? 'streak' : 'win');

  let left = false;
  function finish() { if (left) return; left = true; document.removeEventListener('keydown', onKey); onContinue(); }
  function onKey(ev) { if (ev.key === 'Enter' && !document.querySelector('.modal-wrap')) { ev.preventDefault(); finish(); } }
  document.addEventListener('keydown', onKey);
  return { el: root, finish };
}

/** shown when the hearts run out (or a placement test was not passed) */
export function showFailed(host, { onRetry, onExit, heading = 'Out of hearts', text = null }) {
  mount(host, h('div', { class: 'results results-failed' },
    h('div', { class: 'results-main' },
      mascot('sad', 'mascot-big'),
      h('h1', null, heading),
      h('p', { class: 'results-sub' }, text || 'No harm done — every mistake shows you what to look at next. Take a breath and have another go.')),
    h('div', { class: 'results-foot' },
      button('Try again', { icon: 'arrow-counter-clockwise', cls: 'btn-wide retry', onclick: onRetry }),
      button('Back to the map', { kind: 'soft', cls: 'btn-wide', onclick: onExit }))));
  audio.sfx('fail');
}
