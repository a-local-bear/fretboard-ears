import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chordsFor, chordByNumeral, chordName, chordPcs, voicing, PRESETS, normalizeBacking, convertSlots,
  overPool, pickOverChord, OVER_OPTIONS, MIN_SLOTS, MAX_SLOTS,
} from '../js/harmony.js';
import { MIN_MIDI, MAX_MIDI } from '../js/data.js';
import { referenceFor } from '../js/reference.js';

const numerals = (mode) => chordsFor(mode).map((c) => c.numeral);

test('major triads and numerals', () => {
  assert.deepEqual(numerals('major'), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  assert.deepEqual(chordsFor('major').map((c) => c.intervals), [[4, 7], [3, 7], [3, 7], [4, 7], [4, 7], [3, 7], [3, 6]]);
  assert.deepEqual(chordsFor('major').map((c) => c.root), [0, 2, 4, 5, 7, 9, 11]);
});

test('minor triads and numerals (natural minor plus the major V)', () => {
  assert.deepEqual(numerals('minor'), ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII', 'V']);
  assert.deepEqual(chordsFor('minor').map((c) => c.intervals), [[3, 7], [3, 6], [4, 7], [3, 7], [3, 7], [4, 7], [4, 7], [4, 7]]);
  assert.deepEqual(chordsFor('minor').map((c) => c.root), [0, 2, 3, 5, 7, 8, 10, 7]);
  assert.equal(chordByNumeral('minor', 'V').borrowed, true);
  assert.equal(chordByNumeral('major', 'V').borrowed, false);
});

test('every chord note of a mode is in the scale (except the borrowed V leading tone)', () => {
  for (const mode of ['major', 'minor']) {
    const scale = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
    for (const c of chordsFor(mode)) {
      if (c.borrowed) continue;
      for (const pc of chordPcs(c)) assert.ok(scale.includes(pc), `${mode} ${c.numeral}`);
    }
  }
});

test('chord names', () => {
  const name = (m, n, k) => chordName(chordByNumeral(m, n), k, m);
  assert.equal(name('major', 'I', 0), 'C');
  assert.equal(name('major', 'vi', 0), 'Am');
  assert.equal(name('major', 'vii°', 0), 'B°');
  assert.equal(name('major', 'IV', 0), 'F');
  assert.equal(name('major', 'IV', 7), 'C');
  assert.equal(name('major', 'V', 2), 'A');
  assert.equal(name('minor', 'i', 9), 'Am');
  assert.equal(name('minor', 'VII', 9), 'G');
  assert.equal(name('minor', 'V', 9), 'E');
  assert.equal(name('minor', 'v', 9), 'Em');
  assert.equal(name('major', 'IV', 10), 'E♭'); // B♭ major uses flats
});

test('voicings stay inside the samples and spell the chord, in every key', () => {
  for (const mode of ['major', 'minor']) {
    for (let key = 0; key < 12; key++) {
      for (const c of chordsFor(mode)) {
        const v = voicing(c, key);
        assert.equal(v.length, 5);
        for (const m of v) assert.ok(m >= MIN_MIDI && m <= MAX_MIDI, `${mode} ${key} ${c.numeral} ${m}`);
        assert.deepEqual([...v].sort((a, b) => a - b), v);
        assert.equal(v[0] % 12, (key + c.root) % 12, 'bass is the root');
        assert.deepEqual([...new Set(v.map((m) => ((m - key) % 12 + 12) % 12))].sort((a, b) => a - b),
          [...chordPcs(c)].sort((a, b) => a - b));
      }
    }
  }
});

test('presets are valid progressions', () => {
  for (const mode of ['major', 'minor']) {
    assert.ok(PRESETS[mode].length >= 3);
    for (const p of PRESETS[mode]) {
      assert.ok(p.length >= MIN_SLOTS && p.length <= MAX_SLOTS);
      for (const n of p) assert.ok(chordByNumeral(mode, n), `${mode} ${n}`);
    }
  }
  const all = PRESETS.major.concat(PRESETS.minor).map((p) => p.join(' '));
  for (const wanted of ['I IV', 'I V', 'I vi IV V', 'ii V I', 'i iv', 'i VII VI V']) assert.ok(all.includes(wanted), wanted);
});

test('normalizeBacking repairs anything invalid', () => {
  const d = normalizeBacking(null);
  assert.equal(d.key, 0);
  assert.equal(d.mode, 'major');
  assert.deepEqual(d.slots, ['I', 'vi', 'IV', 'V']);
  assert.equal(normalizeBacking({ key: 12 }).key, 0);
  assert.equal(normalizeBacking({ key: 7.5 }).key, 0);
  assert.equal(normalizeBacking({ key: 7 }).key, 7);
  assert.equal(normalizeBacking({ tempo: 5 }).tempo, 40);
  assert.equal(normalizeBacking({ tempo: 999 }).tempo, 200);
  assert.equal(normalizeBacking({ tempo: 'fast' }).tempo, 90);
  assert.equal(normalizeBacking({ bars: 3 }).bars, 1);
  assert.equal(normalizeBacking({ bars: 4 }).bars, 4);
  assert.deepEqual(normalizeBacking({ mode: 'minor', slots: ['i', 'iv'] }).slots, ['i', 'iv']);
  assert.deepEqual(normalizeBacking({ mode: 'minor', slots: ['I', 'IV'] }).slots, ['i', 'VII', 'VI', 'V']);
  assert.deepEqual(normalizeBacking({ slots: ['I'] }).slots, ['I', 'vi', 'IV', 'V']);
  assert.deepEqual(normalizeBacking({ slots: ['I', 'IV', 'V', 'I', 'I'] }).slots, ['I', 'vi', 'IV', 'V']);
  assert.deepEqual(normalizeBacking({ slots: 'I IV' }).slots, ['I', 'vi', 'IV', 'V']);
  assert.ok(MAX_SLOTS === 4);
  const ok = { key: 2, mode: 'major', slots: ['ii', 'V', 'I'], tempo: 120, bars: 2 };
  assert.deepEqual(normalizeBacking(ok), ok);
});

test('convertSlots keeps the degrees across modes', () => {
  assert.deepEqual(convertSlots(['I', 'vi', 'IV', 'V'], 'major', 'minor'), ['i', 'VI', 'iv', 'v']);
  assert.deepEqual(convertSlots(['i', 'VII', 'VI', 'V'], 'minor', 'major'), ['I', 'vii°', 'vi', 'V']);
});

test('note over a chord: pools and picking', () => {
  assert.deepEqual(OVER_OPTIONS, ['off', 'main', 'any']);
  assert.deepEqual(overPool('off', 'major'), []);
  assert.deepEqual(overPool('main', 'major').map((c) => c.numeral), ['I', 'IV', 'V']);
  assert.deepEqual(overPool('main', 'minor').map((c) => c.numeral), ['i', 'iv', 'V']);
  assert.equal(overPool('any', 'minor').length, 7);
  assert.equal(pickOverChord('off', 'major'), null);
  assert.equal(pickOverChord('main', 'major', () => 0).numeral, 'I');
  assert.equal(pickOverChord('main', 'major', () => 0.5).numeral, 'IV');
  assert.equal(pickOverChord('main', 'major', () => 0.999).numeral, 'V');
  assert.equal(pickOverChord('main', 'major', () => 1).numeral, 'V');
});

test('a chord under the note makes the reference the cadence', () => {
  const s = { refWhen: 'each', mic: false };
  assert.equal(referenceFor({ ...s, ref: 'drone', over: 'main' }, 2), 'cadence');
  assert.equal(referenceFor({ ...s, ref: 'do', over: 'any' }, 2), 'cadence');
  assert.equal(referenceFor({ ...s, ref: 'none', over: 'main' }, 2), 'none');
  assert.equal(referenceFor({ ...s, ref: 'do', over: 'off' }, 2), 'do');
  assert.equal(referenceFor({ ...s, ref: 'do' }, 2), 'do');
  assert.equal(referenceFor({ ...s, refWhen: 'level', ref: 'cadence', over: 'main' }, 1), 'none');
});
