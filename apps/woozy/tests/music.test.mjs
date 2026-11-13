// Run with:  node --test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAJOR_KEYS, MINOR_KEYS, QUALITIES, SCALES, analyzeChord, chordIn, chordNotes, diatonicChords,
  makeKey, mod12, noteName, notePc, palette, parseChord, parseProgression, parseRoman, romanOf,
} from '../public/js/music/theory.js';
import {
  OPEN_MIDI, bestVoicing, fretsToString, parseFrets, topTriads, voiceProgression, voicingLabels,
  voicingsFor,
} from '../public/js/music/voicings.js';

test('note names and pitch classes', () => {
  assert.equal(notePc('C'), 0);
  assert.equal(notePc('F#'), 6);
  assert.equal(notePc('Bb'), 10);
  assert.equal(notePc('Cb'), 11);
});

test('major scales are spelled the way a guitarist expects', () => {
  const names = (tonic) => SCALES.major.iv.map((d) => noteName(makeKey(tonic), d)).join(' ');
  assert.equal(names('C'), 'C D E F G A B');
  assert.equal(names('G'), 'G A B C D E F#');
  assert.equal(names('A'), 'A B C# D E F# G#');
  assert.equal(names('E'), 'E F# G# A B C# D#');
  assert.equal(names('F'), 'F G A Bb C D E');
  assert.equal(names('Bb'), 'Bb C D Eb F G A');
  assert.equal(names('Eb'), 'Eb F G Ab Bb C D');
  assert.equal(names('Ab'), 'Ab Bb C Db Eb F G');
});

test('minor keys and borrowed degrees', () => {
  const am = makeKey('A', 'minor');
  assert.equal(SCALES.minor.iv.map((d) => noteName(am, d)).join(' '), 'A B C D E F G');
  const c = makeKey('C');
  assert.equal(noteName(c, 3), 'Eb');
  assert.equal(noteName(c, 8), 'Ab');
  assert.equal(noteName(c, 10), 'Bb');
  assert.equal(noteName(makeKey('A'), 10), 'G');
  assert.equal(noteName(makeKey('E'), 8), 'C');
});

test('diatonic chords', () => {
  const romans = (iv, sevenths) => diatonicChords(iv, sevenths).map((c) => romanOf(c.deg, c.q)).join(' ');
  assert.equal(romans(SCALES.major.iv, false), 'I ii iii IV V vi vii°');
  assert.equal(romans(SCALES.major.iv, true), 'Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7');
  assert.equal(romans(SCALES.minor.iv, true), 'i7 iiø7 bIIImaj7 iv7 v7 bVImaj7 bVII7');
  assert.equal(romans(SCALES.dorian.iv, true), 'i7 ii7 bIIImaj7 IV7 v7 viø7 bVIImaj7');
  const g = makeKey('G');
  assert.equal(
    diatonicChords(SCALES.major.iv, true).map((c) => chordIn(g, c).symbol).join(' '),
    'Gmaj7 Am7 Bm7 Cmaj7 D7 Em7 F#m7b5',
  );
});

test('Roman numerals round-trip', () => {
  for (const s of ['I', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7', 'bVII', 'bVImaj7', 'bIIImaj7', 'iv6', 'iv7',
    '#i°7', 'V13', 'ii9', 'Imaj9', 'I6/9', 'V7sus4', 'i(maj7)', 'I+', 'Imaj7#11', 'V7#9', 'biii7']) {
    const c = parseRoman(s);
    assert.equal(romanOf(c.deg, c.q), s, s);
  }
  assert.deepEqual(parseRoman('V7/ii'), { deg: 9, q: '7', label: 'V7/ii' });
  assert.deepEqual(parseRoman('V7/vi'), { deg: 4, q: '7', label: 'V7/vi' });
  assert.equal(chordIn(makeKey('C'), parseRoman('V7/ii')).symbol, 'A7');
  assert.equal(chordIn(makeKey('C'), parseRoman('V7/ii')).roman, 'V7/ii');
  assert.equal(chordIn(makeKey('C'), parseRoman('iv6')).symbol, 'Fm6');
  assert.equal(chordIn(makeKey('A'), parseRoman('bVIImaj7')).symbol, 'Gmaj7');
  assert.throws(() => parseRoman('Hmaj7'));
  assert.throws(() => parseRoman('Vwat'));
});

