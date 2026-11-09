// Static musical data: strings, chapters, note names and colours.

/** Open-string MIDI numbers, index 0 = low E … 5 = high e. */
export const OPEN = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

export const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', "Do'"];
export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"];
/** Colour per scale degree (Do red … Si purple, Do' red). */
export const DEGREE_COLORS = ['#d9473b', '#ec8a32', '#e9c63c', '#5cb85c', '#34a89c', '#4a84d4', '#9461c9', '#d9473b'];

/** Notes listed Do → Do' as [string, fret]. */
export const CHAPTERS = [
  { id: 'one', name: 'One string', desc: 'C major up the B string',
    notes: [[4, 1], [4, 3], [4, 5], [4, 6], [4, 8], [4, 10], [4, 12], [4, 13]] },
  { id: 'pA', name: 'Pattern I', desc: 'Root on the A string, 3rd fret',
    notes: [[1, 3], [1, 5], [2, 2], [2, 3], [2, 5], [3, 2], [3, 4], [3, 5]] },
  { id: 'pB', name: 'Pattern II', desc: 'Root on the low E string, 8th fret',
    notes: [[0, 8], [0, 10], [1, 7], [1, 8], [1, 10], [2, 7], [2, 9], [2, 10]] },
  { id: 'pC', name: 'Pattern III', desc: 'Higher octave, root on the D string, 10th fret',
    notes: [[2, 10], [2, 12], [3, 9], [3, 10], [3, 12], [4, 10], [4, 12], [4, 13]] },
];

export const LEVELS_PER_CHAPTER = 7;
export const ROUNDS = 10;
export const PASS_SCORE = 8;

export const midiOf = ([string, fret]) => OPEN[string] + fret;

/** Degree indexes (0-based) in play for a level: level 0 → Do·Re, level 6 → Do…Do'. */
export const levelDegrees = (level) => Array.from({ length: level + 2 }, (_, i) => i);

export const chapterById = (id) => CHAPTERS.find((c) => c.id === id);

/** Cadence voicings (MIDI, low → high), always around middle C. */
export const CHORDS = {
  C: [48, 52, 55, 60, 64],
  F: [41, 48, 53, 57, 60],
  G: [43, 47, 50, 55, 59],
};
export const CADENCE = ['C', 'F', 'G', 'C'];
