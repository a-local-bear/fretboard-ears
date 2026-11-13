// Melody helpers: a tiny notation for lesson examples, where to play a line
// on the neck, an idea generator, and the stats behind the Studio's coach.
//
// A melody note is { s, d, p }: start and duration in 16th-note steps, and
// pitch as semitones above the key's "home" tonic (see tonicMidi) — so a
// melody follows the song when the key changes.

import { mod12 } from './theory.js';
import { OPEN_MIDI } from './voicings.js';

// The tonic nearest the middle of the guitar's melody range: G3 … F#4.
export const tonicMidi = (keyPc) => 55 + mod12(keyPc - 7);
export const MELODY_LO = -8;
export const MELODY_HI = 16;

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

// "3:2 5 6 5:4 | r:2 1' b7 5"
//   scale degree of the MAJOR scale (b3, #4 allowed), ' = octave up, , = octave
//   down, r = rest, :n = length in 8th notes (default 1). Bar lines are optional.
export function parseMelody(str) {
  const notes = [];
  let at = 0;
  for (const tok of str.split(/[\s|]+/).filter(Boolean)) {
    const m = /^(r|[b#]?[1-7])([',]*)(?::(\d+(?:\.\d+)?))?$/.exec(tok);
    if (!m) throw new Error(`Bad melody token: ${tok}`);
    const d = Math.round((m[3] ? Number(m[3]) : 1) * 2);
    if (m[1] !== 'r') {
      const acc = m[1].length === 2 ? (m[1][0] === 'b' ? -1 : 1) : 0;
      let p = MAJOR_STEPS[Number(m[1].slice(-1)) - 1] + acc;
      for (const ch of m[2]) p += ch === "'" ? 12 : -12;
      notes.push({ s: at, d, p });
    }
    at += d;
  }
  return notes;
}

// ------------------------------------------------------------- the neck ----

// Choose a string + fret for each note, staying inside the four-fret box that
// starts at `pos` whenever possible.  notes: [{ midi, … }]
export function assignFrets(notes, pos) {
  let prev = null;
  return notes.map((n) => {
    let best = null;
    let bestCost = Infinity;
    for (let string = 0; string < 6; string++) {
      const fret = n.midi - OPEN_MIDI[string];
      if (fret < 0 || fret > 19) continue;
      let cost = fret < pos ? (pos - fret) * 2 : fret > pos + 4 ? (fret - pos - 4) * 2 : 0;
      if (fret === 0) cost = Math.min(cost, 1.2);
      if (prev) cost += Math.abs(string - prev.string) * 0.2;
      cost += (5 - string) * 0.05; // melodies sit a little better on the higher strings
      if (cost < bestCost) {
        bestCost = cost;
        best = { string, fret };
      }
    }
    if (!best) {
      best = n.midi < OPEN_MIDI[0] ? { string: 0, fret: 0 } : { string: 5, fret: 19 };
      bestCost = 50;
    }
    prev = best;
    return { ...n, ...best, cost: bestCost };
  });
}

export function bestPosition(notes) {
  let best = 0;
  let bestCost = Infinity;
  for (let pos = 0; pos <= 12; pos++) {
    const cost = assignFrets(notes, pos).reduce((sum, n) => sum + n.cost, 0) + pos * 0.02;
    if (cost < bestCost - 1e-9) {
      bestCost = cost;
      best = pos;
    }
  }
  return best;
}

// Plain-text tab, two bars per line.  placed: output of assignFrets with s/d.
export function asciiTab(placed, totalSteps) {
  const names = ['e', 'B', 'G', 'D', 'A', 'E'];
  const cells = names.map(() => new Array(totalSteps).fill('--'));
  for (const n of placed) {
    if (n.s >= totalSteps) continue;
    const row = 5 - n.string;
    cells[row][n.s] = String(n.fret).padEnd(2, '-');
  }
  const out = [];
  for (let from = 0; from < totalSteps; from += 32) {
    const to = Math.min(totalSteps, from + 32);
    names.forEach((name, row) => {
      let line = `${name}|`;
      for (let st = from; st < to; st++) {
        line += cells[row][st];
        if ((st + 1) % 16 === 0) line += '|';
      }
      out.push(line);
    });
    out.push('');
  }
  return out.join('\n').trimEnd();
}

// ------------------------------------------------------------ generator ----

// One-bar rhythm cells in 8th-note slots: [start, length].
const RHYTHMS = [
  [[0, 2], [2, 1], [3, 3]],
  [[1, 1], [2, 1], [3, 2], [6, 2]],
  [[0, 1], [1, 1], [2, 2], [5, 1], [6, 2]],
  [[0, 3], [3, 1], [4, 3]],
  [[2, 1], [3, 1], [4, 3]],
  [[0, 2], [3, 1], [4, 2], [6, 1]],
  [[0, 1], [1, 2], [4, 1], [5, 2]],
  [[1, 1], [2, 2], [4, 3]],
];
const ENDINGS = [
  [[0, 2], [2, 5]],
  [[0, 1], [1, 1], [2, 5]],
  [[1, 1], [2, 5]],
  [[0, 3], [3, 4]],
];
// Melodic shapes, as moves along the scale after the first note.
const CONTOURS = [
  [1, 1, -1, -1], [-1, -1, 1, 2], [2, -1, -1, 1], [1, -2, 1, 1], [-1, 2, -1, -1], [0, 1, 1, -2], [1, 0, -1, -1], [-2, 1, 1, 0],
];

// Builds a motif-based line: a short rhythm that repeats, a shape that follows
// the chords, chord tones on the strong beats, and an ending that lands.
//   spans:   [{ start, len, pcs }]  (absolute pitch classes of each chord)
//   scale:   scale intervals above the tonic, e.g. [0,2,4,7,9]
export function generateMelody({ spans, scale, total, keyPc }, rand = Math.random) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const lo = -5;
  const hi = 12;
  const ladder = [];
  for (let p = lo; p <= hi; p++) if (scale.includes(mod12(p))) ladder.push(p);
  if (!ladder.length || !spans.length) return [];

  const spanAt = (step) => spans.find((sp) => step >= sp.start && step < sp.start + sp.len) || spans[spans.length - 1];
  const isTone = (p, sp) => sp.pcs.includes(mod12(p + keyPc));
  const nearestTone = (p, sp, avoidRoot = false) => {
    for (let dist = 0; dist <= 6; dist++) {
      for (const cand of dist === 0 ? [p] : [p - dist, p + dist]) {
        if (cand < lo || cand > hi || !isTone(cand, sp)) continue;
        if (avoidRoot && mod12(cand + keyPc) === sp.pcs[0] && dist < 3) continue;
        return cand;
      }
    }
    return p;
  };
  const rungOf = (p) => {
    let best = 0;
    ladder.forEach((v, i) => {
      if (Math.abs(v - p) < Math.abs(ladder[best] - p)) best = i;
    });
    return best;
  };

  const bars = Math.ceil(total / 16);
  const rhythmA = pick(RHYTHMS);
  const rhythmB = pick(RHYTHMS);
  const contourA = pick(CONTOURS);
  const contourB = pick(CONTOURS);
  let anchor = rungOf(pick([2, 4, 7, 9])); // start somewhere around the 3rd–6th
  const notes = [];

  for (let bar = 0; bar < bars; bar++) {
    const last = bar === bars - 1;
    const answer = bar % 4 === 3 || (bars <= 2 && last);
    const useB = !answer && bar % 2 === 1 && rand() < 0.45;
    const rhythm = answer ? pick(ENDINGS) : useB ? rhythmB : rhythmA;
    const contour = useB ? contourB : contourA;
    let rung = anchor;
    rhythm.forEach(([slot, len], k) => {
      const s = bar * 16 + slot * 2;
      if (s >= total) return;
      const sp = spanAt(s);
      if (k > 0) rung = Math.max(0, Math.min(ladder.length - 1, rung + contour[(k - 1) % contour.length]));
      let p = ladder[rung];
      const finalNote = answer && k === rhythm.length - 1;
      const strong = slot % 4 === 0 || len >= 3 || k === 0;
      if (strong || finalNote) {
        p = nearestTone(p, sp, !finalNote && k === 0);
        rung = rungOf(p);
      }
      notes.push({ s, d: Math.min(len * 2, total - s), p });
    });
    // Let each phrase start a step away from the last so the line travels.
    anchor = Math.max(1, Math.min(ladder.length - 2, anchor + pick([-1, -1, 0, 1, 1, 2])));
  }

  // No overlaps: a note ends where the next begins.
  notes.sort((a, b) => a.s - b.s);
  for (let i = 0; i < notes.length - 1; i++) notes[i].d = Math.max(1, Math.min(notes[i].d, notes[i + 1].s - notes[i].s));
  return notes;
}

// ---------------------------------------------------------------- stats ----

export function analyzeMelody(notes, spans, keyPc, total) {
  if (!notes.length || !spans.length) return null;
  const spanAt = (step) => spans.find((sp) => step >= sp.start && step < sp.start + sp.len) || spans[spans.length - 1];
  const sorted = [...notes].sort((a, b) => a.s - b.s);
  let tones = 0;
  let strong = 0;
  let strongTones = 0;
  let filled = 0;
  let biggestLeap = 0;
  const rhythms = new Map();
  sorted.forEach((n, i) => {
    const tone = spanAt(n.s).pcs.includes(mod12(n.p + keyPc));
    if (tone) tones++;
    if (n.s % 8 === 0 || n.d >= 6) {
      strong++;
      if (tone) strongTones++;
    }
    filled += n.d;
    if (i) biggestLeap = Math.max(biggestLeap, Math.abs(n.p - sorted[i - 1].p));
    const bar = Math.floor(n.s / 16);
    rhythms.set(bar, `${rhythms.get(bar) || ''}${n.s % 16}:${n.d} `);
  });
  const pitches = sorted.map((n) => n.p);
  const signatures = [...rhythms.values()];
  return {
    count: sorted.length,
    tonePct: tones / sorted.length,
    strongPct: strong ? strongTones / strong : null,
    range: Math.max(...pitches) - Math.min(...pitches),
    biggestLeap,
    density: filled / total,
    bars: signatures.length,
    distinctRhythms: new Set(signatures).size,
    lastIsTone: spanAt(sorted[sorted.length - 1].s).pcs.includes(mod12(sorted[sorted.length - 1].p + keyPc)),
  };
}
