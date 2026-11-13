// Turns a lesson description into a concrete list of exercises.
// Everything here is plain data (no DOM) so it can be tested exhaustively;
// exercises.js knows how to put each exercise type on screen.

import { makeRng, uniqueBy, clamp } from './util.js';
import { parseMelody, measureBeats, parseDur, onsets, locate, parsePos } from './theory.js';
import { noteStrength } from './progress.js';
import { noteCard, learnedNotes, LESSONS } from './curriculum.js';

const LETTER_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const RHYTHM_PITCH = 'G4';

// rhythm building blocks: name -> duration codes ("rq" = quarter rest)
const CELLS = {
  q: ['q'], h: ['h'], 'h.': ['h.'], w: ['w'], qr: ['rq'], hr: ['rh'],
  ee: ['e', 'e'], 'q.e': ['q.', 'e'], syn: ['e', 'q', 'e'],
  ssss: ['s', 's', 's', 's'], ess: ['e', 's', 's'], sse: ['s', 's', 'e'],
};
const isRestCode = (code) => code[0] === 'r';
const codeBeats = (code) => parseDur(isRestCode(code) ? code.slice(1) : code.replace('~', '')).beats;
const cellBeats = (name) => CELLS[name].reduce((a, c) => a + codeBeats(c), 0);
const codesToMelody = (bars, pitch = RHYTHM_PITCH) => bars.map((bar) => bar.map((c) => (isRestCode(c) ? `r:${c.slice(1)}` : `${pitch}:${c}`)).join(' ')).join(' | ');

/** a note as plain data for an exercise */
const ref = (n) => ({ key: n.key, s: n.s, f: n.f, pitch: n.pitch.id, name: n.name, nameId: n.nameId, sounding: n.sounding, step: n.step });
const sortNames = (ids) => ids.sort((a, b) => LETTER_ORDER.indexOf(a[0]) - LETTER_ORDER.indexOf(b[0]) || a.length - b.length || (a < b ? -1 : 1));
const neighbours = (letter) => { const i = LETTER_ORDER.indexOf(letter); return [LETTER_ORDER[(i + 6) % 7], LETTER_ORDER[(i + 1) % 7]]; };

/** answer buttons for "which note is this?" */
export function nameChoices(rng, note, pool, keySig = 0) {
  const correct = note.nameId;
  const letter = correct[0];
  const accidentals = keySig !== 0 || pool.some((n) => n.nameId.length > 1);
  if (!accidentals) {
    const letters = [...new Set(pool.map((n) => n.nameId))];
    if (letters.length >= 5) return LETTER_ORDER.slice();
    const set = new Set([correct, ...rng.shuffle(letters.filter((l) => l !== correct)).slice(0, 3)]);
    for (const l of rng.shuffle(neighbours(letter))) if (set.size < 4) set.add(l);
    return sortNames([...set]);
  }
  const flats = keySig < 0 || (keySig === 0 && correct.endsWith('b')) || (keySig === 0 && !correct.endsWith('#') && pool.some((n) => n.nameId.endsWith('b')) && !pool.some((n) => n.nameId.endsWith('#')));
  const set = new Set([correct]);
  set.add(correct.length > 1 ? letter : letter + (flats ? 'b' : '#')); // the same letter, altered the other way
  const [down, up] = neighbours(letter);
  // skip neighbours that are the same pitch under another name (E♯ = F, and so on)
  const clash = { 'E#': 'F', 'B#': 'C', Fb: 'E', Cb: 'B' };
  for (const cand of rng.shuffle([up, down, ...pool.map((n) => n.nameId)])) {
    if (set.size >= 4) break;
    if (![...set].some((x) => clash[x] === cand)) set.add(cand);
  }
  return sortNames([...set].filter((x) => !(x in clash)).concat([...set].filter((x) => x in clash && x === correct)));
}

