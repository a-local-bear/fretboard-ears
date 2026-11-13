// The main screens: the learning map, profile and settings.
// Every view function returns a DOM node, or {el, destroy} when it needs cleanup.

import { h, s, icon } from './dom.js';
import { store } from './store.js';
import { prefs, applyTheme } from './prefs.js';
import { audio } from './audio.js';
import { mic } from './mic.js';
import { UNITS, LESSONS } from './curriculum.js';
import {
  GOALS, AWARDS, levelFor, todayXp, streakNow, practisedToday, recentDays, isDone, isUnlocked, nextLesson, unitProgress,
  courseProgress, noteStrength, strengthBand,
} from './progress.js';
import { knownNotes } from './generate.js';
import { createFretboard } from './fretboard.js';
import { pitchName, spell } from './theory.js';
import { button, mascot, modal, confirmDialog, toast, ring, stars, segmented, toggle, PICK_PATH } from './ui.js';
import { dayKey, formatTime, plural } from './util.js';

const OFFSETS = [0, 46, 70, 46, 0, -46, -70, -46];

// ---------------------------------------------------------------------------
// Learn: the map of units and lessons
// ---------------------------------------------------------------------------
export function homeView(nav) {
  const state = store.state;
  const today = dayKey();
  const next = nextLesson(state);
  const goal = state.settings.goal;
  const xp = todayXp(state, today);
  const streak = streakNow(state, today);
  const started = state.stats.lessons > 0;

  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const line = !started ? 'Your first lesson takes about three minutes.'
    : xp >= goal ? 'Daily goal done — anything more today is a bonus.'
      : practisedToday(state, today) ? `${goal - xp} XP to go for today’s goal.`
        : streak > 0 ? `Play one lesson today to keep your ${plural(streak, 'day')} streak alive.` : 'A few minutes today gets a new streak going.';

  const today_ = h('section', { class: 'card today' },
    h('div', { class: 'today-text' },
      h('h1', null, `${hello}!`),
      h('p', null, line),
      next
        ? button(`${started ? 'Continue' : 'Start'}: ${next.title}`, { icon: 'play', cls: 'cta', onclick: () => nav.go(`/lesson/${next.id}`) })
        : h('p', { class: 'done-all' }, icon('graduation-cap'), 'You have finished the whole course. Keep your reading sharp in Practice.')),
    ring(xp / goal, { size: 84, stroke: 9, cls: 'ring-goal' }, h('b', null, String(xp)), h('small', null, `of ${goal} XP`)));

  function node(lesson, i) {
    const done = isDone(state, lesson.id);
    const open = isUnlocked(state, lesson);
    const status = done ? 'done' : next && next.id === lesson.id ? 'next' : open ? 'open' : 'locked';
    const rec = state.lessons[lesson.id];
    const spoken = `${lesson.title}: ${done ? `finished, ${rec.stars || 0} of 3 stars` : status === 'locked' ? 'locked' : 'ready to start'}`;
    return h('li', { class: 'node-wrap', style: { '--dx': `${OFFSETS[i % OFFSETS.length]}px` } },
      status === 'next' ? h('span', { class: 'node-flag', 'aria-hidden': 'true' }, started ? 'Next up' : 'Start here') : null,
      h('button', { class: `node is-${status}`, type: 'button', 'aria-label': spoken, dataset: { lesson: lesson.id }, onclick: () => lessonSheet(lesson, status, nav) },
        s('svg', { class: 'node-pick', viewBox: '0 0 100 118', 'aria-hidden': 'true' },
          s('path', { class: 'node-edge', d: PICK_PATH, transform: 'translate(0 8)' }), s('path', { class: 'node-face', d: PICK_PATH })),
        h('span', { class: 'node-icon' }, icon(status === 'locked' ? 'lock' : status === 'done' ? 'check' : lesson.icon))),
      h('span', { class: 'node-label' }, lesson.title),
      done && rec.stars ? stars(rec.stars, 'stars-mini') : null);
  }

  const units = UNITS.map((unit) => {
    const prog = unitProgress(state, unit);
    const locked = !isUnlocked(state, unit.lessons[0]);
    return h('section', { class: ['unit', `tone-${unit.tone}`, locked && 'is-locked'], id: `unit-${unit.id}` },
      h('header', { class: 'unit-head' },
        h('div', { class: 'unit-title' }, h('span', { class: 'unit-kicker' }, `Unit ${unit.index + 1}`), h('h2', null, unit.title), h('p', null, unit.blurb)),
        locked
          ? button('Jump here', { kind: 'soft', cls: 'btn-small jump', icon: 'skip-forward', onclick: () => jumpSheet(unit, nav) })
          : h('span', { class: 'unit-count', 'aria-label': `${prog.done} of ${prog.total} lessons done` }, prog.complete ? icon('check') : null, `${prog.done}/${prog.total}`)),
      h('ol', { class: 'path' }, unit.lessons.map(node)));
  });

  const el = h('div', { class: 'home' }, today_, units);
  // bring the next lesson into view
  requestAnimationFrame(() => {
    const target = next && started ? el.querySelector(`[data-lesson="${next.id}"]`) : null;
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center' });
  });
  return el;
}

