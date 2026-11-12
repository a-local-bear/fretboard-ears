// Riffs: how well a note fits the chord under it, a report on a whole riff, idea generators in
// three styles, and where to play it on the neck. Pure.
// A riff is one entry per step (8th note): semitones above the tonic, or null for no new note.

import { mod12, SCALES, PENTA, QUALITIES, chordPcs, chordName, noteName, noteNameOver, degreeLabel } from './theory.js';
import { STEPS_PER_BAR, RIFF_LO, RIFF_HI, chordSteps, totalSteps, tonicMidi } from './song.js';
import { OPEN_STRINGS } from './shapes.js';

/**
 * How a note sits on a chord:
 *   chord  a chord tone: always fits
 *   scale  in the key but not in the chord: colour, good in passing
 *   rub    in the key, a half step above a chord tone: clashes if held, wants to step down
 *   out    outside the key: an approach note, a half step from where it is going
 */
export function fit(offset, chord, mode) {
  const pc = mod12(offset);
  const pcs = chordPcs(chord);
  if (pcs.includes(pc)) return 'chord';
  if (!SCALES[mode].includes(pc)) return 'out';
  return pcs.includes(mod12(pc - 1)) ? 'rub' : 'scale';
}

const offsetsOf = (pcs) => {
  const out = [];
  for (let o = RIFF_LO; o <= RIFF_HI; o++) if (pcs.includes(mod12(o))) out.push(o);
  return out;
};
const nearest = (list, target) => list.reduce((best, o) => (Math.abs(o - target) < Math.abs(best - target) ? o : best), list[0]);

/** Rows of the riff grid, top (high) to bottom: 'penta' | 'scale' | 'all', plus any note the riff already uses. */
export function gridRows(song, kind) {
  const pcs = kind === 'all' ? [...Array(12).keys()]
    : kind === 'penta' ? PENTA[song.mode]
      : [...new Set(SCALES[song.mode].concat(song.chords.flatMap(chordPcs)))];
  const rows = new Set(offsetsOf(pcs));
  for (const o of song.riff) if (o != null) rows.add(o);
  return [...rows].sort((a, b) => b - a);
}

/** Onsets of the riff in order: [{ step, offset, chord (index), fit }]. */
export function riffNotes(song) {
  const at = chordSteps(song);
  const out = [];
  song.riff.forEach((offset, step) => {
    if (offset != null && at[step] != null) out.push({ step, offset, chord: at[step], fit: fit(offset, song.chords[at[step]], song.mode) });
  });
  return out;
}

const isStrong = (step) => step % 4 === 0; // beats 1 and 3
const barOf = (step) => Math.floor(step / STEPS_PER_BAR) + 1;
const beatText = (step) => {
  const s = step % STEPS_PER_BAR;
  return s % 2 ? `the "and" of ${(s - 1) / 2 + 1}` : `beat ${s / 2 + 1}`;
};
const list = (items) => (items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);

/** Rhythm of each full bar as a string of x and '.', e.g. 'x..x..x.'. */
export function barRhythms(song) {
  const bars = Math.floor(song.riff.length / STEPS_PER_BAR);
  return Array.from({ length: bars }, (_, b) =>
    song.riff.slice(b * STEPS_PER_BAR, (b + 1) * STEPS_PER_BAR).map((o) => (o == null ? '.' : 'x')).join(''));
}