// ---------------------------------------------------------------------------
class Generator {
  constructor(lesson, { rng, state, now }) {
    this.lesson = lesson;
    this.rng = rng;
    this.state = state;
    this.now = now;
    this.pool = lesson.pool;
    this.keySig = lesson.kind === 'keysig' ? lesson.keySig : 0;
    this.explicit = lesson.explicitAccidentals;
    this.frets = lesson.frets;
    const steps = this.pool.map((n) => n.step);
    this.range = steps.length ? [Math.min(...steps), Math.max(...steps)] : [0, 8];
    this.last = null;
    this.usedRhythms = new Set();
    const fresh = new Set(lesson.learn.map((n) => n.key));
    const unit = new Set(lesson.fresh);
    this.weight = (n) => (fresh.has(n.key) ? 4 : unit.has(n.key) ? 2 : 1) * (1 + 1.5 * (1 - (state ? noteStrength(state, n.key, now) : 0)));
  }

  // ---- choosing notes ----------------------------------------------------
  any(pool = this.pool) {
    const options = pool.length > 1 ? pool.filter((n) => n.key !== this.last) : pool;
    const n = this.rng.weighted(options, this.weight);
    this.last = n.key;
    return n;
  }

  staffOpts() { return { keySig: this.keySig, range: this.range, explicit: this.explicit }; }

  // ---- single-note exercises ---------------------------------------------
  find(n) {
    return { type: 'find', note: ref(n), frets: this.frets, ...this.staffOpts() };
  }
  // ---- phrases -----------------------------------------------------------
  /** a stepwise wander through the known notes */
  walk(length, focus = []) {
    const { rng } = this;
    const sorted = uniqueBy(this.pool.slice().sort((a, b) => a.sounding - b.sounding), (n) => n.sounding);
    const at = (n) => Math.max(0, sorted.findIndex((x) => x.sounding === n.sounding));
    if (sorted.length === 1) return Array(length).fill(sorted[0]);
    let i = focus.length ? at(rng.pick(focus)) : rng.int(0, sorted.length - 1);
    const out = [sorted[i]];
    let guard = 0;
    while (out.length < length && guard++ < 400) {
      const r = rng.next();
      const step = r < 0.1 ? 0 : (r < 0.7 ? 1 : r < 0.9 ? 2 : 3) * (rng.chance(0.5) ? 1 : -1);
      let j = focus.length && rng.chance(0.18) ? at(rng.pick(focus)) : i + step;
      if (j < 0 || j >= sorted.length) j = i - step;
      j = clamp(j, 0, sorted.length - 1);
      if (j === i && out.length >= 2 && out.at(-2) === sorted[i]) continue; // never three in a row
      i = j;
      out.push(sorted[i]);
    }
    while (out.length < length) out.push(sorted[i]);
    // every new note should turn up when there is room for it
    for (const f of focus) {
      if (out.length <= focus.length || out.some((n) => n.sounding === f.sounding)) continue;
      const slots = out.map((n, k) => k).filter((k) => !focus.some((x) => x.sounding === out[k].sounding));
      if (slots.length) out[rng.pick(slots)] = sorted[at(f)];
    }
    return out;
  }

  phraseFrom(notes, extra = {}) {
    return {
      type: 'phrase', melody: notes.map((n) => `${n.pitch.id}:q`).join(' '), timeSig: null, bpm: 84,
      where: notes.map((n) => n.key), frets: this.frets, ...this.staffOpts(), ...extra,
    };
  }
  phrase(length, focus = []) { return this.phraseFrom(this.walk(length, focus)); }

  /** a tune with a real rhythm, `bars` measures long */
  tune(bars, spec = this.lesson.melody) {
    const codes = rhythmBars(this.rng, spec, bars, this.usedRhythms);
    const strikes = codes.flat().filter((c) => !isRestCode(c)).length;
    const notes = this.walk(strikes, this.lesson.learn);
    let k = 0;
    const where = [];
    const melody = codes.map((bar) => bar.map((c) => {
      if (isRestCode(c)) return `r:${c.slice(1)}`;
      const n = notes[k++];
      where.push(n.key);
      return `${n.pitch.id}:${c}`;
    }).join(' ')).join(' | ');
    return { type: 'phrase', melody, timeSig: spec.timeSig, bpm: spec.bpm ?? 80, where, frets: this.frets, ...this.staffOpts() };
  }

