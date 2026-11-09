import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchDegree } from '../js/pitch.js';
import { buildContext, levelsFor } from '../js/data.js';

test('matchDegree works with semitone-offset ids: chromatic notes and exact octaves', () => {
  // Level in G major, tonic 55: ids are offsets, so the array is sparse.
  const pool = [];
  for (const o of [0, 1, 3, 7, 12, 13]) pool[o] = 55 + o;
  assert.equal(matchDegree(56, pool).degree, 1, 'Ra');
  assert.equal(matchDegree(58, pool).degree, 3, 'Me');
  assert.equal(matchDegree(44, pool).degree, 1, 'any octave by default');
  assert.equal(matchDegree(44, pool, { exact: true }).degree, null, 'wrong octave rejected when exact');
  assert.equal(matchDegree(68, pool, { exact: true }).degree, 13);
  assert.equal(matchDegree(57, pool).degree, null, 'not in the level');
});

test('every note of every pattern level is recognised from the mic in every key', () => {
  for (const chapterId of ['one', 'pA', 'pB', 'pC', 'neck']) {
    for (const level of levelsFor(chapterId)) {
      for (let key = 0; key < 12; key++) {
        const ctx = buildContext(chapterId, level, key, level.mode ?? 'minor');
        const mids = [];
        for (const o of ctx.pool) mids[o] = ctx.tonic + o;
        for (const o of ctx.pool) {
          assert.equal(matchDegree(ctx.tonic + o, mids, { exact: ctx.multiOctave }).degree, o, `${level.id} ${key} ${o}`);
        }
      }
    }
  }
});
