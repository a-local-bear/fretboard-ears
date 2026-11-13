// A walk through the app with stand-ins for the browser: no real DOM and no sound, but every screen
// renders, every button pressed here is one the screen really shows, and levels are played from the
// first note to the results. Catches a template that names something that no longer exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, POSITIONS, ROUNDS, levelById } from '../public/js/data.js';
import { STAGES, tipOf } from '../public/js/path.js';

// ---------- the browser, as far as ui.js needs it (set up before it loads) ----------

const store = new Map();
const handlers = {}; // listeners on the app root
const docHandlers = {}; // listeners on document
const realTimeout = setTimeout;
// The app waits about a second after a right answer; here that passes at once.
globalThis.setTimeout = (fn, ms, ...args) => realTimeout(fn, Math.min(ms ?? 0, 1), ...args);

class Param { value = 0; setValueAtTime() {} linearRampToValueAtTime() {} cancelScheduledValues() {} }
class AudioNode {
  gain = new Param(); frequency = new Param(); playbackRate = new Param(); threshold = new Param(); ratio = new Param();
  connect(next) { return next; }
  disconnect() {}
  start() {}
  stop() { if (this.clock) realTimeout(() => this.onended?.(), 0); } // callAt(): the moment has come
}
class AudioContext {
  currentTime = 0; sampleRate = 8000; state = 'running'; destination = new AudioNode();
  createBiquadFilter() { return new AudioNode(); }
  createGain() { return new AudioNode(); }
  createDynamicsCompressor() { return new AudioNode(); }
  createOscillator() { return new AudioNode(); }
  createBufferSource() { return new AudioNode(); }
  createConstantSource() { return Object.assign(new AudioNode(), { clock: true }); }
  createBuffer(channels, length, rate) { return { duration: length / rate, copyToChannel() {} }; }
  resume() {}
}

globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); } };
globalThis.window = { innerWidth: 400, isSecureContext: false, AudioContext, addEventListener() {}, scrollTo() {} };
globalThis.document = { activeElement: null, visibilityState: 'visible', getElementById: () => null, addEventListener: (type, fn) => { docHandlers[type] = fn; } };
const app = { innerHTML: '', addEventListener: (type, fn) => { handlers[type] = fn; }, contains: () => true, querySelector: () => null };

const { mount } = await import('../public/js/ui.js');
mount(app);

// ---------- driving it ----------

const html = () => app.innerHTML;
const screen = () => /<main class="screen ([a-z ]+)"/.exec(html())?.[1] ?? '';
const tick = (ms = 3) => new Promise((r) => { realTimeout(r, ms); });
const saved = (key) => JSON.parse(store.get(key) ?? 'null');