  // ---- rhythm ------------------------------------------------------------
  tap(bars) {
    const spec = this.lesson.rhythm;
    if (measureBeats(spec.timeSig) <= 3) bars = Math.max(bars, 2); // one bar of three-four is too little to tap
    const melody = spec.patterns ? patternMelody(this.rng, spec, this.usedRhythms) : codesToMelody(rhythmBars(this.rng, spec, bars, this.usedRhythms));
    return { type: 'rhythmTap', melody, timeSig: spec.timeSig, bpm: spec.bpm, counts: spec.counts ?? null };
  }

  /** a phrase written out note by note: bars is a list of bars, each a list of [note, duration] */
  written(bars, extra = {}) {
    const where = [];
    const melody = bars.map((bar) => bar.map(([n, d]) => { where.push(n.key); return `${n.pitch.id}:${d}`; }).join(' ')).join(' | ');
    return { type: 'phrase', melody, timeSig: [4, 4], bpm: 76, where, frets: this.frets, ...this.staffOpts(), ...extra };
  }

  /**
   * The bar-line rule as a phrase to play.  `same`: a sharp/flat is repeated in the same bar without its sign (still
   * altered); `next`: the plain note comes back after a bar line; `natural`: a natural sign cancels the alteration.
   */
  accPhrase(variant) {
    const { rng } = this;
    const altered = this.pool.filter((n) => n.pitch.alter !== 0 && this.pool.some((m) => m.pitch.alter === 0 && m.pitch.letter === n.pitch.letter && m.pitch.octave === n.pitch.octave));
    const sharp = this.any(altered);
    const plain = this.pool.find((m) => m.pitch.alter === 0 && m.pitch.letter === sharp.pitch.letter && m.pitch.octave === sharp.pitch.octave);
    const others = rng.shuffle(this.pool.filter((n) => n.pitch.alter === 0 && n.pitch.letter !== sharp.pitch.letter && Math.abs(n.step - sharp.step) <= 4));
    const [x, y] = [others[0] ?? plain, others[1] ?? others[0] ?? plain];
    if (variant === 'same') return this.written([[[sharp, 'q'], [x, 'q'], [sharp, 'q'], [y, 'q']]]);
    if (variant === 'next') return this.written([[[sharp, 'q'], [x, 'q'], [y, 'h']], [[plain, 'q'], [x, 'q'], [y, 'h']]]);
    return this.written([[[sharp, 'q'], [x, 'q'], [plain, 'q'], [y, 'q']]]);
  }

  // ---- lesson recipes ----------------------------------------------------
  // Everything a lesson asks is "play this": a single note (find), a phrase, a tune with rhythm, or a rhythm.

  /** each new note alone twice, mixed with known notes, then phrases of growing length that feature the new notes */
  notesLesson() {
    const L = this.lesson, n = L.learn.length;
    const known = this.pool.filter((x) => !L.learn.some((l) => l.key === x.key));
    const first = this.rng.shuffle(L.learn.slice());
    let again = n <= 3 ? this.rng.shuffle(L.learn.slice()) : L.learn.slice().sort((a, b) => this.weight(b) - this.weight(a)).slice(0, 2);
    if (n > 1 && again[0] === first.at(-1)) again = [...again.slice(1), again[0]];
    const items = [...first, ...again];
    if (!known.length && n <= 2) { // nothing else to mix in yet (the very first lesson): one more round of the new notes
      const third = this.rng.shuffle(L.learn.slice());
      if (n > 1 && third[0] === items.at(-1)) third.reverse();
      items.push(...third);
    }
    const fillers = known.length ? (n <= 3 ? 2 : 1) : 0;
    for (let k = fillers; k >= 1; k--) items.splice(Math.round((k * items.length) / (fillers + 1)), 0, null);
    const out = items.map((note) => this.find(note ?? this.any(known)));
    const lengths = n === 1 ? [3, 4, 5, 6] : n <= 3 ? [3, 5, 6] : [4, 6];
    for (const len of lengths) out.push(this.phrase(len, L.learn));
    return out;
  }

