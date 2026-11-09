import test from 'node:test';
import assert from 'node:assert/strict';
import { DRILLS, DRILL_GROUPS, buildDrillDeck, drillById, tonalMelody, tuneDrill, deal, tuneChoices } from '../js/drills.js';
import { mulberry32 } from '../js/deck.js';
import { ROUNDS, SCALES } from '../js/data.js';
import { TUNES } from '../js/songs.js';

const mod12 = (n) => ((n % 12) + 12) % 12;

test('drill ids are unique, start with d-, and belong to a group', () => {
  assert.equal(new Set(DRILLS.map((d) => d.id)).size, DRILLS.length);
  for (const d of DRILLS) {
    assert.ok(d.id.startsWith('d-'), d.id);
    assert.ok(DRILL_GROUPS.some((g) => g.id === d.group), d.id);
    assert.ok(d.about.length >= 2, d.id);
  }
  assert.equal(drillById('d-mode').kind, 'mode');
});

test('every drill deals ROUNDS answerable rounds', () => {
  for (const d of DRILLS) {
    for (let seed = 1; seed <= 20; seed++) {
      const deck = buildDrillDeck(d, mulberry32(seed));
      assert.equal(deck.length, ROUNDS, d.id);
      for (const r of deck) {
        assert.ok(r.answers.length >= 1, d.id);
        const ids = new Set(r.choices.map((c) => c.id));
        for (const a of r.answers) assert.ok(ids.has(a), `${d.id}: answer ${a} not among choices`);
        assert.ok(r.keyPc >= 0 && r.keyPc < 12);
      }
    }
  }
});

test('progression rounds start on the tonic, give it, and never repeat a chord straight away', () => {
  const d = drillById('d-prog-dia');
  for (const r of buildDrillDeck(d, mulberry32(3))) {
    assert.equal(r.chords[0], 'I');
    assert.equal(r.given, 1);
    assert.deepEqual(r.answers, r.chords.slice(1));
    r.chords.forEach((c, i) => i && assert.notEqual(c, r.chords[i - 1]));
  }
});

test('function and quality decks are balanced', () => {
  const q = buildDrillDeck(drillById('d-quality'), mulberry32(9));
  assert.equal(q.filter((r) => r.answers[0] === 'maj').length, ROUNDS / 2);
  const f = buildDrillDeck(drillById('d-func-145'), mulberry32(9)).map((r) => r.answers[0]);
  for (const n of ['I', 'IV', 'V']) assert.ok(f.filter((x) => x === n).length >= 3);
});

test('tonal melodies end on Do and contain the third', () => {
  for (const mode of ['major', 'minor']) {
    for (let s = 1; s < 200; s++) {
      const m = tonalMelody(mode, mulberry32(s)).map((n) => n.o);
      assert.equal(mod12(m[m.length - 1]), 0);
      assert.ok(m.some((o) => mod12(o) === SCALES[mode][2]), `${mode} seed ${s}: ${m}`);
    }
  }
});

test('tonic rounds answer the key, tune rounds the notes', () => {
  for (const r of buildDrillDeck(drillById('d-tonic-any'), mulberry32(4))) assert.equal(r.answers[0], String(r.keyPc));
  for (const r of buildDrillDeck(drillById('d-tune-minor'), mulberry32(4))) {
    assert.deepEqual(r.answers, r.melody.map((n) => String(n.o)));
    assert.equal(r.mode, 'minor');
  }
});

test('a single-tune drill uses only that tune', () => {
  for (const t of TUNES) {
    const deck = buildDrillDeck(tuneDrill(t.id), mulberry32(2));
    assert.ok(deck.every((r) => r.tune === t.id), t.id);
    assert.ok(tuneChoices(t).length >= 4);
  }
});

test('deal uses every item before repeating', () => {
  const out = deal([1, 2, 3], 6, mulberry32(1));
  assert.deepEqual(out.slice(0, 3).sort(), [1, 2, 3]);
  out.forEach((x, i) => i && assert.notEqual(x, out[i - 1]));
});
