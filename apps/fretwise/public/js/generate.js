// Turns a lesson description into a concrete list of exercises.
// Everything here is plain data (no DOM) so it can be tested exhaustively;
// exercises.js knows how to put each exercise type on screen.

import { makeRng, uniqueBy, clamp } from './util.js';
import { parseMelody, measureBeats, parseDur, onsets, locate, parsePitch, parsePos, diatonicShift, keySigLetters, keyName } from './theory.js';
import { noteStrength } from './progress.js';
import { noteCard, learnedNotes, LESSONS } from './curriculum.js';

const LETTER_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const RHYTHM_PITCH = 'G4';

// symbol code -> [beats, name]
export const SYMBOLS = {
  w: [4, 'whole note'], h: [2, 'half note'], q: [1, 'quarter note'], e: [0.5, 'eighth note'], s: [0.25, 'sixteenth note'],
  'h.': [3, 'dotted half note'], 'q.': [1.5, 'dotted quarter note'], ee: [1, 'pair of eighth notes'],
  rw: [4, 'whole rest'], rh: [2, 'half rest'], rq: [1, 'quarter rest'], re: [0.5, 'eighth rest'],
};
const BEAT_LABEL = { 0.25: '¼ beat', 0.5: '½ beat', 1: '1 beat', 1.5: '1½ beats', 2: '2 beats', 3: '3 beats', 4: '4 beats', 5: '5 beats', 6: '6 beats', 8: '8 beats' };
const BEAT_OPTIONS = { 0.25: [0.25, 0.5, 1, 2], 0.5: [0.25, 0.5, 1, 2], 1: [0.5, 1, 2, 4], 1.5: [1, 1.5, 2, 3], 2: [1, 2, 3, 4], 3: [1, 2, 3, 4], 4: [1, 2, 3, 4] };

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
  fresh() { return this.lesson.learn.length ? this.any(this.lesson.learn) : this.any(); }

  /** other notes to show next to `note`; never the same name / staff position */
  distractors(note, count, differBy) {
    const seen = new Set([differBy(note)]);
    const out = [];
    const near = this.pool.filter((n) => Math.abs(n.step - note.step) <= 4);
    for (const cand of [...this.rng.shuffle(near), ...this.rng.shuffle(this.pool)]) {
      if (out.length >= count) break;
      if (seen.has(differBy(cand))) continue;
      seen.add(differBy(cand));
      out.push(ref(cand));
    }
    for (const d of this.rng.shuffle([1, -1, 2, -2, 3, -3])) { // not enough known notes yet: use staff neighbours
      if (out.length >= count) break;
      const p = diatonicShift(note.pitch, d);
      const fake = { pitch: p.id, name: p.letter, nameId: p.letter, step: p.step, key: null };
      if (p.step < -7 || p.step > 14 || seen.has(differBy({ ...fake, pitch: p }))) continue;
      seen.add(differBy({ ...fake, pitch: p }));
      out.push(fake);
    }
    return out;
  }

  staffOpts() { return { keySig: this.keySig, range: this.range, explicit: this.explicit }; }

  // ---- single-note exercises ---------------------------------------------
  name(n) {
    return { type: 'name', note: ref(n), choices: nameChoices(this.rng, n, this.pool, this.keySig), answer: n.nameId, ...this.staffOpts() };
  }
  find(n) {
    return { type: 'find', note: ref(n), frets: this.frets, ...this.staffOpts() };
  }
  pickStaff(n) {
    const options = this.rng.shuffle([ref(n), ...this.distractors(n, 2, (x) => x.nameId)]);
    return { type: 'pickStaff', target: ref(n), options, answer: options.findIndex((o) => o.pitch === n.pitch.id), ...this.staffOpts() };
  }
  fretToStaff(n) {
    const options = this.rng.shuffle([ref(n), ...this.distractors(n, 2, (x) => x.step)]);
    return { type: 'fretToStaff', note: ref(n), options, answer: options.findIndex((o) => o.pitch === n.pitch.id), frets: this.frets, ...this.staffOpts() };
  }
  fretToName(n) {
    return { type: 'fretToName', note: ref(n), choices: nameChoices(this.rng, n, this.pool, this.keySig), answer: n.nameId, frets: this.frets };
  }
  canPair() { return uniqueBy(this.pool, (n) => n.nameId).length >= 3 || this.pool.length >= 4; }
  pairs() {
    const byName = uniqueBy(this.rng.shuffle(this.pool), (n) => n.nameId);
    const usePlace = byName.length < 3 || (this.pool.length >= 4 && this.rng.chance(0.4));
    const picked = usePlace
      ? uniqueBy(this.rng.shuffle(this.pool).sort((a, b) => this.weight(b) - this.weight(a)), (n) => n.pitch.id).slice(0, 4)
      : byName.sort((a, b) => this.weight(b) - this.weight(a)).slice(0, 4);
    return { type: 'pairs', mode: usePlace ? 'place' : 'name', notes: this.rng.shuffle(picked).map(ref), ...this.staffOpts() };
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

  /** "which of these did you hear?" — three short phrases that start alike */
  hear() {
    const { rng } = this;
    const length = this.pool.length >= 5 ? 4 : 3;
    const seen = new Set();
    const options = [];
    let start = null, guard = 0;
    while (options.length < 3 && guard++ < 200) {
      const w = this.walk(length);
      if (start && w[0].sounding !== start.sounding) w[0] = start;
      const sig = w.map((n) => n.pitch.id).join(' ');
      if (seen.has(sig) || new Set(w.map((n) => n.sounding)).size < 2) continue;
      seen.add(sig);
      start ??= w[0];
      options.push(w.map((n) => `${n.pitch.id}:q`).join(' '));
    }
    if (options.length < 3) return this.phrase(4, this.lesson.learn);
    return { type: 'hearPhrase', options, answer: rng.int(0, 2), bpm: 76, ...this.staffOpts() };
  }

  // ---- rhythm ------------------------------------------------------------
  tap(bars) {
    const spec = this.lesson.rhythm;
    if (measureBeats(spec.timeSig) <= 3) bars = Math.max(bars, 2); // one bar of three-four is too little to tap
    const melody = spec.patterns ? patternMelody(this.rng, spec, this.usedRhythms) : codesToMelody(rhythmBars(this.rng, spec, bars, this.usedRhythms));
    return { type: 'rhythmTap', melody, timeSig: spec.timeSig, bpm: spec.bpm, counts: spec.counts ?? null };
  }
  hearRhythm() {
    const spec = this.lesson.rhythm;
    const total = measureBeats(spec.timeSig);
    const bars = total <= 3 ? 2 : 1;
    const loose = { ...spec, must: null };
    const options = [];
    const local = new Set();
    for (let guard = 0; options.length < 3 && guard < 200; guard++) {
      // the first option shows off the figure this lesson is about; the others may be anything
      const melody = spec.patterns ? patternMelody(this.rng, spec, local) : codesToMelody(rhythmBars(this.rng, options.length ? loose : spec, bars, local));
      if (!options.some((o) => sameOnsets(o, melody))) options.push(melody);
    }
    const spare = total === 3 ? ['q q q | h q', 'h q | q q q', 'q h | q q q', 'q q q | q q q'] : ['q q q q', 'h q q', 'q q h', 'h h', 'q h q'];
    for (const p of spare) {
      if (options.length >= 3) break;
      const melody = p.split('|').map((bar) => bar.trim().split(' ').map((c) => `${RHYTHM_PITCH}:${c}`).join(' ')).join(' | ');
      if (!options.some((o) => sameOnsets(o, melody))) options.push(melody);
    }
    const list = this.rng.shuffle(options);
    return { type: 'rhythmHear', options: list, answer: this.rng.int(0, 2), timeSig: spec.timeSig, bpm: spec.bpm };
  }

  // ---- multiple choice ---------------------------------------------------
  mcq(recipe) {
    const { rng } = this;
    const [kind, a, b, c] = recipe;
    const shuffled = (choices, answerValue, same = (x, y) => x === y) => {
      const list = rng.shuffle(choices);
      return { list, answer: list.findIndex((x) => same(x, answerValue)) };
    };
    // plausible lengths to choose from, kept to values a beginner has a feel for
    const beatChoices = (beats) => {
      const set = BEAT_OPTIONS[beats];
      return { choices: set.map((v) => ({ label: BEAT_LABEL[v] })), answer: set.indexOf(beats) };
    };
    switch (kind) {
      case 'beats': {
        const beats = SYMBOLS[a][0];
        return { type: 'mcq', prompt: `How long does this ${isRestCode(a) ? 'rest' : 'note'} last?`, visual: { symbol: a }, ...beatChoices(beats) };
      }
      case 'which': {
        const { list, answer } = shuffled(b, a);
        const name = SYMBOLS[a][1];
        return { type: 'mcq', prompt: `Which one is ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}?`, choices: list.map((sym) => ({ symbol: sym })), answer };
      }
      case 'name': {
        const { list, answer } = shuffled(b, a);
        return { type: 'mcq', prompt: 'What is this called?', visual: { symbol: a }, choices: list.map((sym) => ({ label: cap(SYMBOLS[sym][1]) })), answer };
      }
      case 'restFor': {
        const { list, answer } = shuffled(['rq', 'rh', 'rw'], 'r' + a);
        return { type: 'mcq', prompt: 'Which rest lasts as long as this note?', visual: { symbol: a }, choices: list.map((sym) => ({ symbol: sym })), answer };
      }
      case 'howMany': {
        const n = SYMBOLS[b][0] / SYMBOLS[a][0];
        const opts = [...new Set([n, ...rng.shuffle([2, 3, 4, 6, 8].filter((v) => v !== n)).slice(0, 2)])].sort((x, y) => x - y);
        return { type: 'mcq', prompt: `How many ${SYMBOLS[a][1]}s fit into one ${SYMBOLS[b][1]}?`, visual: { symbols: [a, b] }, choices: opts.map((v) => ({ label: String(v) })), answer: opts.indexOf(n) };
      }
      case 'timeTop': {
        const top = a[0];
        const bar = Array(top).fill(`${RHYTHM_PITCH}:q`).join(' ');
        const opts = [2, 3, 4, 6];
        return { type: 'mcq', prompt: 'How many beats are in each measure of this music?', visual: { staff: { melody: `${bar} | ${bar}`, timeSig: a } }, choices: opts.map((v) => ({ label: String(v) })), answer: opts.indexOf(top) };
      }
      case 'tie': {
        const total = SYMBOLS[a][0] + SYMBOLS[b][0];
        const opts = [...new Set([total, ...rng.shuffle([2, 3, 4, 5, 6].filter((v) => v !== total)).slice(0, 2), SYMBOLS[a][0]])].sort((x, y) => x - y);
        return {
          type: 'mcq', prompt: 'These two notes are tied. How long does the sound last?', visual: { staff: { melody: `${RHYTHM_PITCH}:${a}~ ${RHYTHM_PITCH}:${b}` } },
          choices: opts.map((v) => ({ label: BEAT_LABEL[v] })), answer: opts.indexOf(total),
        };
      }
      case 'fill': {
        // a measure with a gap at the end; exactly one of the offered symbols fits
        const timeSig = b ?? [4, 4];
        const total = measureBeats(timeSig);
        let given = c, missing;
        const offered = a.slice();
        if (given) missing = total - parseMelody(given)[0].reduce((s, e) => s + e.dur.beats, 0);
        else {
          const fit = rng.pick(offered.filter((sym) => SYMBOLS[sym][0] < total));
          missing = SYMBOLS[fit][0];
          const lead = [];
          for (let left = total - missing; left > 0;) { const d = left >= 2 && rng.chance(0.4) ? 'h' : 'q'; lead.push(`${RHYTHM_PITCH}:${d}`); left -= d === 'h' ? 2 : 1; }
          given = rng.shuffle(lead).join(' ');
        }
        const pad = ['q', 'h', 'e', 'w', 'h.'].filter((sym) => SYMBOLS[sym][0] !== missing && !offered.includes(sym));
        const wrong = uniqueBy([...offered.filter((sym) => SYMBOLS[sym][0] !== missing), ...rng.shuffle(pad)], (sym) => SYMBOLS[sym][0]).slice(0, 2);
        const right = offered.find((sym) => SYMBOLS[sym][0] === missing) ?? Object.keys(SYMBOLS).find((sym) => SYMBOLS[sym][0] === missing && !isRestCode(sym));
        const { list, answer } = shuffled([right, ...wrong], right);
        return {
          type: 'mcq', prompt: 'This measure is not full yet. Which one completes it?',
          visual: { staff: { melody: given, timeSig, endBar: 'none' } }, choices: list.map((sym) => ({ symbol: sym })), answer,
        };
      }
      case 'text': {
        const { list, answer } = shuffled(a.choices.map((label, i) => ({ label, right: i === a.answer })), true, (x) => x.right);
        return { type: 'mcq', prompt: a.prompt, visual: a.visual ?? null, choices: list.map((x) => ({ label: x.label })), answer };
      }
      default: throw new Error(`unknown question recipe "${kind}"`);
    }
  }

  mcqHigher() {
    const n = this.any();
    const other = this.distractors(n, 1, (x) => x.step)[0];
    const firstIsTarget = this.rng.chance(0.5);
    const pair = firstIsTarget ? [n.pitch.id, other.pitch] : [other.pitch, n.pitch.id];
    const higher = parsePitch(pair[0]).midi > parsePitch(pair[1]).midi ? 0 : 1;
    return {
      type: 'mcq', prompt: 'Which note sounds higher?', visual: { staff: { melody: pair.map((p) => `${p}:w`).join(' '), range: this.range } },
      choices: [{ label: 'The first one' }, { label: 'The second one' }], answer: higher,
    };
  }
  mcqLineSpace() {
    const n = this.any();
    return {
      type: 'mcq', prompt: 'Is this note on a line or in a space?', visual: { staff: { melody: `${n.pitch.id}:w`, range: this.range } },
      choices: [{ label: 'On a line' }, { label: 'In a space' }], answer: Math.abs(n.step) % 2 === 0 ? 0 : 1,
    };
  }

  /** the bar-line rule: what is the highlighted note really? */
  carry(variant) {
    const { rng } = this;
    const altered = this.pool.filter((n) => n.pitch.alter !== 0 && this.pool.some((m) => m.pitch.alter === 0 && m.pitch.letter === n.pitch.letter && m.pitch.octave === n.pitch.octave));
    const sharp = rng.pick(altered);
    const plain = this.pool.find((m) => m.pitch.alter === 0 && m.pitch.letter === sharp.pitch.letter && m.pitch.octave === sharp.pitch.octave);
    const others = rng.shuffle(this.pool.filter((n) => n.pitch.alter === 0 && n.pitch.letter !== sharp.pitch.letter && Math.abs(n.step - sharp.step) <= 4));
    const [x, y] = [others[0] ?? plain, others[1] ?? others[0] ?? plain];
    const S = sharp.pitch.id, P = plain.pitch.id;
    let melody, mark, answer, prompt;
    if (variant === 'same') { melody = `${S}:q ${x.pitch.id}:q ${S}:q ${y.pitch.id}:q`; mark = 2; answer = sharp.nameId; prompt = 'The highlighted note has no sign of its own. What is it?'; }
    else if (variant === 'next') { melody = `${S}:q ${x.pitch.id}:q ${y.pitch.id}:h | ${P}:q ${x.pitch.id}:q ${y.pitch.id}:h`; mark = 3; answer = plain.nameId; prompt = 'The highlighted note comes after a bar line. What is it?'; }
    else { melody = `${S}:q ${x.pitch.id}:q ${P}:q ${y.pitch.id}:q`; mark = 2; answer = plain.nameId; prompt = 'What is the highlighted note?'; }
    const names = sortNames([plain.nameId, sharp.nameId]);
    return {
      type: 'mcq', prompt, visual: { staff: { melody, timeSig: [4, 4], mark, range: this.range } },
      choices: names.map((id) => ({ note: id })), answer: names.indexOf(answer),
    };
  }

  keyQuestion(variant) {
    const k = this.keySig;
    const letters = keySigLetters(k);
    const word = k > 0 ? 'sharp' : 'flat';
    const visual = { staff: { melody: 'r:w', keySig: k, endBar: 'none', minWidth: 150 } };
    if (variant === 'which') {
      if (letters.length === 1) {
        const opts = sortNames([...new Set([letters[0], ...this.rng.shuffle(LETTER_ORDER.filter((l) => l !== letters[0])).slice(0, 3)])]);
        return { type: 'mcq', prompt: `This key signature has one ${word}. Which note does it change?`, visual, choices: opts.map((l) => ({ label: l })), answer: opts.indexOf(letters[0]) };
      }
      const right = letters.join(' and ');
      const wrong = ['F and G', 'C and G', 'B and E', 'F and B', 'C and D'].filter((w) => w !== right);
      const list = this.rng.shuffle([right, ...this.rng.shuffle(wrong).slice(0, 2)]);
      return { type: 'mcq', prompt: `Which notes are ${word} in this key signature?`, visual, choices: list.map((label) => ({ label })), answer: list.indexOf(right) };
    }
    const keys = [0, 1, 2, -1];
    const list = this.rng.shuffle(keys);
    return { type: 'mcq', prompt: 'Which major key has this key signature?', visual, choices: list.map((key) => ({ label: keyName(key) })), answer: list.indexOf(k) };
  }

  // ---- lesson recipes ----------------------------------------------------
  notesLesson() {
    const L = this.lesson, out = [];
    if (L.basics) out.push(this.mcqHigher(), this.mcqLineSpace());
    for (const n of L.learn.slice(0, 3)) out.push(this.name(n), this.find(n));
    for (const n of L.learn.slice(3)) out.push(this.rng.chance(0.5) ? this.name(n) : this.find(n));
    out.push(this.pickStaff(this.fresh()), this.fretToStaff(this.fresh()), this.name(this.any()), this.find(this.any()));
    if (this.canPair()) out.push(this.pairs());
    out.push(this.phrase(4, L.learn), this.fretToName(this.any()), this.find(this.any()), this.name(this.any()));
    out.push(this.phrase(this.pool.length >= 4 ? 6 : 5, L.learn));
    return out;
  }

  mixLesson(count = 13) {
    const out = [this.name(this.any())];
    const menu = [['name', 3], ['find', 3], ['pickStaff', 1.5], ['fretToStaff', 1.5], ['fretToName', 1.2], ['pairs', 1], ['phrase', 2], ['hear', 1.2], ['tune', this.lesson.melody ? 2.2 : 0]];
    const cap2 = { pairs: 2, hear: 2, phrase: 3, tune: 3 };
    const used = {};
    let prev = 'name';
    while (out.length < count) {
      const [type] = this.rng.weighted(menu, ([t, w]) => (t === prev || (cap2[t] && (used[t] || 0) >= cap2[t]) || (t === 'pairs' && !this.canPair()) ? 0 : w));
      used[type] = (used[type] || 0) + 1;
      prev = type;
      if (type === 'pairs') out.push(this.pairs());
      else if (type === 'phrase') out.push(this.phrase(5));
      else if (type === 'hear') out.push(this.hear());
      else if (type === 'tune') out.push(this.tune(1));
      else out.push(this[type](this.any()));
    }
    out.push(this.lesson.melody ? this.tune(2) : this.phrase(6));
    return out;
  }

  melodyLesson() {
    return [this.tune(1), this.tune(1), this.hear(), this.tune(2), this.name(this.any()), this.tune(2), this.hear(), this.tune(2), this.tune(4)];
  }

  rhythmLesson() {
    const L = this.lesson;
    const q = L.mcq.slice(0, 3).concat(this.rng.shuffle(L.mcq.slice(3)).slice(0, 2)).map((r) => this.mcq(r));
    const long = L.rhythm.patterns ? 2 : 2;
    return [q[0], q[1], this.tap(1), q[2], this.hearRhythm(), this.tap(1), q[3], this.tap(long), this.hearRhythm(), this.tap(long), q[4], this.tap(long)].filter(Boolean);
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
    const text = (prompt, choices) => this.mcq(['text', { prompt, choices, answer: 0 }]);
    return [
      text('How long does a sharp or flat stay in force?', ['Until the next bar line', 'For one note only', 'For the rest of the piece']),
      this.carry('same'), this.carry('next'), this.carry('natural'),
      this.name(this.any(altered)), this.carry('same'), this.find(this.any(altered)),
      text('What does a natural sign (♮) do?', ['Cancels a sharp or flat', 'Raises the note one fret', 'Makes the note longer']),
      this.carry('next'), this.find(this.any(altered)), this.carry('natural'), this.name(this.any(altered)), this.carry('same'),
    ];
  }

  keysigLesson() {
    const changed = this.pool.filter((n) => n.pitch.alter !== 0);
    const pickChanged = () => (changed.length ? this.any(changed) : this.any());
    return [
      this.keyQuestion('which'), this.name(pickChanged()), this.find(pickChanged()), this.name(this.any()),
      this.keyQuestion('name'), this.phrase(5, changed.slice(0, 2)), this.name(pickChanged()), this.find(this.any()),
      this.fretToName(pickChanged()), this.keyQuestion('which'), this.find(pickChanged()), this.name(this.any()), this.phrase(6, changed.slice(0, 2)),
    ];
  }

  checkpoint(count = 18) {
    const out = [];
    const plan = ['name', 'find', 'name', 'find', 'fretToStaff', 'phrase', 'name', 'find', 'fretToName', 'pairs', 'name', 'find', 'phrase', 'fretToStaff', 'name', 'find', 'fretToName', 'phrase'];
    for (const type of plan.slice(0, count)) {
      if (type === 'pairs') out.push(this.canPair() ? this.pairs() : this.name(this.any()));
      else if (type === 'phrase') out.push(this.phrase(6));
      else out.push(this[type](this.any()));
    }
    return out;
  }
}

const cap = (text) => text[0].toUpperCase() + text.slice(1);

/** do two rhythms sound identical when clapped? (rests vs. long notes can) */
function sameOnsets(a, b) {
  const sig = (m) => onsets(parseMelody(m)).map((o) => o.t).join(',');
  return sig(a) === sig(b);
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
  return new Generator(lesson, { rng, state: null, now: 0 }).checkpoint(16);
}

/**
 * A practice round built from the notes the player is weakest on.
 * Returns null when nothing has been learned yet.
 */
export function generateReview(state, { rng = makeRng(), now = Date.now(), count = 12 } = {}) {
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
  const out = [];
  const types = ['name', 'find', 'fretToStaff', 'find', 'name', 'fretToName'];
  for (let i = 0; out.length < count - 1; i++) out.push(g[types[i % types.length]](g.any(pool)));
  out.push(g.phrase(6, pool.slice(0, 3)));
  return out;
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