  /** weak single notes, phrases and (where the lesson has a rhythm) tunes */
  mixLesson() {
    const tune = (bars, len) => (this.lesson.melody ? this.tune(bars) : this.phrase(len));
    return [
      this.find(this.any()), this.find(this.any()), this.phrase(4), this.find(this.any()), this.find(this.any()),
      tune(1, 5), this.find(this.any()), this.phrase(5), this.find(this.any()), tune(2, 6),
    ];
  }

  melodyLesson() {
    return [this.tune(1), this.tune(1), this.tune(2), this.tune(2), this.tune(3), this.tune(4)];
  }

  rhythmLesson() {
    return [this.tap(1), this.tap(1), this.tap(2), this.tap(2), this.tap(2), this.tap(3)];
  }

  songLesson() {
    const song = this.lesson.song;
    const bars = song.melody.split('|').map((b) => b.trim());
    const sizes = Array.isArray(song.chunk) ? song.chunk.slice() : [];
    if (!sizes.length) for (let left = bars.length, size = song.chunk ?? 2; left > 0; left -= size) sizes.push(Math.min(size, left));
    const out = [];
    let at = 0;
    sizes.forEach((size, i) => {
      out.push(songPhrase(song, bars.slice(at, at + size).join(' | '), this.frets, { title: `${song.title} — part ${i + 1} of ${sizes.length}` }));
      at += size;
    });
    const whole = songPhrase(song, song.melody, this.frets, { title: `${song.title} — the whole tune`, final: true });
    if (whole.where.length <= 40) out.push(whole);
    return out;
  }

  accidentalsLesson() {
    const altered = this.pool.filter((n) => n.pitch.alter !== 0);
    const one = () => this.find(this.any(altered));
    return [
      one(), this.accPhrase('same'), one(), this.accPhrase('next'), this.accPhrase('natural'),
      one(), this.phrase(4, altered.slice(0, 2)), this.accPhrase('same'), this.accPhrase('natural'), this.accPhrase('next'),
    ];
  }

  keysigLesson() {
    const changed = this.pool.filter((n) => n.pitch.alter !== 0);
    const one = () => this.find(changed.length ? this.any(changed) : this.any());
    const focus = changed.slice(0, 2);
    return [
      one(), one(), this.find(this.any()), this.phrase(4, focus), one(),
      this.find(this.any()), this.phrase(5, focus), one(), this.find(this.any()), this.phrase(6, focus),
    ];
  }

  /** single notes and phrases across the whole pool */
  checkpoint(count = 10) {
    const plan = ['find', 'find', 'find', 4, 'find', 'find', 5, 'find', 6, 6];
    return plan.slice(0, count).map((step) => (step === 'find' ? this.find(this.any()) : this.phrase(step)));
  }
}

function patternMelody(rng, spec, used) {
  const fresh = spec.patterns.filter((p) => !used.has(p));
  const pattern = rng.pick(fresh.length ? fresh : spec.patterns);
  used.add(pattern);
  return pattern.split('|').map((bar) => bar.trim().split(/\s+/).map((tok) => `${RHYTHM_PITCH}:${tok}`).join(' ')).join(' | ');
}

