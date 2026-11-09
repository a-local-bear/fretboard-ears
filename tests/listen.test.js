import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spoken, revealTimeline } from '../js/listen.js';

test('solfège is spelled the way speech engines say it', () => {
  assert.equal(spoken('Do'), 'Doe');
  assert.equal(spoken('Mi'), 'Me');
  assert.equal(spoken('Me'), 'May');
  assert.equal(spoken("Sol'"), 'Sole');
});

test('letters: accidentals as words, A not read as an article', () => {
  assert.equal(spoken('C♯'), 'C sharp');
  assert.equal(spoken("B♭'"), 'B flat');
  assert.equal(spoken('A♭'), 'Ay flat');
  assert.equal(spoken('E'), 'E');
});

test('a single note then its walk to Do', () => {
  const { notes, end } = revealTimeline([4], [4, 2, 0], 0.6, 0.75);
  assert.deepEqual(notes, [{ note: 4, t: 0 }, { note: 2, t: 0.75 }, { note: 0, t: 1.5 }]);
  assert.equal(end, 1.5);
});

test('a phrase replays, then only its last note resolves', () => {
  const { notes, end } = revealTimeline([0, 7, 9], [9, 11, 12], 0.5, 1);
  assert.deepEqual(notes.map((n) => n.note), [0, 7, 9, 11, 12]);
  assert.deepEqual(notes.map((n) => n.t), [0, 0.5, 1, 2, 3]);
  assert.equal(end, 3);
});

test('no resolution: the answer is just the phrase', () => {
  assert.deepEqual(revealTimeline([5], [5], 0.6, 0.75), { notes: [{ note: 5, t: 0 }], end: 0 });
});