test('progression strings', () => {
  const p = parseProgression('Imaj7 | vi7 | ii7 V7 | Imaj7 | %');
  assert.deepEqual(p.map((c) => c.beats), [4, 4, 2, 2, 8]);
  assert.deepEqual(parseProgression('ii7:3 bII7:1 | Imaj7').map((c) => c.beats), [3, 1, 4]);
});

test('chord spelling', () => {
  assert.deepEqual(chordNotes('D', 'maj7'), ['D', 'F#', 'A', 'C#']);
  assert.deepEqual(chordNotes('C', 'm7'), ['C', 'Eb', 'G', 'Bb']);
  assert.deepEqual(chordNotes('F', 'm6'), ['F', 'Ab', 'C', 'D']);
  assert.deepEqual(chordNotes('E', '7#9'), ['E', 'G#', 'B', 'D', 'G']);
  assert.deepEqual(chordNotes('Bb', 'maj9'), ['Bb', 'D', 'F', 'A', 'C']);
  assert.deepEqual(parseChord('F#m7'), { root: 'F#', rootPc: 6, q: 'm7' });
  assert.equal(parseChord('Am(maj7)').q, 'mMaj7');
  assert.equal(parseChord('C6/9').q, '6/9');
  assert.equal(parseChord('C/E').q, '');
  assert.equal(parseChord('Badd11').q, null);
});

test('chord analysis', () => {
  const a = (mode, s) => analyzeChord(mode, parseRoman(s));
  assert.equal(a('major', 'Imaj7').fn, 'T');
  assert.equal(a('major', 'ii7').fn, 'S');
  assert.equal(a('major', 'V7').fn, 'D');
  assert.equal(a('major', 'V7').kind, 'diatonic');
  assert.equal(a('major', 'iv6').kind, 'borrowed');
  assert.equal(a('major', 'bVIImaj7').kind, 'borrowed');
  assert.equal(a('major', 'V7/ii').kind, 'secondary');
  assert.match(a('major', 'V7/vi').why, /vi/);
  assert.match(a('major', 'II7').why, /V/);
  assert.equal(a('major', 'bII7').kind, 'secondary');
  assert.equal(a('major', '#i°7').kind, 'passing');
  assert.equal(a('minor', 'i7').fn, 'T');
  assert.equal(a('minor', 'IV7').kind, 'borrowed');
  assert.equal(a('minor', 'V7').fn, 'D');
  assert.equal(a('minor', 'bVImaj7').kind, 'diatonic');
});

