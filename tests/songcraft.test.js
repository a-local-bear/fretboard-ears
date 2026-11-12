import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUALITIES, parseRoman, parseProg, roman, chordName, diatonic, describe, analyse, suggestNext, isDiatonic, SPICE, noteNameOver,
} from '../songcraft/js/theory.js';
import { shapeFor, shapeMidis, shapeText } from '../songcraft/js/shapes.js';
import { normalizeSong, compile, totalSteps, tonicMidi, PATTERNS, RIFF_LO, RIFF_HI } from '../songcraft/js/song.js';
import { fit, generate, riffReport, fitMotif, neckWindow, tabLines, gridRows, STYLES } from '../songcraft/js/riff.js';
import { LESSONS, PRESETS, parseRiff } from '../songcraft/js/lessons.js';
import { SAMPLE_RANGE } from '../js/samples.js';

const song = (prog, extra = {}) => normalizeSong({ key: 0, chords: parseProg(prog), ...extra });

test('roman numerals round-trip and name chords in the key', () => {
  for (const sym of ['I', 'ii', 'iii', 'IV', 'V7', 'vi7', 'vii°', '♭VII', 'iv', 'IVmaj7', 'Vsus4', '♯i°7', 'iiø7', 'Iadd9']) {
    assert.equal(roman(parseRoman(sym)), sym);
  }
  assert.deepEqual(diatonic('major').map((c) => chordName(c, 7, 'major')), ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F♯°']);
  assert.deepEqual(diatonic('minor').map((c) => chordName(c, 9, 'minor')), ['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G']);
  assert.equal(chordName(parseRoman('♭VI'), 7, 'major'), 'E♭');
  assert.equal(chordName(parseRoman('III7'), 0, 'major'), 'E7');
  assert.equal(parseRoman('V7:2').beats, 2);
  assert.equal(parseRoman('nonsense'), null);
  assert.equal(noteNameOver(8, parseRoman('III7'), 0, 'major'), 'G♯');
});

test('every chord has a job', () => {
  const r = (sym, mode = 'major') => describe(parseRoman(sym), mode);
  assert.equal(r('I').role, 'home');
  assert.equal(r('IV').role, 'away');
  assert.equal(r('V7').role, 'tension');
  assert.equal(r('iv').kind, 'borrowed');
  assert.deepEqual([r('III7').kind, r('III7').target], ['secondary', 9]);
  assert.equal(r('V', 'minor').role, 'tension');
  assert.equal(r('♭VI', 'minor').role, 'away');
  for (const mode of ['major', 'minor']) {
    for (const sym of SPICE[mode]) assert.ok(!isDiatonic(parseRoman(sym), mode), `${sym} is outside ${mode}`);
    for (const c of diatonic(mode, true)) assert.equal(describe(c, mode).kind, 'key');
  }
});

test('analysis and suggestions speak about the progression', () => {
  assert.ok(analyse(parseProg('ii7 V7 Imaj7 VI7'), 'major').some((t) => t.includes('engine of jazz')));
  assert.ok(analyse(parseProg('I IV iv I'), 'major').some((t) => t.includes('bittersweet')));
  assert.ok(analyse(parseProg('I IV V'), 'major').some((t) => t.includes('ends on tension')));
  assert.equal(roman(suggestNext(parseRoman('III7'), 'major')[0].chord), 'vi');
  assert.equal(roman(suggestNext(parseRoman('ii7'), 'major', true)[0].chord), 'V7');
});

test('every chord shape is playable, in tune and on the samples', () => {
  for (let pc = 0; pc < 12; pc++) {
    for (const [q, { iv }] of Object.entries(QUALITIES)) {
      const frets = shapeFor(pc, q);
      const want = new Set(iv.map((i) => (pc + i) % 12));
      const midis = shapeMidis(frets);
      const got = new Set(midis.map((m) => m % 12));
      const id = `${pc}:${q} ${shapeText(frets)}`;
      assert.ok([...got].every((x) => want.has(x)), `${id} has a wrong note`);
      assert.ok(got.has(pc), `${id} has no root`);
      assert.ok(want.size - got.size <= 1, `${id} leaves out more than one note`);
      const fretted = frets.filter((f) => f > 0);
      assert.ok(!fretted.length || Math.max(...fretted) - Math.min(...fretted) <= 4, `${id} is too wide`);
      assert.ok(midis.every((m) => m >= SAMPLE_RANGE[0] && m <= SAMPLE_RANGE[1]), `${id} leaves the samples`);
    }
  }
  assert.equal(shapeText(shapeFor(0, '')), 'x32010');
  assert.equal(shapeText(shapeFor(5, '')), '133211');
  assert.equal(shapeText(shapeFor(11, 'm')), 'x24432');
});

test('a song compiles to steps, and bad input is repaired', () => {
  const s = song('I V:2 vi:2 IV:8', { riff: [0, null, 99, 4] });
  assert.equal(totalSteps(s), 32);
  assert.deepEqual(s.riff.slice(0, 4), [0, null, null, 4]);
  for (const pattern of Object.keys(PATTERNS)) {
    const t = compile({ ...s, pattern });
    assert.equal(t.events.length, 32);
    assert.ok(t.events[0].some((e) => e.first), `${pattern} starts the first chord on step 0`);
    assert.equal(t.chordAt[8], 1);
    assert.equal(t.chordAt[12], 2);
  }
  assert.deepEqual(compile(s).events[3].find((e) => e.k === 'mel'), { k: 'mel', midi: tonicMidi(0) + 4, len: 6 });
  assert.equal(normalizeSong(null).chords.length, 4);
  assert.equal(normalizeSong({ chords: [{ root: 99, q: 'x' }] }).chords.length, 4);
  for (let pc = 0; pc < 12; pc++) assert.ok(tonicMidi(pc) + RIFF_LO >= SAMPLE_RANGE[0] && tonicMidi(pc) + RIFF_HI <= SAMPLE_RANGE[1]);
});

test('notes are judged against the chord under them', () => {
  const C = parseRoman('I');
  assert.equal(fit(4, C, 'major'), 'chord');
  assert.equal(fit(2, C, 'major'), 'scale');
  assert.equal(fit(5, C, 'major'), 'rub');
  assert.equal(fit(6, C, 'major'), 'out');
  assert.equal(fit(8, parseRoman('iv'), 'major'), 'chord');
});

test('generated ideas follow their own rules, for every preset', () => {
  for (const p of PRESETS) {
    const s = song(p.prog, { mode: p.mode || 'major' });
    for (const style of Object.keys(STYLES)) {
      for (let seed = 1; seed <= 8; seed++) {
        const g = generate(s, style, seed);
        assert.equal(g.riff.length, totalSteps(s));
        assert.ok(g.riff.every((o) => o == null || (Number.isInteger(o) && o >= RIFF_LO && o <= RIFF_HI)), `${p.prog} ${style} ${seed} stays in range`);
        assert.ok(g.riff.filter((o) => o != null).length >= 4);
        assert.deepEqual(generate(s, style, seed).riff, g.riff);
        const r = { ...s, riff: g.riff };
        if (style === 'pop') assert.equal(riffReport(r).lines[0].ok, true, `${p.prog} pop ${seed} lands on chord tones`);
        if (style !== 'indie') assert.equal(fit(g.riff[0], s.chords[0], s.mode), 'chord');
        assert.equal(tabLines(r).length, 6);
      }
    }
  }
});

test('a motif repeats through the chords and lands on chord tones', () => {
  const s = song('I V vi IV', { riff: parseRiff('1 - 3 5 - 3 - -') });
  const riff = fitMotif(s);
  assert.deepEqual(riff.slice(0, 8), s.riff.slice(0, 8));
  for (let b = 1; b < 4; b++) {
    assert.deepEqual(riff.slice(b * 8, b * 8 + 8).map((o) => o != null), s.riff.slice(0, 8).map((o) => o != null));
    assert.equal(fit(riff[b * 8], s.chords[b], 'major'), 'chord');
  }
});

test('a riff gets a place on the neck and rows on the grid', () => {
  const w = neckWindow([55, 57, 59, 60, 62, 64]);
  assert.equal(w.lo, 0);
  assert.deepEqual(w.pos.get(59), [4, 0]);
  const high = neckWindow([69, 72, 76]);
  assert.ok([...high.pos.values()].every(([, f]) => f >= high.lo && f <= high.hi));
  const s = song('I IV', { riff: [6] });
  assert.equal(gridRows(s, 'penta').filter((o) => o >= 0 && o < 12).length, 6); // five pentatonic notes and the one in use
  assert.equal(gridRows(s, 'all').length, RIFF_HI - RIFF_LO + 1);
});

test('lessons: demos parse, riffs fit their length, challenges start unsolved and can be solved', () => {
  assert.deepEqual(parseRiff("1 - 5, ♭3 | 1'"), [0, null, -5, 3, 12]);
  for (const l of LESSONS) {
    const mode = l.mode || 'major';
    for (const b of l.blocks) {
      if (!b.demo) continue;
      const chords = parseProg(b.demo.prog);
      assert.equal(chords.length, b.demo.prog.trim().split(/\s+/).length, `${l.id}: ${b.demo.prog}`);
      if (b.demo.riff) assert.equal(parseRiff(b.demo.riff).length, totalSteps(song(b.demo.prog, { mode })), `${l.id}: riff length`);
      for (const m of (b.demo.note + (b.p || '')).matchAll(/\{([^}]+)\}/g)) assert.ok(m[1] === 'key' || parseRoman(m[1]), `${l.id}: {${m[1]}}`);
    }
    assert.equal(typeof l.challenge.check(song('I I')), 'boolean');
    assert.equal(l.challenge.check(song('I I')), false, `${l.id} is not solved by an empty start`);
  }
  const solved = {
    c1: song('I IV V vi'), c2: song('I IV V'), c3: song('vi IV I V'), c4: song('I:8 IV:2 V:2'), c5: song('Imaj7 IVadd9'),
    c6: song('I IV iv'), c7: song('I III7 vi IV'), c8: song('ii7 V7 Imaj7'), c9: song('i iv V7', { mode: 'minor' }), c10: song('I iv IV V'),
    r1: song('I V vi IV', { riff: parseRiff('1 - 3 - 5 - 3 - | 7, - 2 - 5 - - -') }),
    r2: song('I V vi IV', { riff: parseRiff('1 2 3 5 6 5 3 2') }),
    r3: song('I V vi IV', { riff: parseRiff('5 - - 5 - - 5 - | 5 - - 5 - - 5 - | 5 - - 5 - - 5 -') }),
    r4: song('I V vi IV', { riff: parseRiff('1 - 3 - - - - - | 7, - 2 - - - - - | 1 - 3 - - - - - | 1 1 - - - - - -') }),
    r5: song('I V vi IV', { riff: parseRiff('3 - 4 - 3 - - -') }),
    r6: song('I V', { riff: parseRiff('1 5 3 5 - - - - | 7, 5 2 5 - - - -') }),
    r7: song('I V vi IV', { riff: parseRiff('3 - 3 2 1 - - - | 2 - 2 3 2 - - -') }),
    r8: song('ii7 V7 Imaj7 VI7', { riff: parseRiff('4 - - - - - - ♯4 | 4 - - - - - - - | 3 - - - - - - - | ♯1 - - - - - - -') }),
    r9: song('I V vi IV', { riff: parseRiff('3 - 3 2 1 - - - | 2 - 2 3 2 - - - | 3 - 3 2 1 - - - | 1 - 2 1 6, - - -') }),
  };
  for (const l of LESSONS) assert.equal(l.challenge.check(solved[l.id]), true, `${l.id} can be solved`);
});