/** A riff checked against the rules the lessons teach: { count, lines: [{ ok (true | false | null = neutral), text }] }. */
export function riffReport(song) {
  const notes = riffNotes(song);
  const lines = [];
  if (!notes.length) return { count: 0, lines };
  const name = (n) => noteNameOver(n.offset, song.chords[n.chord], song.key, song.mode);
  const cname = (n) => chordName(song.chords[n.chord], song.key, song.mode);

  const strong = notes.filter((n) => isStrong(n.step));
  if (strong.length) {
    const hit = strong.filter((n) => n.fit === 'chord');
    const miss = strong.find((n) => n.fit !== 'chord');
    lines.push({
      ok: hit.length / strong.length >= 0.75,
      text: `${hit.length} of ${strong.length} notes on beats 1 and 3 are chord tones.` +
        (miss ? ` Bar ${barOf(miss.step)}, ${beatText(miss.step)}: ${name(miss)} is not in ${cname(miss)}.` : ' That is why it sounds like it belongs.'),
    });
  } else lines.push({ ok: null, text: 'Nothing lands on beat 1 or 3. That floats nicely, but one landing per bar helps the ear.' });

  const tense = notes.map((n, i) => ({ n, next: notes[i + 1] })).filter(({ n }) => n.fit === 'rub' || n.fit === 'out');
  if (tense.length) {
    const hanging = tense.filter(({ n, next }) => !next || Math.abs(next.offset - n.offset) > 2 || next.fit === 'rub' || next.fit === 'out');
    const h = hanging[0]?.n;
    lines.push(hanging.length
      ? { ok: false, text: `${hanging.length} of ${tense.length} rubbing notes ${hanging.length === 1 ? 'is' : 'are'} left hanging. Bar ${barOf(h.step)}: follow ${name(h)} with the note a step away, or move it off the chord.` }
      : { ok: true, text: `${tense.length === 1 ? 'The rubbing note resolves' : `All ${tense.length} rubbing notes resolve`} by step. Tension, then release.` });
  }

  let oneRhythm = false;
  const rhythms = barRhythms(song);
  const used = rhythms.map((r, i) => ({ r, bar: i + 1 })).filter(({ r }) => r.includes('x'));
  if (used.length > 1) {
    const groups = new Map();
    for (const { r, bar } of used) groups.set(r, (groups.get(r) || []).concat(bar));
    const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
    oneRhythm = best.length === used.length;
    lines.push(best.length > 1
      ? { ok: true, text: `Bars ${list(best)} share one rhythm. Repetition is what turns notes into a riff.` }
      : { ok: false, text: 'Every bar has a different rhythm. Repeat one of them so the ear has something to hold on to.' });
  }

  const density = notes.length / song.riff.length;
  lines.push(density > 0.8
    ? (oneRhythm
      ? { ok: null, text: 'Every 8th note is filled with the same pattern in each bar: a picking riff. Let the notes ring into each other.' }
      : { ok: false, text: 'Almost every 8th note is filled. Leave a gap: a riff breathes in its rests.' })
    : { ok: true, text: 'There is space between the notes, so the rhythm can be heard.' });

  const last = notes[notes.length - 1];
  const stable = [0, song.mode === 'minor' ? 3 : 4, 7].includes(mod12(last.offset));
  lines.push({
    ok: null,
    text: stable
      ? `It ends on ${name(last)} (${degreeLabel(last.offset)}), a resting note of the key: the phrase sounds finished.`
      : `It ends on ${name(last)} (${degreeLabel(last.offset)}), not a resting note: the phrase asks a question, which suits a loop.`,
  });
  return { count: notes.length, lines };
}

// ---------- idea generators ----------

/** Small deterministic random generator, so a seed always gives the same idea. */
export function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POP_RHYTHMS = ['x.x.x...', 'x..x..x.', 'x.xx.x..', 'x..x.x..', 'x.x..x..', 'xx.x..x.', 'x...x.x.'];
const INDIE_TEMPLATES = ['LDMDLDMD', 'L-DL-DMD', 'LMDMLMDM', 'LDDMDDLD', 'L-MD-MD-'];
const JAZZ_8 = ['xxxx...a', 'xx.xx..a', 'x..xxx.a', 'xxx..x.a'];
const JAZZ_4 = ['xxxa', 'x.xa', 'xx.a'];

const empty = (song) => Array.from({ length: totalSteps(song) }, () => null);
const chordOffsets = (chord) => offsetsOf(chordPcs(chord));

/** A sung-style hook: one rhythm repeated, pentatonic steps, chord tones on the strong beats, an answer in bar 4. */
function genPop(song, rnd) {
  const riff = empty(song);
  const at = chordSteps(song);
  const penta = offsetsOf(PENTA[song.mode]);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const rA = pick(POP_RHYTHMS);
  const rB = pick(POP_RHYTHMS.filter((r) => r !== rA));
  const walk = (len, bias) => Array.from({ length: len }, (_, i) => (i === 0 ? 0 : pick([-1, -1, 1, 1, 0, 2 * bias, bias])));
  const count = (r) => [...r].filter((c) => c === 'x').length;
  const mA = walk(count(rA), pick([-1, 1]));
  const mB = walk(count(rB), -1);
  const centre = 3 + Math.floor(rnd() * 4);
  const bars = Math.ceil(riff.length / STEPS_PER_BAR);
  let lastStep = null;
  for (let b = 0; b < bars; b++) {
    const answer = bars > 1 && (b % 4 === 3 || (b === bars - 1 && bars < 4));
    const rhythm = answer ? rB : rA;
    const moves = answer ? mB : mA;
    const s0 = b * STEPS_PER_BAR;
    if (at[s0] == null) break;
    let idx = penta.indexOf(nearest(penta, nearest(chordOffsets(song.chords[at[s0]]), centre)));
    let k = 0;
    for (let i = 0; i < STEPS_PER_BAR && s0 + i < riff.length; i++) {
      if (rhythm[i] !== 'x') continue;
      const s = s0 + i;
      const chord = song.chords[at[s]];
      idx = Math.min(penta.length - 1, Math.max(0, idx + moves[k++]));
      let o = penta[idx];
      if (isStrong(s) || fit(o, chord, song.mode) !== 'chord' && fit(o, chord, song.mode) !== 'scale') o = nearest(chordOffsets(chord), o);
      riff[s] = o;
      idx = penta.indexOf(nearest(penta, o));
      lastStep = s;
    }
  }
  if (lastStep != null) riff[lastStep] = nearest(chordOffsets(song.chords[at[lastStep]]), riff[lastStep]);
  return {
    riff,
    why: [
      'One rhythm, repeated bar after bar, with a different answer in the last bar. That repetition is the hook.',
      `Almost every note is from the ${song.mode} pentatonic: five notes with no half steps between them, so nothing rubs.`,
      'Every note on beats 1 and 3 is a tone of the chord under it. The notes between move by step, like a voice would.',
    ],
  };
}