/** fill `bars` measures with rhythm cells; returns arrays of duration codes */
export function rhythmBars(rng, spec, bars, used = new Set()) {
  const total = measureBeats(spec.timeSig);
  const names = Object.keys(spec.cells);
  for (let attempt = 0; attempt < 80; attempt++) {
    const out = [];
    const seen = new Set();
    let dead = false;
    for (let b = 0; b < bars && !dead; b++) {
      const bar = [];
      let pos = 0;
      while (pos < total - 1e-9) {
        const left = total - pos;
        const options = names.filter((name) => {
          const beats = cellBeats(name);
          if (beats > left + 1e-9) return false;
          if (beats >= 3) return pos === 0;
          if (beats === 2) return total === 3 || pos % 2 === 0;
          return true;
        });
        if (!options.length) { dead = true; break; }
        const prevRest = bar.length > 0 && isRestCode(CELLS[bar.at(-1)].at(-1));
        const name = rng.weighted(options, (cell) => {
          let w = spec.cells[cell];
          const rest = cell === 'qr' || cell === 'hr';
          if (rest && b === 0 && bar.length === 0) w *= 0.15;
          if (rest && prevRest) w *= 0.1;
          if (rest && b === bars - 1 && cellBeats(cell) === left) w = 0; // do not finish on silence
          if (!rest && b === bars - 1 && cellBeats(cell) === left && CELLS[cell].length === 1) w *= 1.8; // finish on a plain note
          return w;
        });
        bar.push(name);
        seen.add(name);
        pos += cellBeats(name);
      }
      out.push(bar);
    }
    if (dead) continue;
    // insist on the lesson's featured figure for a while, then settle for any valid rhythm
    if (spec.must && attempt < 50 && !spec.must.some((m) => seen.has(m))) continue;
    const codes = out.map((bar) => bar.flatMap((name) => CELLS[name]));
    if (codes.flat().filter((c) => !isRestCode(c)).length < 2 && attempt < 70) continue;
    const sig = codes.map((bar) => bar.join(' ')).join('|');
    if (used.has(sig) && attempt < 60) continue;
    used.add(sig);
    return codes;
  }
  return Array.from({ length: bars }, () => Array(total).fill('q'));
}

/** a stretch of a real song as a phrase exercise (positions resolved now) */
export function songPhrase(song, melody, frets, extra = {}) {
  const where = onsets(parseMelody(melody)).map((o) => {
    const n = locate(o.pitch, { frets: song.frets, string: song.string });
    if (!n) throw new Error(`song ${song.id}: ${o.pitch.id} cannot be played in frets ${song.frets}`);
    return n.key;
  });
  return { type: 'phrase', melody, timeSig: song.timeSig, keySig: song.keySig, bpm: song.bpm, where, frets, song: song.id, ...extra };
}

