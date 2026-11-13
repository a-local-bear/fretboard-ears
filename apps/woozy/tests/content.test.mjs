// Validates every lesson and cookbook entry: each progression parses and
// compiles, each melody and tab fits its bars, each hand-written voicing
// contains only notes of the chord it is labelled as, and every quiz
// generator produces well-formed questions.
import assert from 'node:assert/strict';
import { test } from 'node:test';

// --- a do-nothing DOM, just enough for quiz generators that build elements
class FakeEl {
  constructor() {
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  }
  append(...kids) { this.children.push(...kids); }
  setAttribute() {}
  getAttribute() { return null; }
  addEventListener() {}
  replaceChildren(...kids) { this.children = kids; }
  remove() {}
  closest() { return null; }
  querySelector() { return null; }
}
class FakeNode {}
globalThis.Node = FakeNode;
globalThis.document = {
  createElement: () => new FakeEl(),
  createElementNS: () => new FakeEl(),
  createTextNode: (text) => ({ text }),
  createDocumentFragment: () => new FakeEl(),
};

const { GROOVES, PATTERNS, compile } = await import('../public/js/audio/engine.js');
const { COOKBOOK } = await import('../public/js/content/cookbook.js');
const { LESSONS, MODULES } = await import('../public/js/content/curriculum.js');
const { parseMelody, MELODY_HI, MELODY_LO } = await import('../public/js/music/melody.js');
const { QUALITIES, SCALES, mod12, parseChord, parseProgression } = await import('../public/js/music/theory.js');
const { OPEN_MIDI, parseFrets } = await import('../public/js/music/voicings.js');
const { resolveChords } = await import('../public/js/songs.js');
const { resolveAbs } = await import('../public/js/ui/progression.js');
const { parseTab } = await import('../public/js/ui/tab.js');

const KNOWN_BLOCKS = new Set(['p', 'h', 'callout', 'listen', 'starter', 'chords', 'prog', 'keys', 'rootmap', 'tones', 'scale',
  'rhythm', 'triads', 'tab', 'melody', 'prompt', 'checklist', 'build', 'quiz']);

const steps = (chords) => chords.reduce((sum, c) => sum + Math.round(c.beats * 4), 0);

function checkBars(str, perBar, what) {
  // Every bar written with | must add up to a full bar.
  if (!str.includes('|')) return;
  str.split('|').forEach((bar, i) => {
    const total = bar.trim().split(/\s+/).filter(Boolean).reduce((sum, tok) => sum + Number(tok.split(':')[1] ?? 1), 0);
    assert.equal(total, perBar, `${what}: bar ${i + 1} adds up to ${total} eighths, expected ${perBar}`);
  });
}

function checkProg(spec, where, defaults = {}) {
  const pattern = spec.pattern ?? defaults.pattern ?? 'lazy';
  const groove = spec.groove ?? defaults.groove ?? 'bedroom';
  assert.ok(PATTERNS[pattern], `${where}: unknown strum pattern "${pattern}"`);
  assert.ok(GROOVES[groove], `${where}: unknown groove "${groove}"`);
  let chords;
  if (spec.abs) {
    chords = resolveAbs(spec.abs);
    for (const [i, c] of chords.entries()) checkVoicing(spec.abs[i].name, c.frets, `${where} › ${spec.abs[i].name}`);
  } else {
    assert.ok(spec.prog, `${where}: no progression`);
    chords = resolveChords(spec.key ?? defaults.key ?? 'C', spec.mode ?? defaults.mode ?? 'major', parseProgression(spec.prog), { prefer: spec.prefer ?? defaults.prefer });
  }
  for (const c of chords) {
    assert.ok(Number.isInteger(c.beats * 4), `${where}: ${c.symbol} lasts ${c.beats} beats — not a whole number of 16ths`);
    assert.ok(c.frets.some((f) => f != null), `${where}: ${c.symbol} has no voicing`);
  }
  const comp = compile({ chords, pattern, groove });
  assert.ok(comp.total > 0, `${where}: empty progression`);
  return { chords, total: comp.total };
}

function checkVoicing(name, frets, where) {
  const chord = parseChord(name);
  assert.ok(chord, `${where}: cannot parse chord name`);
  const arr = parseFrets(frets);
  assert.equal(arr.length, 6, where);
  if (chord.q == null) return; // exotic name: nothing to verify against
  const allowed = QUALITIES[chord.q].semis.map(mod12);
  arr.forEach((f, string) => {
    if (f == null) return;
    const rel = mod12(OPEN_MIDI[string] + f - chord.rootPc);
    assert.ok(allowed.includes(rel), `${where}: string ${6 - string} fret ${f} is not a note of ${name}`);
  });
  const sounding = arr.map((f, string) => (f == null ? null : mod12(OPEN_MIDI[string] + f - chord.rootPc))).filter((x) => x != null);
  assert.ok(sounding.includes(0), `${where}: ${name} voicing has no root`);
}

function checkMelody(str, total, where) {
  if (!str) return;
  checkBars(str, 8, where);
  const notes = parseMelody(str);
  for (const n of notes) {
    assert.ok(n.s + n.d <= total, `${where}: a note runs past the end of the progression`);
    assert.ok(n.p >= MELODY_LO && n.p <= MELODY_HI, `${where}: pitch ${n.p} is outside the melody grid`);
  }
  const length = str.split(/[\s|]+/).filter(Boolean).reduce((sum, tok) => sum + Math.round(Number(tok.split(':')[1] ?? 1) * 2), 0);
  assert.equal(length, total, `${where}: melody is ${length} steps long but the chords last ${total}`);
}