test('every palette chord parses and names cleanly in every key', () => {
  for (const mode of ['major', 'minor']) {
    for (const tonic of mode === 'major' ? MAJOR_KEYS : MINOR_KEYS) {
      const key = makeKey(tonic, mode);
      for (const sevenths of [true, false]) {
        const pal = palette(mode, sevenths);
        for (const c of [...pal.diatonic, ...pal.borrowed, ...pal.secondary]) {
          const ch = chordIn(key, c);
          assert.match(ch.symbol, /^[A-G][#b]?/, `${tonic} ${mode} ${ch.roman}`);
          assert.ok(!/##|bb/.test(ch.root), `double accidental: ${ch.symbol} in ${tonic} ${mode}`);
        }
      }
    }
  }
});

// ----------------------------------------------------------- voicings ----

test('every movable shape and open chord contains only (and enough) chord tones', () => {
  let checked = 0;
  for (const q of Object.keys(QUALITIES)) {
    const semis = QUALITIES[q].semis.map(mod12);
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      const list = voicingsFor(rootPc, q);
      assert.ok(list.length > 0, `no voicing for pc ${rootPc} quality "${q}"`);
      for (const v of list) {
        const where = `${q || 'maj'} root ${rootPc} ${v.id}`;
        const rel = v.frets.map((f, i) => (f == null ? null : mod12(OPEN_MIDI[i] + f - rootPc)));
        const sounding = rel.filter((r) => r != null);
        assert.ok(v.frets.every((f) => f == null || (f >= 0 && f <= 17)), `fret out of range: ${where}`);
        assert.ok(sounding.length >= 3, `too few notes: ${where}`);
        for (const r of sounding) assert.ok(semis.includes(r), `non-chord tone ${r}: ${where}`);
        assert.equal(sounding[0], 0, `lowest note is not the root: ${where}`);
        // The defining colour notes must be present (the 5th may be dropped).
        const needed = semis.filter((s) => s !== 0 && s !== 7 && !(semis.length > 5 && s === 2));
        for (const s of needed) {
          if (semis.length >= 5 && s === 7) continue;
          assert.ok(sounding.includes(s), `missing interval ${s}: ${where}`);
        }
        checked++;
      }
    }
  }
  assert.ok(checked > 500);
});

test('well-known grips come out right', () => {
  const frets = (name, prefer) => {
    const c = parseChord(name);
    return fretsToString(bestVoicing(c.rootPc, c.q, prefer).frets);
  };
  assert.equal(frets('Cmaj7'), 'x32000');
  assert.equal(frets('Fmaj7'), 'xx3210');
  assert.equal(frets('Am7'), 'x02010');
  assert.equal(frets('Gmaj7', 'movable'), '3x443x');
  assert.equal(frets('Gm7', 'movable'), '3x333x');
  assert.equal(frets('G7', 'movable'), '3x343x');
  assert.equal(frets('Cm9', 'movable'), 'x3133x');
  assert.equal(frets('Cmaj9', 'movable'), 'x3243x');
  assert.equal(frets('F', 'movable'), '133211');
  const all = (name) => { const c = parseChord(name); return voicingsFor(c.rootPc, c.q).map((v) => fretsToString(v.frets)); };
  assert.ok(all('Cmaj7').includes('x35453'));
  assert.ok(all('Cm7').includes('x35343'));
  assert.ok(all('C7').includes('x35353'));
  assert.ok(all('C6/9').includes('x32233'));
  assert.ok(all('C7#9').includes('x3234x'));
  assert.ok(all('Fmaj7').includes('1x221x'));
  assert.ok(all('Gm7').includes('xx5766'));
});

test('labels and parsing', () => {
  assert.deepEqual(parseFrets('x32010'), [null, 3, 2, 0, 1, 0]);
  assert.deepEqual(parseFrets('x-10-12-11-12-10'), [null, 10, 12, 11, 12, 10]);
  assert.equal(fretsToString([null, 10, 12, 11, 12, 10]), 'x-10-12-11-12-10');
  assert.deepEqual(voicingLabels(parseFrets('x35453'), 0, 'maj7'), [null, 'R', '5', '7', '3', '5']);
  assert.deepEqual(voicingLabels(parseFrets('3x333x'), 7, 'm7'), ['R', null, 'b7', 'b3', '5', null]);
});

test('voice leading keeps a ii–V–I in one area of the neck', () => {
  const key = makeKey('C');
  const chords = parseProgression('ii7 | V7 | Imaj7').map((c) => chordIn(key, c));
  const picked = voiceProgression(chords, 'movable');
  const positions = picked.map((v) => v.pos);
  assert.ok(Math.max(...positions) - Math.min(...positions) <= 3.5, positions.join(','));
  // Explicit frets are always respected.
  const forced = voiceProgression([{ ...chords[0], frets: 'x57565' }, chords[1]], 'movable');
  assert.equal(fretsToString(forced[0].frets), 'x57565');
});

test('top-string triads', () => {
  const g = topTriads(7).map((v) => fretsToString(v.frets));
  assert.deepEqual(g, ['xxx433', 'xxx787', 'x-x-x-12-12-10']);
  const am = topTriads(9, true).map((v) => fretsToString(v.frets));
  assert.deepEqual(am, ['xxx210', 'xxx555', 'xxx9-10-8'.replace(/^xxx/, 'x-x-x-').replace('9-10-8', '9-10-8')]);
});