/** A picked riff: a low voice that moves with the chords against a high note that never changes. */
function genIndie(song, rnd) {
  const riff = empty(song);
  const at = chordSteps(song);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const template = pick(INDIE_TEMPLATES);
  // The drone that rubs against the fewest chords; a coin toss between equals.
  const clashes = (d) => song.chords.filter((c) => ['rub', 'out'].includes(fit(d, c, song.mode))).length;
  const drone = [7, 12].sort((x, y) => clashes(x) - clashes(y) || rnd() - 0.5)[0];
  let low = pick([0, 2, 4]);
  let prevChord = -1;
  let L = 0;
  let M = 0;
  let D = drone;
  for (let s = 0; s < riff.length; s++) {
    const chord = song.chords[at[s]];
    if (at[s] !== prevChord) {
      prevChord = at[s];
      const tones = chordOffsets(chord).filter((o) => o <= 5);
      L = nearest(tones, low);
      low = L;
      const ninth = chord.root + 2;
      const colour = offsetsOf([mod12(ninth)]).filter((o) => o > L && o < drone && SCALES[song.mode].includes(mod12(o)) && fit(o, chord, song.mode) !== 'rub');
      const above = chordOffsets(chord).filter((o) => o > L && o < drone);
      M = (rnd() < 0.45 && colour.length ? colour[0] : above[0]) ?? L;
      D = fit(drone, chord, song.mode) === 'out' ? nearest(chordOffsets(chord), drone) : drone;
    }
    const ch = template[s % STEPS_PER_BAR];
    riff[s] = ch === 'L' ? L : ch === 'M' ? M : ch === 'D' ? D : null;
  }
  const dn = noteName(drone, song.key, song.mode);
  return {
    riff,
    why: [
      `A high ${dn} rings through every chord. Over some chords it is a chord tone, over others it adds a sus or add9 shimmer. That is the indie sound.`,
      'The low voice moves to the nearest tone of each new chord, so the riff changes as little as possible while the harmony moves.',
      'The picking pattern is the same in every bar. Let the notes ring into each other.',
    ],
  };
}

/** Guide tones of a chord (its 3rd and 7th, or 3rd and 5th for a triad) as offsets. */
export function guideTones(chord) {
  const iv = QUALITIES[chord.q].iv;
  return offsetsOf([mod12(chord.root + iv[1]), mod12(chord.root + (iv[3] ?? iv[2]))]);
}

/** A jazz line: each chord starts on its 3rd or 7th, arpeggios in between, a chromatic approach note into the next chord. */
function genJazz(song, rnd) {
  const riff = empty(song);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const segs = [];
  let start = 0;
  for (const chord of song.chords) {
    const len = chord.beats * 2;
    for (let o = 0; o < len; o += STEPS_PER_BAR) segs.push({ chord, start: start + o, len: Math.min(STEPS_PER_BAR, len - o), lastOfChord: o + STEPS_PER_BAR >= len });
    start += len;
  }
  const targetFor = (chord, from) => nearest(guideTones(chord).filter((o) => o >= 0 && o <= 11), from);
  const first = targetFor(segs[0].chord, 5);
  let target = first;
  segs.forEach((seg, i) => {
    const tpl = pick(seg.len >= STEPS_PER_BAR ? JAZZ_8 : JAZZ_4).slice(0, seg.len);
    const ninth = mod12(seg.chord.root + 2);
    const pool = offsetsOf(chordPcs(seg.chord).concat(SCALES[song.mode].includes(ninth) && QUALITIES[seg.chord.q].fam !== 'dim' ? [ninth] : []));
    let idx = pool.indexOf(nearest(pool, target));
    let dir = target > 5 ? -1 : 1;
    let firstNote = true;
    const next = segs[(i + 1) % segs.length];
    const nextTarget = i + 1 === segs.length ? first : next.chord === seg.chord ? null : targetFor(next.chord, pool[idx]);
    [...tpl].forEach((ch, k) => {
      const s = seg.start + k;
      if (ch === 'x') {
        if (firstNote) { riff[s] = pool[idx]; firstNote = false; return; }
        if (idx + dir < 0 || idx + dir >= pool.length) dir = -dir;
        idx += dir;
        riff[s] = pool[idx];
      } else if (ch === 'a') {
        if (nextTarget == null) { idx += idx + dir < 0 || idx + dir >= pool.length ? -dir : dir; riff[s] = pool[idx]; } else riff[s] = nextTarget - 1 >= RIFF_LO ? nextTarget - 1 : nextTarget + 1;
      }
    });
    target = nextTarget ?? targetFor(next.chord, pool[idx]);
  });
  return {
    riff,
    why: [
      'Each chord starts on its 3rd or its 7th. These guide tones are the two notes that tell one chord from the next, so the line spells out the harmony by itself.',
      'The last note before each change sits a half step below the note it is heading for. It is outside the key for an instant, then resolves: a chromatic approach.',
      'In between, the line runs up or down the chord, one tone after another, and leaves a hole in the bar. Play it with a swing.',
    ],
  };
}