function lessonSheet(lesson, status, nav) {
  const rec = store.state.lessons[lesson.id];
  const prev = LESSONS[lesson.index - 1];
  modal({
    cls: `sheet tone-${lesson.unit.tone}`,
    title: lesson.title,
    body: [
      h('p', { class: 'sheet-kicker' }, `Unit ${lesson.unit.index + 1} · Lesson ${lesson.number} of ${lesson.unit.lessons.length}`),
      h('p', null, lesson.blurb),
      rec && rec.stars ? stars(rec.stars) : null,
      status === 'locked'
        ? h('p', { class: 'sheet-note' }, icon('lock'), h('span', null, `Finish “${prev.title}” to unlock this lesson.`))
        : h('p', { class: 'sheet-note' }, icon('lightning'), h('span', null, `${lesson.xp} XP, plus a bonus for a clean run`)),
    ],
    actions: (close) => (status === 'locked'
      ? [button('OK', { kind: 'soft', cls: 'btn-wide', onclick: close })]
      : [button(status === 'done' ? 'Practise again' : 'Start lesson', { icon: 'play', cls: 'btn-wide start-lesson', onclick: () => { close(); nav.go(`/lesson/${lesson.id}`); } })]),
  });
}

function jumpSheet(unit, nav) {
  modal({
    cls: `sheet tone-${unit.tone}`,
    title: `Jump to ${unit.title}?`,
    body: [
      h('p', null, 'Already know the earlier material? Take a 16-question test on everything that comes before this unit.'),
      h('p', { class: 'sheet-note' }, icon('flag-checkered'), h('span', null, 'Pass with three mistakes or fewer and every earlier lesson is unlocked.')),
    ],
    actions: (close) => [
      button('Not now', { kind: 'soft', onclick: close }),
      button('Take the test', { icon: 'play', cls: 'start-jump', onclick: () => { close(); nav.go(`/jump/${unit.id}`); } }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Me: progress, mastery map, awards
// ---------------------------------------------------------------------------
function weekStrip(state) {
  const names = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return h('ol', { class: 'week' }, recentDays(state, 7).map((d) => {
    const date = new Date(`${d.day}T12:00:00`);
    const spoken = `${date.toLocaleDateString(undefined, { weekday: 'long' })}: ${d.xp} XP${d.met ? ', goal reached' : ''}`;
    return h('li', { class: ['day', d.met ? 'is-met' : d.active ? 'is-active' : ''], 'aria-label': spoken },
      h('span', { class: 'day-name' }, names[date.getDay()]),
      h('span', { class: 'day-mark' }, d.met ? icon('check') : null),
      h('span', { class: 'day-xp' }, d.xp ? String(d.xp) : '–'));
  }));
}

function masteryMap(state, width) {
  const notes = knownNotes(state);
  if (!notes.length) return h('p', { class: 'muted' }, 'Every note you learn lights up here, and fades when it is time to review it.');
  const far = Math.max(...notes.map((n) => n.f)) > 4;
  const fb = createFretboard({ frets: [0, far ? 12 : 4], width, compact: far, leftHanded: state.settings.leftHanded, lowOnTop: state.settings.lowOnTop });
  const counts = { strong: 0, learning: 0, shaky: 0, new: 0 };
  const now = Date.now();
  for (const n of notes) {
    const band = strengthBand(noteStrength(state, n.key, now));
    counts[band]++;
    fb.mark(n.s, n.f, `band-${band}`, n.name);
  }
  fb.setEnabled(false);
  const legend = [['strong', 'Strong'], ['learning', 'Learning'], ['shaky', 'Shaky'], ['new', 'Not practised yet']];
  return h('div', { class: 'mastery' },
    h('div', { class: 'fb-wrap' }, fb.el),
    // the legend doubles as the table view: every band is named and counted
    h('ul', { class: 'legend' }, legend.filter(([band]) => counts[band] || band !== 'new').map(([band, label]) =>
      h('li', null, h('i', { class: `swatch-band band-${band}` }), h('span', null, label), h('b', null, String(counts[band]))))));
}

export function profileView(nav) {
  const state = store.state;
  const level = levelFor(state.xp);
  const course = courseProgress(state);
  const accuracy = state.stats.answers ? Math.round((state.stats.correct / state.stats.answers) * 100) : null;
  const earned = AWARDS.filter((a) => state.awards[a.id]);
  const width = Math.min(560, window.innerWidth) - 72; // page padding + card padding and border

  const kpi = (ic, value, label, tint) => h('div', { class: 'kpi' }, icon(ic, tint), h('strong', null, String(value)), h('span', null, label));
  return h('div', { class: 'profile' },
    h('section', { class: 'card me' },
      h('span', { class: 'avatar avatar-big tone-teal' }, mascot('happy')),
      h('div', { class: 'me-text' },
        h('h1', null, `Level ${level.level}`),
        h('p', null, level.title),
        h('div', { class: 'meter', role: 'progressbar', 'aria-label': 'Progress to the next level', 'aria-valuemin': 0, 'aria-valuemax': level.need, 'aria-valuenow': level.into },
          h('i', { style: { width: `${Math.round((level.into / level.need) * 100)}%` } })),
        h('small', null, `${level.need - level.into} XP to level ${level.level + 1}`))),
    h('section', { class: 'card' },
      h('h2', null, 'Your numbers'),
      h('div', { class: 'kpis kpis-grid' },
        kpi('fire', streakNow(state), 'Day streak', 'tint-fire'),
        kpi('lightning', state.xp, 'Total XP', 'tint-accent'),
        kpi('check-circle', `${course.done}/${course.total}`, 'Lessons done', 'tint-good'),
        kpi('target', accuracy == null ? '–' : `${accuracy}%`, 'Accuracy', 'tint-info'),
        kpi('clock', formatTime(state.stats.seconds), 'Time practised', 'tint-info'),
        kpi('trophy', state.streak.best, 'Longest streak', 'tint-accent'))),
    h('section', { class: 'card' },
      h('h2', null, 'This week'),
      h('p', { class: 'muted' }, `Daily goal: ${state.settings.goal} XP. A tick marks the days you reached it.`),
      weekStrip(state)),
    h('section', { class: 'card' },
      h('h2', null, 'Fretboard memory'),
      h('p', { class: 'muted' }, 'How well each note you have learned is sticking. Darker means stronger.'),
      masteryMap(state, width),
      button('Practise the weakest notes', { kind: 'soft', icon: 'brain', cls: 'btn-small', onclick: () => nav.go('/review') })),
    h('section', { class: 'card' },
      h('h2', null, `Awards (${earned.length}/${AWARDS.length})`),
      h('ul', { class: 'awards' }, AWARDS.map((a) => h('li', { class: state.awards[a.id] ? 'award is-earned' : 'award' },
        h('span', { class: 'award-icon' }, icon(state.awards[a.id] ? a.icon : 'lock')),
        h('span', null, h('strong', null, a.title), h('small', null, a.text)))))));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export async function micHelp() {
  const info = store.info || await store.loadInfo();
  // hand the same progress over to the secure address
  const secureUrl = info && info.httpsPort ? `https://${window.location.hostname}:${info.httpsPort}/${store.id ? `?p=${store.id}` : ''}` : null;
  const insecure = !window.isSecureContext;
  modal({
    title: 'Playing with a real guitar',
    body: insecure ? [
      h('p', null, 'Browsers only let a page use the microphone when the page is opened over a secure (https) connection.'),
      secureUrl
        ? h('p', null, 'Fretwise has a secure address too. Open this one on this device:', h('br'), h('a', { class: 'link', href: secureUrl }, secureUrl))
        : h('p', null, info
          ? 'The secure address is switched off on this server (HTTPS_PORT=0), so microphone mode only works on the computer that runs Fretwise, at http://localhost.'
          : 'Open Fretwise at its https address instead (by default the same address with https:// in front and port 8421).'),
      secureUrl ? h('p', { class: 'muted' }, 'The first time, the browser warns that the certificate is not trusted. That is expected — your own computer made it. Choose “Advanced”, then “Proceed” (Safari: “Show details”, then “visit this website”).') : null,
    ] : [h('p', null, 'This browser does not offer microphone access. Try a current version of Chrome, Safari, Firefox or Edge.')],
    actions: (close) => [button('OK', { cls: 'btn-wide', onclick: close })],
  });
}

function micTest() {
  const fill = h('i');
  const heard = h('strong', { class: 'tuner-note' }, '–');
  const timer = setInterval(() => {
    fill.style.setProperty('width', `${Math.min(100, Math.round(Math.sqrt(mic.level) * 190))}%`);
    const cur = mic.current;
    heard.textContent = cur ? pitchName(spell(cur.midi)) : '–';
  }, 90);
  modal({
    title: 'Microphone check',
    body: [
      h('p', null, 'Pluck any open string. The bar should jump and the note name should appear.'),
      h('div', { class: 'listen-row' }, icon('microphone'), h('div', { class: 'meter' }, fill), heard),
      h('p', { class: 'muted' }, 'Put the device close to the guitar, and play one clear note at a time. From now on, “find the note” and song exercises listen to your guitar.'),
    ],
    onClose: () => clearInterval(timer),
    actions: (close) => [button('Sounds good', { cls: 'btn-wide', onclick: close })],
  });
}

export function settingsView(nav) {
  const state = store.state;
  const set = (fn) => store.update((st) => fn(st.settings));
  const row = (title, text, control) => h('div', { class: 'row' }, h('div', { class: 'row-text' }, h('strong', null, title), text ? h('small', null, text) : null), control);

  const inputControl = segmented(
    [{ value: 'tap', label: 'On-screen fretboard' }, { value: 'mic', label: 'My guitar (mic)' }], prefs.get('input'),
    async (value) => {
      if (value === 'tap') { prefs.set('input', 'tap'); mic.stop(); return; }
      if (!mic.supported) { prefs.set('input', 'tap'); nav.refresh(); micHelp(); return; }
      try {
        audio.unlock();
        await mic.start();
        prefs.set('input', 'mic');
        micTest();
      } catch (err) {
        prefs.set('input', 'tap');
        nav.refresh();
        toast(err && err.name === 'NotAllowedError' ? 'Microphone permission was refused. Allow it in the browser’s site settings and try again.' : 'The microphone could not be started.', { icon: 'microphone-slash', ms: 4500 });
      }
    }, 'How to answer');

  const info = store.info;
  const host = window.location.hostname;
  const addresses = [];
  if (info) {
    const ips = info.addresses.length ? info.addresses : [host];
    for (const ip of ips) {
      addresses.push(h('li', null, h('span', null, 'Everyday use'), h('code', null, `http://${ip}:${info.httpPort}`)));
      if (info.httpsPort) addresses.push(h('li', null, h('span', null, 'With microphone'), h('code', null, `https://${ip}:${info.httpsPort}`)));
    }
  }

  return h('div', { class: 'settings' },
    h('section', { class: 'card' },
      h('h2', null, 'Learning'),
      row('Daily goal', 'How much XP you aim for each day', segmented(GOALS.map((g) => ({ value: g.xp, label: String(g.xp) })), state.settings.goal, (v) => set((x) => { x.goal = Number(v); }), 'Daily goal'))),
    h('section', { class: 'card' },
      h('h2', null, 'On this device'),
      row('Answer with', 'Tap the fretboard on screen, or let Fretwise listen to your guitar', inputControl),
      row('Sound', 'Notes, the metronome and feedback sounds', toggle(prefs.get('sound'), (v) => { prefs.set('sound', v); audio.setEnabled(v); if (v) { audio.unlock(); audio.sfx('pop'); } }, 'Sound')),
      row('Appearance', null, segmented([{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], prefs.get('theme'), (v) => { prefs.set('theme', v); applyTheme(); }, 'Appearance'))),
    h('section', { class: 'card' },
      h('h2', null, 'Fretboard diagram'),
      row('Left-handed', 'Mirror the neck so the nut is on the right', toggle(state.settings.leftHanded, (v) => set((x) => { x.leftHanded = v; }), 'Left-handed')),
      row('Low E on top', 'Show the thickest string at the top, as you see it when you look down at your guitar', toggle(state.settings.lowOnTop, (v) => set((x) => { x.lowOnTop = v; }), 'Low E on top'))),
    store.standalone ? h('section', { class: 'card' },
      h('h2', null, 'Your progress'),
      h('p', { class: 'muted' }, 'Your progress is kept in this browser, on this device only. Clearing the browser’s site data removes them.')
    ) : h('section', { class: 'card' },
      h('h2', null, 'Use it on another device'),
      h('p', { class: 'muted' }, 'Any phone, tablet or computer on the same network can open Fretwise. Your progress follows you.'),
      addresses.length ? h('ul', { class: 'addresses' }, addresses) : h('p', { class: 'muted' }, 'Address information is not available right now.'),
      !store.online ? h('p', { class: 'form-error' }, 'The server cannot be reached at the moment. Progress is being kept on this device and will be sent when the connection is back.') : null),
    h('section', { class: 'card' },
      h('h2', null, 'Reset'),
      row('Reset progress', 'Start over: XP, streak, stars and awards go back to zero', button('Reset', {
        kind: 'bad', cls: 'btn-small reset-progress', icon: 'trash',
        onclick: async () => {
          if (!await confirmDialog({ title: 'Reset all progress?', text: 'XP, streak, stars, awards and what Fretwise remembers about your notes will start again from zero. This cannot be undone.', yes: 'Reset', danger: true })) return;
          await store.reset();
          toast('Progress reset', { icon: 'check-circle' });
          nav.go('/');
        },
      }))),
    h('section', { class: 'card about' },
      h('h2', null, 'About'),
      h('p', { class: 'muted' }, `Fretwise ${info ? info.version : ''} — runs entirely on your own network; nothing leaves it.`),
      h('p', { class: 'muted' }, 'Music symbols: Bravura (', h('a', { class: 'link', href: 'licenses/Bravura-OFL.txt' }, 'SIL OFL'), '). Typeface: Nunito (',
        h('a', { class: 'link', href: 'licenses/Nunito-OFL.txt' }, 'SIL OFL'), '). Icons: Phosphor (', h('a', { class: 'link', href: 'licenses/Phosphor-MIT.txt' }, 'MIT'), '). All tunes are in the public domain.')));
}
