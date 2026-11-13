// Small helpers shared by the lesson files.

import { parseProgression } from '../music/theory.js';

const JOB = { T: 'home', S: 'away', D: 'tension' };

// Checker for build challenges: the chords must do these jobs, in order.
export const jobs = (want) => (chords) => {
  if (chords.length !== want.length) return { ok: false, msg: `Use exactly ${want.length} chords (you have ${chords.length}).` };
  for (let i = 0; i < want.length; i++) {
    const { fn, kind } = chords[i].info;
    if (kind !== 'diatonic' || fn !== want[i]) {
      return { ok: false, msg: `Chord ${i + 1} (${chords[i].symbol}) is ${kind === 'diatonic' ? `a “${JOB[fn]}” chord` : 'from outside the key'} — that slot needs “${JOB[want[i]]}”.` };
    }
  }
  return { ok: true, msg: `${chords.map((c) => c.roman).join(' – ')}: ${want.map((w) => JOB[w]).join(' → ')}. Press play and hear the trip.` };
};

// Checker: exactly this progression (written in Roman numerals).
export const exactly = (prog) => (chords) => {
  const want = parseProgression(prog);
  const same = chords.length === want.length && want.every((w, i) => w.deg === chords[i].deg && w.q === chords[i].q);
  if (same) return { ok: true, msg: `${chords.map((c) => c.symbol).join(' – ')}. That's it.` };
  if (chords.length !== want.length) return { ok: false, msg: `You need ${want.length} chords.` };
  const firstWrong = want.findIndex((w, i) => w.deg !== chords[i].deg || w.q !== chords[i].q);
  return { ok: false, msg: `Chord ${firstWrong + 1} isn't right yet — check its numeral.` };
};

// Checker: at least `min` chords, one of which satisfies `test`.
export const includes = (test, min, okMsg, noMsg) => (chords) => {
  if (chords.length < min) return { ok: false, msg: `Use at least ${min} chords.` };
  const hit = chords.find(test);
  return hit ? { ok: true, msg: okMsg(hit, chords) } : { ok: false, msg: noMsg };
};

// "<li>…</li>" list from plain strings.
export const ul = (...items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
export const ol = (...items) => `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
