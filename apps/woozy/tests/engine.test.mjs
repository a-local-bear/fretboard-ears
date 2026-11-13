// Sequencer, melody tools and the song model.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GROOVES, PATTERNS, compile } from '../public/js/audio/engine.js';
import { analyzeMelody, asciiTab, assignFrets, bestPosition, generateMelody, parseMelody, tonicMidi } from '../public/js/music/melody.js';
import { SCALES, mod12, parseProgression } from '../public/js/music/theory.js';
import { chordSpans, newSection, newSong, resolveChords, sectionSteps, songToText } from '../public/js/songs.js';

const chordsFor = (prog, key = 'C', mode = 'major') => resolveChords(key, mode, parseProgression(prog));
const kinds = (comp, step) => comp.steps[step].map((e) => e.kind);
const strums = (comp) => comp.steps.flatMap((evs, step) => evs.filter((e) => e.kind === 'strum').map((e) => ({ step, ...e })));

test('every pattern and groove is well-formed', () => {
  for (const [id, p] of Object.entries(PATTERNS)) {
    assert.ok(p.name && p.hint, id);
    if (p.arp) assert.ok(p.arp.every((t) => /^(b|[1-4])$/.test(t)), id);
    else assert.match(p.grid, /^[DdUuxN.]{16}$/, id);
  }
  for (const [id, g] of Object.entries(GROOVES)) {
    assert.ok(g.name && g.bpm, id);
    if (!g.kick) continue;
    for (const lane of [g.kick, g.snare, g.hat]) assert.match(lane, /^[xo.-]{16}$/, id);
    for (const [step, tone, len] of g.bass) assert.ok(step >= 0 && step < 16 && ['R', '5', '8'].includes(tone) && len > 0, id);
  }
});

test('timeline length and chord map', () => {
  const comp = compile({ chords: chordsFor('Imaj7 | ii7 V7 | Imaj7 | %'), pattern: 'ring', groove: 'none' });
  assert.equal(comp.total, 64);
  assert.deepEqual([comp.chordAt[0], comp.chordAt[16], comp.chordAt[24], comp.chordAt[32], comp.chordAt[63]], [0, 1, 2, 3, 3]);
  assert.equal(compile({ chords: [] }).total, 0);
});

test('every chord is struck when it arrives, even if the pattern has no hit there', () => {
  const comp = compile({ chords: chordsFor('Imaj7 | ii7 V7'), pattern: 'ring', groove: 'none' });
  assert.deepEqual(strums(comp).map((s) => [s.step, s.ci]), [[0, 0], [16, 1], [24, 2]]);
});

test('the push: the next chord arrives an 8th early and is tied over the barline', () => {
  const comp = compile({ chords: chordsFor('Imaj7 | IVmaj7'), pattern: 'push', groove: 'none' });
  const hits = strums(comp);
  // Step 14 of each bar plays the NEXT chord…
  assert.equal(hits.find((s) => s.step === 14).ci, 1);
  assert.equal(hits.find((s) => s.step === 30).ci, 0);
  // …and that chord is not struck again on its own downbeat,
  assert.equal(hits.filter((s) => s.step === 16).length, 0);
  // except the very first downbeat of the song, which sounds on the first pass only.
  const first = hits.filter((s) => s.step === 0);
  assert.equal(first.length, 1);
  assert.equal(first[0].firstPassOnly, true);
});

test('sparse patterns leave the downbeat empty', () => {
  const comp = compile({ chords: chordsFor('Imaj7 | IVmaj7'), pattern: 'backbeat', groove: 'none' });
  assert.deepEqual(strums(comp).map((s) => s.step), [4, 12, 20, 28]);
  assert.ok(strums(comp).every((s) => s.stab));
});

test('arpeggios restart on each chord', () => {
  const comp = compile({ chords: chordsFor('Imaj7 | IVmaj7'), pattern: 'arp', groove: 'none' });
  assert.deepEqual(comp.steps[0].map((e) => [e.kind, e.token, e.first]), [['pick', 'b', true]]);
  assert.deepEqual(comp.steps[16].map((e) => [e.kind, e.token, e.first]), [['pick', 'b', true]]);
  assert.equal(comp.steps[1].length, 0);
});

test('the band follows the chords', () => {
  const comp = compile({ chords: chordsFor('Imaj7 | ii7 V7', 'C'), pattern: 'ring', groove: 'bedroom' });
  const bassAt = (step) => comp.steps[step].find((e) => e.kind === 'bass');
  assert.equal(mod12(bassAt(0).midi), 0); // C under Cmaj7
  assert.equal(mod12(bassAt(16).midi), 2); // D under Dm7
  assert.equal(mod12(bassAt(24).midi), 7); // G under G7 (a chord arriving mid-bar still gets its root)
  for (const evs of comp.steps) for (const e of evs) if (e.kind === 'bass') assert.ok(e.midi >= 26 && e.midi <= 55, `bass note ${e.midi} out of range`);
  assert.ok(kinds(comp, 0).includes('drum') && kinds(comp, 4).includes('drum'));
  // A bass note never rings across a chord change.
  comp.steps.forEach((evs, step) => evs.filter((e) => e.kind === 'bass').forEach((e) => {
    assert.equal(comp.chordAt[step], comp.chordAt[step + e.len - 1], `bass at step ${step} crosses a chord change`);
  }));
  assert.equal(compile({ chords: chordsFor('Imaj7'), groove: 'soul' }).swing, GROOVES.soul.swing);
});