export const STYLES = {
  indie: { name: 'Indie', gen: genIndie, hint: 'A drone on top, a moving voice below' },
  pop: { name: 'Pop', gen: genPop, hint: 'A pentatonic hook with one rhythm' },
  jazz: { name: 'Jazzy', gen: genJazz, hint: 'Guide tones and approach notes' },
};

/** A riff idea for the song's chords: { riff, why: [sentences] }. */
export const generate = (song, style, seed) => STYLES[style].gen(song, rng32(seed));

/**
 * Repeat bar 1 through the whole riff, fitted to each chord: notes on beats 1 and 3 move to the
 * nearest chord tone, and notes that would rub or leave the key move to the nearest note that fits.
 */
export function fitMotif(song) {
  const at = chordSteps(song);
  const motif = song.riff.slice(0, STEPS_PER_BAR);
  return song.riff.map((_, s) => {
    const o = motif[s % STEPS_PER_BAR];
    if (o == null || s < STEPS_PER_BAR) return s < STEPS_PER_BAR ? o ?? null : null;
    const chord = song.chords[at[s]];
    const f = fit(o, chord, song.mode);
    if (isStrong(s)) return f === 'chord' ? o : nearest(chordOffsets(chord), o);
    if (f === 'rub' || f === 'out') {
      const ok = offsetsOf(SCALES[song.mode]).filter((x) => fit(x, chord, song.mode) !== 'rub');
      return nearest(ok, o);
    }
    return o;
  });
}

// ---------- on the neck ----------

/**
 * Where to play a set of MIDI notes: { lo, hi (fret window), pos: Map midi → [string, fret] }.
 * The lowest five-fret window (open strings allowed near the nut) that holds every note; a note
 * that fits nowhere in it takes its lowest fret.
 */
export function neckWindow(midis) {
  const uniq = [...new Set(midis)];
  const places = (m) => OPEN_STRINGS.map((open, s) => [s, m - open]).filter(([, f]) => f >= 0 && f <= 15);
  const inWindow = (w) => ([, f]) => (f >= w && f <= w + 4) || (f === 0 && w <= 2);
  let best = 0;
  for (let w = 0; w <= 11; w++) {
    if (uniq.every((m) => places(m).some(inWindow(w)))) { best = w; break; }
    if (w === 11) best = Math.max(0, Math.min(...uniq.map((m) => Math.min(...places(m).map(([, f]) => f)))));
  }
  const pos = new Map();
  for (const m of uniq) {
    const all = places(m);
    const fits = all.filter(inWindow(best));
    const [s, f] = (fits.length ? fits : all).reduce((a, b) => (b[1] < a[1] ? b : a));
    pos.set(m, [s, f]);
  }
  return { lo: best, hi: best + 4, pos };
}

/** The riff as guitar tab, one string per line (high e first), bars separated by |. */
export function tabLines(song) {
  const tonic = tonicMidi(song.key);
  const { pos } = neckWindow(song.riff.filter((o) => o != null).map((o) => tonic + o));
  const names = ['E', 'A', 'D', 'G', 'B', 'e'];
  return [5, 4, 3, 2, 1, 0].map((string) => {
    let line = names[string] + '|';
    song.riff.forEach((o, s) => {
      const p = o == null ? null : pos.get(tonic + o);
      line += p && p[0] === string ? String(p[1]).padEnd(2, '-') : '--';
      if ((s + 1) % STEPS_PER_BAR === 0) line += '|';
    });
    return line.endsWith('|') ? line : line + '|';
  });
}
