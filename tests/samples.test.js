import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { POSITIONS, CHORDS, midiOf } from '../js/data.js';
import { SAMPLE_RANGE, SAMPLE_DIR, midiToName, onsetIndex, hasSample } from '../js/samples.js';

const file = (midi) => new URL(`../${SAMPLE_DIR}/${midi}.mp3`, import.meta.url);

test('midiToName matches the source file naming (flats)', () => {
  assert.equal(midiToName(40), 'E2');
  assert.equal(midiToName(58), 'Bb3');
  assert.equal(midiToName(60), 'C4');
  assert.equal(midiToName(61), 'Db4');
  assert.equal(midiToName(76), 'E5');
});

test('every sample in the range exists and is an MP3', () => {
  for (let m = SAMPLE_RANGE[0]; m <= SAMPLE_RANGE[1]; m++) {
    assert.ok(existsSync(file(m)), `${m}.mp3 missing`);
    const b = readFileSync(file(m));
    assert.ok(b.length > 1000, `${m}.mp3 too small`);
    const isMp3 = b.subarray(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
    assert.ok(isMp3, `${m}.mp3 is not an MP3`);
  }
});

test('every note the app plays has a sample', () => {
  const used = POSITIONS.flatMap((c) => c.notes.map(midiOf)).concat(Object.values(CHORDS).flat());
  for (const m of used) assert.ok(hasSample(m), `MIDI ${m} outside the sample range`);
});

test('onsetIndex finds the first sound and backs off by the lead-in', () => {
  const d = new Float32Array([0, 0.001, 0, 0.002, 0.5, 1, -0.4]);
  assert.equal(onsetIndex(d, 1, 0.01), 4);
  assert.equal(onsetIndex(d, 1, 0.01, 2), 2);
  assert.equal(onsetIndex(d, 1, 0.01, 10), 0);
  assert.equal(onsetIndex(new Float32Array(4), 1), 0);
});