// ---------------------------------------------------------------------------
// Teaching cards
// ---------------------------------------------------------------------------
function introCards(lesson) {
  const mark = ([pos, label]) => { const n = parsePos(pos); return { s: n.s, f: n.f, label: label ?? n.name }; };
  const cards = lesson.intro.map((c) => ({ ...c, fretboard: c.fretboard ? { frets: lesson.frets, marks: c.fretboard.marks.map(mark) } : undefined }));
  if (lesson.kind === 'notes') {
    if (lesson.learn.length <= 3) lesson.learn.forEach((n, i) => { const c = noteCard(n, i === 0 ? lesson.tip : null); cards.push({ ...c, note: ref(n), frets: lesson.frets }); });
    else {
      const names = lesson.learn.map((n) => n.name);
      cards.push({
        title: 'New notes',
        text: `Here is where ${names.slice(0, -1).join(', ')} and ${names.at(-1)} live. Find each one on the diagram — then we will practise them one at a time.${lesson.tip ? ' ' + lesson.tip : ''}`,
        staff: { melody: lesson.learn.slice().sort((a, b) => a.sounding - b.sounding).map((n) => `${n.pitch.id}:w`).join(' '), labels: true, explicit: true },
        fretboard: { frets: lesson.frets, marks: lesson.learn.map((n) => ({ s: n.s, f: n.f, label: n.name })) },
      });
    }
  }
  if (lesson.kind === 'song') {
    cards.push({ title: lesson.song.title, text: `${lesson.song.credit}. You will read it one phrase at a time. Take it slowly: accuracy first, speed later.`, songArt: true });
  }
  if (lesson.kind === 'checkpoint') cards.push({ title: lesson.title, text: 'A longer round that mixes everything from this part of the course. Nothing new — just show what you know.' });
  return cards;
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------
/** all exercises of a course lesson (the first item may be {type:'intro'}) */
export function generateLesson(lesson, { rng = makeRng(), state = null, now = Date.now() } = {}) {
  const g = new Generator(lesson, { rng, state, now });
  const list = {
    notes: () => g.notesLesson(), mix: () => g.mixLesson(), melody: () => g.melodyLesson(), rhythm: () => g.rhythmLesson(),
    song: () => g.songLesson(), accidentals: () => g.accidentalsLesson(), keysig: () => g.keysigLesson(), checkpoint: () => g.checkpoint(),
  }[lesson.kind]();
  const cards = introCards(lesson);
  return cards.length ? [{ type: 'intro', cards }, ...list] : list;
}

/** the test offered for jumping straight to `unit`: everything taught before it */
export function generatePlacement(unit, { rng = makeRng() } = {}) {
  const before = LESSONS.filter((l) => l.unit.index < unit.index);
  const base = before.filter((l) => l.unit.zone === before.at(-1).unit.zone).at(-1);
  const lesson = { ...base, id: `placement-${unit.id}`, kind: 'checkpoint', learn: [], fresh: [], explicitAccidentals: false, title: `Jump to ${unit.title}` };
  return new Generator(lesson, { rng, state: null, now: 0 }).checkpoint(10);
}

/**
 * A practice round built from the notes the player is weakest on.
 * Returns null when nothing has been learned yet.
 */
export function generateReview(state, { rng = makeRng(), now = Date.now() } = {}) {
  const done = new Set(Object.keys(state.lessons).filter((id) => state.lessons[id]?.done));
  const known = learnedNotes(done);
  if (known.length < 2) return null;
  const weakest = known.slice().sort((a, b) => noteStrength(state, a.key, now) - noteStrength(state, b.key, now)).slice(0, 8);
  // practise inside one part of the neck at a time so the fretboard window stays put
  const zone = weakest[0].zone;
  const pool = weakest.filter((n) => n.zone === zone);
  const context = known.filter((n) => n.zone === zone);
  const lesson = { kind: 'mix', learn: pool, fresh: [], pool: context.length >= 3 ? context : known.filter((n) => n.zone === zone), frets: pool[0].frets, keySig: 0, explicitAccidentals: false, melody: null };
  const g = new Generator(lesson, { rng, state, now });
  const plan = ['find', 'find', 'find', 4, 'find', 'find', 5, 'find', 'find', 6];
  return plan.map((step) => (step === 'find' ? g.find(g.any(pool)) : g.phrase(step, pool.slice(0, 3))));
}

/** a set of rhythms to tap, in the style of one rhythm lesson */
export function generateRhythmSet(lesson, { rng = makeRng(), count = 6 } = {}) {
  const g = new Generator(lesson, { rng, state: null, now: 0 });
  return Array.from({ length: count }, (_, i) => g.tap(i < 2 ? 1 : 2));
}

/** one quick-fire question for the sprint mode */
export function sprintQuestion(rng, notes, mode, lastKey = null) {
  const options = notes.length > 1 ? notes.filter((n) => n.key !== lastKey) : notes;
  const n = rng.pick(options);
  const zoneNotes = notes.filter((x) => x.zone === n.zone);
  if (mode === 'name') return { type: 'name', note: ref(n), choices: nameChoices(rng, n, zoneNotes), answer: n.nameId, keySig: 0, explicit: true };
  return { type: 'find', note: ref(n), frets: n.frets, keySig: 0, explicit: true };
}

/** notes available to practice modes, with the part of the neck they belong to */
export function knownNotes(state) {
  return learnedNotes(new Set(Object.keys(state.lessons).filter((id) => state.lessons[id]?.done)));
}

export { ref as noteRef };
