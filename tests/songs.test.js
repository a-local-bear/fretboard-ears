import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TUNES, PROGRESSIONS, parseMelody, tuneNotes, tuneBeats, tunePhrases, tuneChords, tuneRange, tuneTonic, fitTonic, degName, tuneById,
} from '../js/songs.js';
import { chordByNumeral, normalizeBacking } from '../js/harmony.js';
import { MIN_MIDI, MAX_MIDI } from '../js/data.js';

test('parseMelody reads names, octave marks, beats, rests and phrases', () => {
  const { notes, phrases } = parseMelody("Do Sol,:2 | r:0.5 Mi' / Te,:1.5");
  assert.deepEqual(notes.map((n) => n.o), [0, -5, null, 16, -2]);
  assert.deepEqual(notes.map((n) => n.t), [0, 1, 3, 3.5, 4.5]);
  assert.deepEqual(phrases, [[0, 4], [4, 5]]);
  assert.throws(() => parseMelody('Do Xa'));
});

test('every tune parses, has unique id, and its chords fill its bars', () => {
  assert.equal(new Set(TUNES.map((t) => t.id)).size, TUNES.length);
  for (const t of TUNES) {
    const beats = tuneBeats(t) - t.pickup;
    const bars = t.chords.length;
    assert.ok(beats > (bars - 1) * t.meter && beats <= bars * t.meter, `${t.id}: ${beats} beats for ${bars} bars`);
    for (const c of tuneChords(t)) assert.ok(chordByNumeral(t.mode, c.numeral), `${t.id}: ${c.numeral}`);
    assert.ok(tunePhrases(t).length >= 2, t.id);
    assert.ok(t.about && t.title, t.id);
  }
});

test('tunes end on Do (except the opening-only excerpt) and fit the samples in every key', () => {
  for (const t of TUNES) {
    const ns = tuneNotes(t).filter((n) => n.o != null);
    if (t.id !== 'godrest') assert.equal(((ns[ns.length - 1].o % 12) + 12) % 12, 0, t.id);
    const [lo, hi] = tuneRange(t);
    for (let k = 0; k < 12; k++) {
      const tonic = tuneTonic(t, k);
      assert.ok(tonic != null, `${t.id} in ${k}`);
      assert.ok(tonic + lo >= MIN_MIDI && tonic + hi <= MAX_MIDI);
    }
  }
  assert.equal(fitTonic(0, 0, 12), 60);
});

test('progressions use real chords; those of up to four chords are valid backing loops', () => {
  assert.equal(new Set(PROGRESSIONS.map((p) => p.id)).size, PROGRESSIONS.length);
  for (const p of PROGRESSIONS) {
    for (const n of p.slots) assert.ok(chordByNumeral(p.mode, n), `${p.id}: ${n}`);
    if (p.slots.length <= 4) assert.deepEqual(normalizeBacking({ key: 0, mode: p.mode, slots: p.slots, tempo: 90, bars: 1 }).slots, p.slots);
    assert.ok(p.songs.length && p.about, p.id);
  }
});

test('degName marks octaves both ways', () => {
  assert.equal(degName(-5), 'Sol,');
  assert.equal(degName(0), 'Do');
  assert.equal(degName(12), "Do'");
  assert.equal(degName(-13), 'Si,,');
  assert.equal(tuneById('mary').title, 'Mary Had a Little Lamb');
});
