import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePitch, spell, noteAt, parsePos, locate, positionsFor, describeStep, describePos,
  keyAlterations, parseMelody, markAccidentals, timeline, onsets, parseDur, measureBeats, midiToFreq, freqToMidi,
} from '../public/js/theory.js';
import { makeRng, dayKey, shiftDay, daysBetween, formatTime } from '../public/js/util.js';

test('written pitches map to MIDI numbers and staff steps', () => {
  assert.equal(parsePitch('C4').midi, 60);
  assert.equal(parsePitch('E4').step, 0); // bottom line
  assert.equal(parsePitch('F5').step, 8); // top line
  assert.equal(parsePitch('B4').step, 4); // middle line
  assert.equal(parsePitch('C4').step, -2); // middle C: first ledger line below
  assert.equal(parsePitch('E3').step, -7); // low E hangs under the third ledger line
  assert.equal(parsePitch('A5').step, 10); // first ledger line above
  assert.equal(parsePitch('F#5').midi, 78);
  assert.equal(parsePitch('Bb4').midi, 70);
  assert.throws(() => parsePitch('H4'));
});

test('open strings are written an octave above where they sound', () => {
  const written = [1, 2, 3, 4, 5, 6].map((s) => noteAt(s, 0).pitch.id);
  assert.deepEqual(written, ['E5', 'B4', 'G4', 'D4', 'A3', 'E3']);
  assert.equal(noteAt(1, 0).sounding, 64);
  assert.equal(noteAt(6, 0).sounding, 40);
  assert.ok(Math.abs(midiToFreq(noteAt(6, 0).sounding) - 82.41) < 0.01);
  assert.ok(Math.abs(freqToMidi(440) - 69) < 1e-9);
});

test('first-position notes land where every method book puts them', () => {
  const expect = {
    '1:0': 'E5', '1:1': 'F5', '1:3': 'G5', '2:0': 'B4', '2:1': 'C5', '2:3': 'D5', '3:0': 'G4', '3:2': 'A4',
    '4:0': 'D4', '4:2': 'E4', '4:3': 'F4', '5:0': 'A3', '5:2': 'B3', '5:3': 'C4', '6:0': 'E3', '6:1': 'F3', '6:3': 'G3',
  };
  for (const [pos, id] of Object.entries(expect)) assert.equal(parsePos(pos).pitch.id, id, pos);
  assert.equal(parsePos('1:2').pitch.id, 'F#5');
  assert.equal(parsePos('3:3b').pitch.id, 'Bb4');
  assert.equal(parsePos('3:3b').name, 'B♭');
});

test('spelling chooses sharps or flats for black keys', () => {
  assert.equal(spell(61).id, 'C#4');
  assert.equal(spell(61, 'flat').id, 'Db4');
  assert.equal(spell(70, 'flat').id, 'Bb4');
  assert.equal(spell(60, 'flat').id, 'C4');
});

test('locate picks the lowest fret inside the window', () => {
  assert.deepEqual(pick(locate(parsePitch('B4'))), [2, 0]); // open B, not 3rd string 4th fret
  assert.deepEqual(pick(locate(parsePitch('E5'), { frets: [4, 9] })), [2, 5]);
  assert.deepEqual(pick(locate(parsePitch('B5'), { frets: [0, 12], string: 1 })), [1, 7]);
  assert.equal(locate(parsePitch('E6'), { frets: [0, 4] }), null);
  assert.equal(locate(parsePitch('F#4')).pitch.id, 'F#4');
  assert.equal(positionsFor(64, [0, 12]).length, 3); // E4: open 1st, 2nd string 5th fret, 3rd string 9th fret
  function pick(n) { return [n.s, n.f]; }
});

test('positions are described in words', () => {
  assert.equal(describeStep(8), 'on the top line');
  assert.equal(describeStep(7), 'in the top space');
  assert.equal(describeStep(0), 'on the bottom line');
  assert.equal(describeStep(-1), 'hanging just below the staff');
  assert.equal(describeStep(-2), 'on the first ledger line below the staff');
  assert.equal(describeStep(-7), 'hanging under the third ledger line below the staff');
  assert.equal(describeStep(9), 'sitting just above the staff');
  assert.equal(describeStep(10), 'on the first ledger line above the staff');
  assert.equal(describeStep(14), 'on the third ledger line above the staff');
  assert.equal(describePos(noteAt(1, 0)), 'open 1st string');
  assert.equal(describePos(noteAt(2, 3)), '2nd string, 3rd fret');
});

test('key signatures', () => {
  assert.deepEqual(keyAlterations(0), {});
  assert.deepEqual(keyAlterations(2), { F: 1, C: 1 });
  assert.deepEqual(keyAlterations(-1), { B: -1 });
});

test('melodies parse into measures with durations', () => {
  const m = parseMelody('E5:q F5:q G5:h | r:q E5:q. D5:e D5:q~ | D5:w');
  assert.equal(m.length, 3);
  assert.deepEqual(m.map((bar) => bar.reduce((a, e) => a + e.dur.beats, 0)), [4, 4, 4]);
  assert.equal(m[1][0].pitch, null);
  assert.equal(m[1][3].tie, true);
  assert.equal(parseDur('h.').beats, 3);
  assert.equal(measureBeats([3, 4]), 3);
  assert.throws(() => parseMelody('E5:x'));
  const hits = onsets(m);
  assert.deepEqual(hits.map((h) => [h.t, h.beats]), [[0, 1], [1, 1], [2, 2], [5, 1.5], [6.5, 0.5], [7, 5]]);
  assert.equal(timeline(m).length, 8);
});

test('accidentals follow the bar-line rule and the key signature', () => {
  const acc = (text, key) => markAccidentals(parseMelody(text), key).flat().map((e) => e.acc);
  assert.deepEqual(acc('F#5:q F#5:q F5:q F5:q | F5:q F#5:q G5:h'), ['#', null, 'n', null, null, '#', null]);
  assert.deepEqual(acc('F#5:q F5:q G5:h', 1), [null, 'n', null]); // G major: F sharp needs no sign
  assert.deepEqual(acc('Bb4:q B4:q Bb4:h', -1), [null, 'n', 'b']);
  assert.deepEqual(acc('F#5:h~ F#5:h | F#5:w'), ['#', null, '#']);
  assert.deepEqual(acc('F#4:q F5:q F4:h'), ['#', null, 'n']); // octaves are independent
});

test('helpers: rng is deterministic, calendar maths survives month ends', () => {
  const a = makeRng(42), b = makeRng(42);
  assert.deepEqual([a.next(), a.next(), a.int(1, 6)], [b.next(), b.next(), b.int(1, 6)]);
  const r = makeRng(7);
  assert.deepEqual(r.shuffle([1, 2, 3, 4, 5]).sort(), [1, 2, 3, 4, 5]);
  const picks = new Set(Array.from({ length: 200 }, () => r.weighted(['a', 'b', 'c'], (x) => (x === 'c' ? 0 : 1))));
  assert.deepEqual([...picks].sort(), ['a', 'b']);
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-02-27', '2026-03-02'), 3);
  assert.match(dayKey(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(formatTime(59.6), '1:00');
  assert.equal(formatTime(125), '2:05');
});