/** Nothing half-rendered: a missing value shows up as one of these words in the page. */
function sane() {
  assert.ok(!/undefined|NaN|\[object|null/.test(html().replace(/aria-[a-z]+="[^"]*"/g, '')), `broken text on the ${screen()} screen: ${/.{40}(undefined|NaN|\[object|null).{40}/s.exec(html())?.[0]}`);
}

const press = (dataset) => handlers.click({ target: { closest: () => ({ dataset, disabled: false, blur() {} }) }, detail: 0 });

/** Press a button the screen shows; fails when there is no such button. */
function click(action, arg) {
  const shown = arg === undefined ? html().includes(`data-action="${action}"`) : new RegExp(`data-action="${action}"[^>]*data-arg="${arg}"`).test(html());
  assert.ok(shown, `the ${screen()} screen has no ${action}${arg === undefined ? '' : ` ${arg}`} button`);
  press({ action, arg: arg === undefined ? undefined : String(arg) });
  sane();
}

const dots = () => [...html().matchAll(/data-action="tap" data-degree="(\d+)" data-pos="(\d+,\d+)"/g)].map((m) => ({ action: 'tap', degree: m[1], pos: m[2] }));
const labels = () => [...html().matchAll(/class="dlabel"[^>]*>([^<]*)</g)].map((m) => m[1]);
const key = (k) => docHandlers.keydown({ key: k, preventDefault() {} });

/** Tap dot after dot until the level (or the whole practice session) is over. */
async function playOut() {
  for (let i = 0; screen().startsWith('play'); i++) {
    assert.ok(i < 6000, 'the level never ends');
    const ds = dots();
    press(ds[i % ds.length]);
    await tick(2);
  }
  sane();
}

/** Back to the path screen from wherever the walk is, by the back buttons a player would use. */
const atHome = () => screen() === 'home' && html().includes('data-action="practise"');
function goHome() {
  for (let i = 0; i < 6 && !atHome(); i++) {
    const back = /data-action="([a-z]+)" data-focus-key="back"/.exec(html());
    click(back ? back[1] : 'home');
  }
  assert.ok(atHome(), `still on the ${screen()} screen`);
}

async function open(levelId) {
  goHome();
  const l = levelById(levelId);
  click('stage', STAGES.findIndex((s) => s.levels.includes(l)));
  click('level', l.idx);
  assert.equal(screen(), 'explore fit');
  return l;
}

// ---------- the walk ----------

test('the app opens on the path: five stages and the next level', () => {
  assert.ok(atHome());
  assert.match(html(), /<a class="iconbtn" href="\.\.\/"/, 'the back arrow leads to the site menu');
  for (const st of STAGES) assert.ok(html().includes(st.name), st.name);
  assert.match(html(), /Next up · 0\/31 done/);
  assert.match(html(), /0\/11/);
  assert.ok(!/Ear drills|Songbook|Backing track|Guide/.test(html()), 'nothing but note training on the home screen');
});

test('every stage lists its levels with a tip, a position picker, and a key only where it is fixed', () => {
  STAGES.forEach((st, i) => {
    goHome();
    click('stage', i);
    assert.equal(screen(), 'levels');
    for (const l of st.levels) {
      assert.ok(html().includes(`data-action="level" data-arg="${l.idx}"`), l.id);
      assert.ok(html().includes(tipOf(l.id).replace(/&/g, '&amp;').replace(/"/g, '&quot;')), `${l.id}: tip`);
    }
    for (const p of POSITIONS) assert.ok(html().includes(`data-action="position" data-arg="${p.id}"`), p.id);
    assert.equal(html().includes('data-action="key"'), i === 0, `${st.name}: key picker`);
  });
});

test('the position chosen on a stage screen is kept and used by its levels', () => {
  goHome();
  click('stage', 0);
  click('position', 'E');
  assert.equal(saved('fe-position'), 'E');
  assert.match(html(), /class="keychip on" data-action="position" data-arg="E"/);
  click('key', 7);
  assert.equal(saved('fe-key'), 7);
  click('level', 0);
  assert.match(html(), /G major/);
  assert.deepEqual(dots().map((d) => d.pos), ['0,3', '1,5'], 'root and fifth of G in the box on the E string');
  assert.deepEqual(labels(), ['1', '5']);
  assert.match(html(), /New note: .*>5<\/span><\/b>, the fifth/);
  click('levels');
  click('key', 0);
});

test('on a level the board follows the position, in the same key', async () => {
  await open('major-6');
  const seen = new Set();
  for (const p of POSITIONS) {
    click('position', p.id);
    assert.equal(screen(), 'explore fit');
    assert.match(html(), /C major/);
    seen.add(dots().map((d) => d.pos).join(' '));
    assert.equal(new Set(dots().map((d) => d.degree)).size, 8, `${p.id}: the eight notes of the octave`);
  }
  assert.equal(seen.size, POSITIONS.length, 'four different places on the neck');
  assert.ok(dots().length > 8, 'the whole neck shows every place a note can be played');
  click('position', 'A');
  assert.deepEqual(labels(), ['1', '2', '3', '4', '5', '6', '7', "1'"]);
});

test('levels of more than one octave are on the whole neck and offer no position', async () => {
  for (const l of LEVELS.filter((x) => x.neck)) {
    await open(l.id);
    assert.ok(!html().includes('data-action="position"'), l.id);
    assert.match(html(), /whole neck/);
    assert.ok(dots().length > 20, l.id);
  }
});

test('every level opens, starts and takes an answer', async () => {
  for (const l of LEVELS) {
    await open(l.id);
    assert.ok(html().includes(l.name.replace(/'/g, "'")), l.id);
    click('reference');
    click('start');
    assert.equal(screen(), 'play fit');
    assert.equal(html().includes('notepips'), l.len > 1, `${l.id}: a phrase shows its notes`);
    press(dots()[0]);
    sane();
    click('replay');
  }
});

test('a level played to the end is scored, saved and points at the next one', async () => {
  await open('major-t0');
  const logged = saved('fe-log').length;
  key(' '); // Space starts
  assert.equal(screen(), 'play fit');
  await playOut();
  assert.equal(screen(), 'results');
  const best = saved('fe-progress').best['major-t0'];
  assert.ok(best >= 0 && best <= ROUNDS);
  assert.ok(html().includes(`<b>${best}</b>/${ROUNDS}`));
  assert.equal(saved('fe-log').length, logged + ROUNDS, 'one log entry per note');
  assert.deepEqual(Object.keys(saved('fe-log').at(-1)).sort(), ['answered', 'as', 'ch', 'heard', 'hs', 'key', 'labels', 'len', 'lid', 'lvl', 'mode', 'ms', 'ref', 'seq', 't', 'tries']);
  assert.equal(saved('fe-log').at(-1).lid, 'major-t0');
  assert.equal(saved('fe-log').at(-1).ch, 'A');
  click('retry');
  assert.equal(screen(), 'explore fit');
  click('start');
  await playOut();
  click('next');
  assert.match(html(), /1 · 3 · 5/);
  click('levels');
  assert.equal(screen(), 'levels');
  assert.match(html(), new RegExp(`Best ${saved('fe-progress').best['major-t0']}/${ROUNDS}`));
});

test('dictation, chromatic notes and the last level play to the end too', async () => {
  for (const id of ['major-dict-4', 'minorChrom-dict-2', 'majorChrom-2oct', 'all-neck']) {
    await open(id);
    click('start');
    await playOut();
    assert.equal(screen(), 'results', id);
    assert.ok(Number.isInteger(saved('fe-progress').best[id]), id);
  }
  const last = saved('fe-log').at(-1);
  assert.equal(last.lid, 'all-neck');
  assert.equal(last.ch, 'neck');
  assert.ok(!html().includes('data-action="next"'), 'nothing comes after the last level');
});

test('daily practice runs its four blocks and ends on a summary', async () => {
  goHome();
  click('practise');
  assert.equal(screen(), 'play fit');
  assert.match(html(), /1\/4 · WARM-UP/);
  await playOut();
  assert.equal(screen(), 'results');
  assert.match(html(), /Session done/);
  assert.equal((html().match(/<span class="bname">/g) || []).length, 4);
  goHome();
});

test('hands-free listening plays rounds on its own until stopped', async () => {
  await open('minor-dict-2');
  click('listen');
  assert.equal(screen(), 'play listen fit');
  assert.match(html(), /not scored/);
  await tick(40);
  const round = Number(/round (\d+)/.exec(html())[1]);
  assert.ok(round > 1, `it moved on by itself (round ${round})`);
  sane();
  click('listenpause');
  assert.match(html(), /Paused\./);
  click('listenpause');
  click('set', 'listenGap:3');
  click('explore');
  assert.equal(screen(), 'explore fit');
  await tick(10);
  assert.equal(screen(), 'explore fit', 'stopped for good');
});

test('settings: numbers, letters or hidden labels; every option can be chosen', async () => {
  goHome();
  click('settings');
  assert.match(html(), /Numbers/);
  assert.ok(!/Solf|over a chord/i.test(html()));
  for (const [, arg] of html().matchAll(/data-action="set" data-arg="([^"]+)"/g)) {
    click('set', arg);
    const [k, v] = arg.split(':');
    assert.equal(saved('fe-settings')[k], v);
  }
  click('set', 'labels:letters');
  await open('major-t1');
  assert.deepEqual(labels(), ['C', 'E', 'G']);
  goHome();
  click('settings');
  click('set', 'labels:hidden');
  await open('major-t1');
  assert.deepEqual(labels(), []);
  goHome();
  click('settings');
  for (const arg of ['labels:numbers', 'ref:cadence', 'refWhen:each', 'resolve:on', 'adaptive:off', 'sound:guitar']) click('set', arg);
});

test('an older saved choice of solfège labels reads as numbers', async () => {
  const { loadSettings } = await import('../public/js/storage.js');
  store.set('fe-settings', JSON.stringify({ ...saved('fe-settings'), labels: 'solfege', over: 'any' }));
  assert.equal(loadSettings().labels, 'numbers');
  assert.equal('over' in loadSettings(), false);
});

test('stats show the notes played, named by number', () => {
  goHome();
  click('stats');
  assert.equal(screen(), 'stats');
  assert.match(html(), /First-try accuracy by note/);
  assert.match(html(), /<span class="bname">1<\/span>/);
  assert.match(html(), /<span class="bname">♭3<\/span>/);
});

test('reset erases the scores after a second tap', () => {
  goHome();
  click('settings');
  click('reset');
  assert.match(html(), /Tap again/);
  assert.ok(Object.keys(saved('fe-progress').best).length > 0);
  click('reset');
  assert.deepEqual(saved('fe-progress'), { best: {} });
  goHome();
  assert.match(html(), /Next up · 0\/31 done/);
});
