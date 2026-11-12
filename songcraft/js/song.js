// The song being written (key, chords, strum pattern, riff) and its translation into timed events.
// Pure. Time is counted in steps: 8th notes, two per beat, eight per bar.

import { mod12, QUALITIES, parseProg } from './theory.js';
import { shapeFor, shapeMidis } from './shapes.js';

export const STEPS_PER_BEAT = 2;
export const STEPS_PER_BAR = 8;
export const MAX_CHORDS = 8;
export const TEMPO_RANGE = [50, 160];
export const BEATS_OPTIONS = [2, 4, 8];
export const RIFF_LO = -5; // lowest riff note, in semitones from the tonic
export const RIFF_HI = 12;

/**
 * Strum patterns. `hits`: [step in the bar, 'd' | 'u', loudness]. `picks`: one string per step,
 * counted from the bass (0) or from the top (negative). `len`: steps a hit rings before it is damped.
 */
export const PATTERNS = {
  pop: { name: 'Pop strum', hits: [[0, 'd', 1], [2, 'd', 0.7], [3, 'u', 0.5], [5, 'u', 0.55], [6, 'd', 0.7], [7, 'u', 0.5]] },
  eighths: { name: 'Driving 8ths', hits: [[0, 'd', 1], [1, 'p', 0.5], [2, 'd', 0.7], [3, 'p', 0.5], [4, 'd', 0.9], [5, 'p', 0.5], [6, 'd', 0.7], [7, 'p', 0.55]] },
  arp: { name: 'Picked', picks: [0, -3, -2, -1, -2, -3, -2, -1] },
  jazz: { name: 'Jazz comp', hits: [[0, 'd', 0.9], [3, 'd', 0.75]], len: 1.6, swing: 0.3 },
  ring: { name: 'Let ring', hits: [[0, 'd', 1]] },
};

/** MIDI of the tonic the riff is written around: E3 … D♯4, so a riff from Sol below to Do above stays on the samples. */
export const tonicMidi = (keyPc) => 52 + mod12(keyPc - 4);

export const totalSteps = (song) => song.chords.reduce((n, c) => n + c.beats * STEPS_PER_BEAT, 0);

/** For every step, the index of the chord sounding there. */
export function chordSteps(song) {
  const at = [];
  song.chords.forEach((c, i) => { for (let s = 0; s < c.beats * STEPS_PER_BEAT; s++) at.push(i); });
  return at;
}

export const voicing = (chord, keyPc) => shapeMidis(shapeFor(keyPc + chord.root, chord.q));

export const DEFAULT_SONG = { key: 7, mode: 'major', bpm: 96, pattern: 'pop', beat: true, chords: parseProg('I V vi IV'), riff: [] };

const validChord = (c) => c && Number.isInteger(c.root) && c.root >= 0 && c.root < 12 && c.q in QUALITIES;

/** Any stored or hand-built object → a valid song, with the riff cut or padded to the progression's length. */
export function normalizeSong(raw) {
  const d = DEFAULT_SONG;
  const s = raw && typeof raw === 'object' ? raw : {};
  const chords = (Array.isArray(s.chords) ? s.chords : []).filter(validChord).slice(0, MAX_CHORDS)
    .map((c) => ({ root: c.root, q: c.q, beats: BEATS_OPTIONS.includes(c.beats) ? c.beats : 4 }));
  const song = {
    key: Number.isInteger(s.key) && s.key >= 0 && s.key < 12 ? s.key : d.key,
    mode: s.mode === 'minor' ? 'minor' : 'major',
    bpm: Number.isFinite(s.bpm) ? Math.min(TEMPO_RANGE[1], Math.max(TEMPO_RANGE[0], Math.round(s.bpm))) : d.bpm,
    pattern: s.pattern in PATTERNS ? s.pattern : d.pattern,
    beat: s.beat !== false,
    chords: chords.length ? chords : d.chords.map((c) => ({ ...c })),
  };
  const n = totalSteps(song);
  const riff = Array.isArray(s.riff) ? s.riff : [];
  song.riff = Array.from({ length: n }, (_, i) => (Number.isInteger(riff[i]) && riff[i] >= RIFF_LO && riff[i] <= RIFF_HI ? riff[i] : null));
  return song;
}

/**
 * The song as events per step: { steps, swing, chordAt, events: [[event, …], …] }. Events:
 *   strum { notes, gain, up, len? }   pick { midi, gain }   mel { midi, len }   kick | snare | hat { gain }
 * `first` marks the first chord event of a chord, where the previous chord is damped.
 */
export function compile(song, { chords = true, riff = true } = {}) {
  const p = PATTERNS[song.pattern];
  const steps = totalSteps(song);
  const chordAt = chordSteps(song);
  const events = Array.from({ length: steps }, () => []);
  let start = 0;
  if (chords) {
    for (const c of song.chords) {
      const notes = voicing(c, song.key);
      const len = c.beats * STEPS_PER_BEAT;
      for (let i = 0; i < len; i++) {
        const local = i % STEPS_PER_BAR;
        const first = i === 0;
        if (p.picks) {
          const k = p.picks[local];
          const midi = notes[k < 0 ? Math.max(1, notes.length + k) : k] ?? notes[0];
          events[start + i].push({ k: 'pick', midi, gain: local === 0 ? 0.6 : 0.42, first });
        } else {
          const hit = p.hits.find((h) => h[0] === local);
          if (!hit) continue;
          const [, dir, level] = hit;
          const played = dir === 'u' ? notes.slice(-3).reverse() : dir === 'p' ? notes.slice(0, 4) : notes;
          events[start + i].push({ k: 'strum', notes: played, gain: 0.26 * level * (first ? 1.1 : 1), up: dir === 'u', first, len: p.len });
        }
      }
      start += len;
    }
  }
  if (song.beat) {
    const jazz = song.pattern === 'jazz';
    for (let s = 0; s < steps; s++) {
      const b = s % STEPS_PER_BAR;
      if (jazz) {
        if (b % 2 === 0 || b === 3 || b === 7) events[s].push({ k: 'hat', gain: b % 4 === 2 ? 0.5 : 0.3 });
      } else {
        if (b === 0 || b === 4) events[s].push({ k: 'kick', gain: 0.8 });
        if (b === 2 || b === 6) events[s].push({ k: 'snare', gain: 0.45 });
        events[s].push({ k: 'hat', gain: b % 2 ? 0.14 : 0.24 });
      }
    }
  }
  if (riff) {
    const tonic = tonicMidi(song.key);
    for (let s = 0; s < steps; s++) {
      if (song.riff[s] == null) continue;
      let len = 1;
      while (len < 6 && s + len < steps && song.riff[s + len] == null) len++;
      events[s].push({ k: 'mel', midi: tonic + song.riff[s], len });
    }
  }
  return { steps, swing: p.swing || 0, chordAt, events };
}