test('the curriculum is well-formed', () => {
  assert.ok(MODULES.length >= 8);
  assert.ok(LESSONS.length >= 24, `only ${LESSONS.length} lessons`);
  const ids = new Set();
  for (const lesson of LESSONS) {
    assert.match(lesson.id, /^[a-z0-9-]{1,48}$/, `bad lesson id ${lesson.id}`);
    assert.ok(!ids.has(lesson.id), `duplicate lesson id ${lesson.id}`);
    ids.add(lesson.id);
    assert.ok(lesson.title && lesson.summary && lesson.minutes > 0, `${lesson.id} is missing title/summary/minutes`);
    assert.ok(lesson.blocks.length >= 4, `${lesson.id} is too thin`);
  }
});

test('every lesson block is valid', () => {
  for (const lesson of LESSONS) {
    lesson.blocks.forEach((b, i) => {
      const where = `${lesson.id}[${i}:${b.t}]${b.title ? ` “${b.title}”` : ''}`;
      assert.ok(KNOWN_BLOCKS.has(b.t), `${where}: unknown block type`);
      switch (b.t) {
        case 'p':
        case 'callout':
          assert.ok(typeof b.html === 'string' && b.html.length > 10, `${where}: empty text`);
          break;
        case 'prog':
          for (const v of b.variants || [b]) checkProg(v, `${where}${v.label ? ` (${v.label})` : ''}`, b);
          break;
        case 'melody': {
          const { total } = checkProg({ ...b, pattern: b.pattern ?? 'ring' }, where);
          for (const v of b.variants || [b]) checkMelody(v.melody, total, `${where}${v.label ? ` (${v.label})` : ''}`);
          if (b.scale) assert.ok(SCALES[b.scale], `${where}: unknown scale`);
          break;
        }
        case 'tab': {
          checkBars(b.tab, 8, where);
          const { notes, total } = parseTab(b.tab);
          assert.ok(notes.length > 0, where);
          for (const n of notes) assert.ok(n.fret >= 0 && n.fret <= 19 && n.string >= 0 && n.string <= 5, `${where}: bad note`);
          if (b.prog || b.abs) assert.equal(checkProg({ ...b, pattern: b.pattern ?? 'ring' }, where).total, total, `${where}: tab and chords differ in length`);
          break;
        }
        case 'chords':
          for (const item of b.items) {
            assert.ok(parseChord(item.name), `${where}: bad chord ${item.name}`);
            if (item.frets) checkVoicing(item.name, item.frets, `${where} › ${item.name}`);
            else assert.ok(parseChord(item.name).q != null, `${where}: ${item.name} needs explicit frets`);
          }
          break;
        case 'rhythm':
          for (const id of b.patterns) assert.ok(PATTERNS[id], `${where}: unknown pattern ${id}`);
          checkProg({ ...b, pattern: b.pattern ?? b.patterns[0] }, where);
          break;
        case 'tones':
          checkProg({ ...b, pattern: b.pattern ?? 'ring' }, where);
          break;
        case 'scale':
          for (const id of [b.scale, b.ghost, ...(b.choices || [])].filter(Boolean)) assert.ok(SCALES[id], `${where}: unknown scale ${id}`);
          break;
        case 'starter':
          for (const sec of b.song.sections) {
            const { total } = checkProg({ ...b.song, prog: sec.prog }, `${where} › ${sec.name}`);
            checkMelody(sec.melody, total, `${where} › ${sec.name}`);
          }
          break;
        case 'build': {
          assert.equal(typeof b.check, 'function', where);
          const verdict = b.check([]);
          assert.equal(verdict.ok, false, `${where}: an empty answer must not pass`);
          break;
        }
        case 'quiz':
          assert.equal(typeof b.gen, 'function', where);
          for (let k = 0; k < 40; k++) {
            const q = b.gen();
            assert.ok(q.prompt, `${where}: question without a prompt`);
            if (q.fret) {
              assert.equal(typeof q.fret.accept, 'function', where);
              let hits = 0;
              for (let string = 0; string < 6; string++) for (let f = q.fret.from; f <= q.fret.to; f++) if (q.fret.accept(string, f)) hits++;
              assert.ok(hits > 0, `${where}: no correct fret exists`);
            } else {
              assert.ok(q.choices.length >= 2, `${where}: needs at least two choices`);
              assert.equal(new Set(q.choices).size, q.choices.length, `${where}: duplicate choices ${q.choices.join(' / ')}`);
              assert.ok(q.answer >= 0 && q.answer < q.choices.length, `${where}: answer index ${q.answer} out of range (${q.choices.join(' / ')})`);
            }
          }
          break;
        default:
      }
    });
  }
});

test('every cookbook entry compiles in several keys', () => {
  let count = 0;
  for (const group of COOKBOOK) {
    for (const item of group.items) {
      for (const key of item.mode === 'minor' ? ['A', 'E', 'F#'] : ['C', 'A', 'Eb']) {
        checkProg({ ...item, key }, `cookbook “${item.name}” in ${key}`);
      }
      count++;
    }
  }
  assert.ok(count >= 40, `only ${count} cookbook entries`);
});