test('melody notes are scheduled; double-stops are polyphonic', () => {
  const melody = [{ s: 0, d: 4, midi: 64 }, { s: 8, d: 4, midi: 67 }, { s: 8, d: 4, midi: 72 }, { s: 99, d: 2, midi: 60 }];
  const comp = compile({ chords: chordsFor('Imaj7'), pattern: 'ring', groove: 'none', melody });
  assert.deepEqual(comp.steps[0].filter((e) => e.kind === 'lead').map((e) => e.poly), [false]);
  assert.deepEqual(comp.steps[8].filter((e) => e.kind === 'lead').map((e) => e.poly), [true, true]);
  assert.equal(comp.steps.flat().filter((e) => e.kind === 'lead').length, 3); // the note past the end is dropped
});

test('melody notation', () => {
  assert.deepEqual(parseMelody("3:2 5 r:1 1' b7, #4:0.5"), [
    { s: 0, d: 4, p: 4 }, { s: 4, d: 2, p: 7 }, { s: 8, d: 2, p: 12 }, { s: 10, d: 2, p: -2 }, { s: 12, d: 1, p: 6 },
  ]);
  assert.throws(() => parseMelody('8:2'));
  assert.equal(tonicMidi(7), 55);
  assert.equal(tonicMidi(0), 60);
  assert.equal(tonicMidi(6), 66);
});

test('fret assignment keeps a line in one position', () => {
  const notes = parseMelody('1 2 3 4 5 6 7 1\'').map((n) => ({ ...n, midi: 57 + n.p })); // A major scale from A3
  const placed = assignFrets(notes, 4);
  for (const n of placed) {
    assert.ok(n.fret >= 4 && n.fret <= 8, `fret ${n.fret} is outside the box`);
    assert.equal([40, 45, 50, 55, 59, 64][n.string] + n.fret, n.midi);
  }
  assert.ok(bestPosition(notes) >= 0 && bestPosition(notes) <= 12);
  const tab = asciiTab(placed, 16);
  assert.equal(tab.split('\n').length, 6);
  assert.match(tab, /^e\|/);
  assert.ok(tab.split('\n').every((line) => line.length === tab.split('\n')[0].length), 'tab lines are the same length');
});

test('generated melodies obey the lesson rules', () => {
  let seed = 42;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (const [prog, mode, scale] of [['Imaj7 | vi7 | ii7 | V7', 'major', 'major'], ['Imaj7 | IVmaj7', 'major', 'majorPent'], ['i7 | IV7 | i7 | IV7', 'minor', 'dorian'], ['Imaj7 | IVmaj7 | iv6 | Imaj7', 'major', 'major']]) {
    const resolved = chordsFor(prog, 'A', mode);
    const spans = chordSpans(resolved);
    const total = spans.reduce((sum, sp) => sum + sp.len, 0);
    for (let run = 0; run < 25; run++) {
      const notes = generateMelody({ spans, scale: SCALES[scale].iv, total, keyPc: 9 }, rand);
      assert.ok(notes.length >= total / 16, `${prog}: only ${notes.length} notes`);
      notes.forEach((n, i) => {
        assert.ok(n.s >= 0 && n.s + n.d <= total && n.d >= 1, `${prog}: note outside the section`);
        assert.ok(n.p >= -8 && n.p <= 16, `${prog}: pitch ${n.p} outside the grid`);
        if (i) assert.ok(notes[i - 1].s + notes[i - 1].d <= n.s, `${prog}: notes overlap`);
      });
      const stats = analyzeMelody(notes, spans, 9, total);
      assert.ok(stats.strongPct >= 0.6, `${prog}: only ${Math.round(stats.strongPct * 100)}% of strong notes are chord tones`);
      assert.ok(stats.lastIsTone, `${prog}: the last note does not land on a chord tone`);
      assert.ok(stats.range <= 17, `${prog}: range ${stats.range}`);
    }
  }
});

test('songs: transposing, charts and section lengths', () => {
  const song = newSong({ title: 'Test', key: 'A', bpm: 90, sections: [newSection('Verse', 'Imaj7 | IVmaj7 iv6 | Imaj7 | %', '3:2 5:2 3:4')] });
  assert.equal(sectionSteps(song.sections[0]), 64);
  assert.deepEqual(resolveChords('A', 'major', song.sections[0].chords).map((c) => c.symbol), ['Amaj7', 'Dmaj7', 'Dm6', 'Amaj7']);
  assert.deepEqual(resolveChords('C', 'major', song.sections[0].chords).map((c) => c.symbol), ['Cmaj7', 'Fmaj7', 'Fm6', 'Cmaj7']);
  const text = songToText(song);
  assert.match(text, /^Test\nKey of A major · 90 bpm/);
  assert.match(text, /\[Verse\]\n\| Amaj7 \| Dmaj7 {2}Dm6 \| Amaj7 \| % \|/);
  assert.match(text, /Imaj7 – IVmaj7 – iv6 – Imaj7/);
  assert.match(text, /\ne\|/);
  // sections created from arrays are copies, not shared references
  const copy = newSection('Copy', song.sections[0].chords, song.sections[0].melody);
  copy.chords[0].beats = 8;
  copy.melody[0].p = 99;
  assert.equal(song.sections[0].chords[0].beats, 4);
  assert.equal(song.sections[0].melody[0].p, 4);
});
