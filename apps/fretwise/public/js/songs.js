// The songbook.  Every tune is in the public domain (traditional or long out of
// copyright); "Sixth String Stomp" is an original study written for this course.
//
// Melodies use the compact format understood by theory.parseMelody().  Pitches
// are written pitches: what appears on the staff (guitar sounds an octave lower).

export const SONGS = {
  'mary-lamb': {
    title: 'Mary Had a Little Lamb', credit: 'Traditional', timeSig: [4, 4], bpm: 96,
    melody: 'E5:q D5:q C5:q D5:q | E5:q E5:q E5:h | D5:q D5:q D5:h | E5:q G5:q G5:h | E5:q D5:q C5:q D5:q | E5:q E5:q E5:q E5:q | D5:q D5:q E5:q D5:q | C5:w',
  },
  'jingle-bells': {
    title: 'Jingle Bells', credit: 'James Lord Pierpont, 1857 (easy rhythm)', timeSig: [4, 4], bpm: 112, chunk: 4,
    melody: 'E5:q E5:q E5:h | E5:q E5:q E5:h | E5:q G5:q C5:q D5:q | E5:w | F5:q F5:q F5:q F5:q | F5:q E5:q E5:q E5:q | E5:q D5:q D5:q E5:q | D5:h G5:h | ' +
      'E5:q E5:q E5:h | E5:q E5:q E5:h | E5:q G5:q C5:q D5:q | E5:w | F5:q F5:q F5:q F5:q | F5:q E5:q E5:q E5:q | G5:q G5:q F5:q D5:q | C5:w',
  },
  'hot-cross-buns': {
    title: 'Hot Cross Buns', credit: 'Traditional', timeSig: [4, 4], bpm: 88, chunk: 1,
    melody: 'B4:q A4:q G4:h | B4:q A4:q G4:h | G4:e G4:e G4:e G4:e A4:e A4:e A4:e A4:e | B4:q A4:q G4:h',
  },
  'aura-lee': {
    title: 'Aura Lee', credit: 'George R. Poulton, 1861', timeSig: [4, 4], bpm: 92, chunk: 4,
    melody: 'G4:q C5:q B4:q C5:q | D5:q A4:q D5:h | C5:q B4:q A4:q B4:q | C5:w | G4:q C5:q B4:q C5:q | D5:q A4:q D5:h | C5:q B4:q A4:q B4:q | C5:w | ' +
      'E5:q E5:q E5:h | E5:q E5:q E5:h | E5:q D5:q C5:q D5:q | E5:w | E5:q E5:q F5:q E5:q | D5:q A4:q D5:h | C5:q B4:q A4:q B4:q | C5:w',
  },
  'frere-jacques': {
    title: 'Frère Jacques', credit: 'Traditional (France)', timeSig: [4, 4], bpm: 96,
    melody: 'G4:q A4:q B4:q G4:q | G4:q A4:q B4:q G4:q | B4:q C5:q D5:h | B4:q C5:q D5:h | D5:e E5:e D5:e C5:e B4:q G4:q | D5:e E5:e D5:e C5:e B4:q G4:q | G4:q D4:q G4:h | G4:q D4:q G4:h',
  },
  'amazing-grace': {
    title: 'Amazing Grace', credit: 'Traditional (first half)', timeSig: [3, 4], bpm: 84,
    melody: 'r:h D4:q | G4:h B4:e G4:e | B4:h A4:q | G4:h E4:q | D4:h D4:q | G4:h B4:e G4:e | B4:h A4:q | D5:h.',
  },
  twinkle: {
    title: 'Twinkle, Twinkle, Little Star', credit: 'Traditional', timeSig: [4, 4], bpm: 100,
    melody: 'C4:q C4:q G4:q G4:q | A4:q A4:q G4:h | F4:q F4:q E4:q E4:q | D4:q D4:q C4:h | G4:q G4:q F4:q F4:q | E4:q E4:q D4:h | G4:q G4:q F4:q F4:q | E4:q E4:q D4:h | ' +
      'C4:q C4:q G4:q G4:q | A4:q A4:q G4:h | F4:q F4:q E4:q E4:q | D4:q D4:q C4:h',
  },
  'ode-to-joy': {
    title: 'Ode to Joy', credit: 'Ludwig van Beethoven, 1824', timeSig: [4, 4], bpm: 104,
    melody: 'E4:q E4:q F4:q G4:q | G4:q F4:q E4:q D4:q | C4:q C4:q D4:q E4:q | E4:q. D4:e D4:h | E4:q E4:q F4:q G4:q | G4:q F4:q E4:q D4:q | C4:q C4:q D4:q E4:q | D4:q. C4:e C4:h',
  },
  saints: {
    title: 'When the Saints Go Marching In', credit: 'Traditional (opening)', timeSig: [4, 4], bpm: 108,
    melody: 'r:q C4:q E4:q F4:q | G4:w | r:q C4:q E4:q F4:q | G4:w | r:q C4:q E4:q F4:q | G4:h E4:h | C4:h E4:h | D4:w',
  },
  stomp: {
    title: 'Sixth String Stomp', credit: 'A study for the low strings', timeSig: [4, 4], bpm: 100,
    melody: 'E3:q E3:q G3:q A3:q | B3:q A3:q G3:q E3:q | A3:q A3:q C4:q D4:q | E4:q D4:q C4:q A3:q | E3:q E3:q G3:q A3:q | B3:q D4:q B3:q A3:q | G3:q F3:q E3:h~ | E3:w',
  },
  'mountain-king': {
    title: 'In the Hall of the Mountain King', credit: 'Edvard Grieg, 1875', timeSig: [4, 4], bpm: 84, chunk: 1,
    melody: 'A3:e B3:e C4:e D4:e E4:e C4:e E4:q | D#4:e B3:e D#4:q D4:e Bb3:e D4:q | A3:e B3:e C4:e D4:e E4:e C4:e E4:e A4:e | G4:e E4:e C4:e E4:e G4:h',
  },
  'fur-elise': {
    title: 'Für Elise', credit: 'Ludwig van Beethoven, 1810 (opening, in easy note values)', timeSig: [3, 4], bpm: 96,
    melody: 'r:h E5:e D#5:e | E5:e D#5:e E5:e B4:e D5:e C5:e | A4:q r:e C4:e E4:e A4:e | B4:q r:e E4:e G#4:e B4:e | C5:q r:e E4:e E5:e D#5:e | E5:e D#5:e E5:e B4:e D5:e C5:e | A4:q r:e C4:e E4:e A4:e | B4:q r:e E4:e C5:e B4:e | A4:h.',
    chunk: [3, 2, 2, 2],
  },
  greensleeves: {
    title: 'Greensleeves', credit: 'Traditional (England)', timeSig: [3, 4], bpm: 100, chunk: 4,
    melody: 'r:h A4:q | C5:h D5:q | E5:q. F5:e E5:q | D5:h B4:q | G4:q. A4:e B4:q | C5:h A4:q | A4:q. G#4:e A4:q | B4:h G#4:q | ' +
      'E4:h A4:q | C5:h D5:q | E5:q. F5:e E5:q | D5:h B4:q | G4:q. A4:e B4:q | C5:q. B4:e A4:q | G#4:q. F#4:e G#4:q | A4:h.',
  },
  'drunken-sailor': {
    title: 'Drunken Sailor', credit: 'Traditional sea shanty', timeSig: [4, 4], keySig: 1, bpm: 100,
    melody: 'E4:q E4:e E4:e E4:q E4:e E4:e | E4:q A3:q C4:q E4:q | D4:q D4:e D4:e D4:q D4:e D4:e | D4:q G3:q B3:q D4:q | E4:q E4:e E4:e E4:q E4:e E4:e | E4:q F#4:q G4:q A4:q | G4:q E4:q D4:q B3:q | A3:h A3:h',
  },
  'joy-to-the-world': {
    title: 'Joy to the World', credit: 'Lowell Mason, 1839 (opening)', timeSig: [4, 4], keySig: 2, bpm: 96,
    melody: 'D5:h C#5:q. B4:e | A4:h. G4:q | F#4:h E4:h | D4:h. A4:q | B4:h. B4:q | C#5:h. C#5:q | D5:w',
    chunk: [2, 2, 3],
  },
  'twinkle-f': {
    title: 'Twinkle, Twinkle — in F', credit: 'Traditional', timeSig: [4, 4], keySig: -1, bpm: 100,
    melody: 'F4:q F4:q C5:q C5:q | D5:q D5:q C5:h | Bb4:q Bb4:q A4:q A4:q | G4:q G4:q F4:h | C5:q C5:q Bb4:q Bb4:q | A4:q A4:q G4:h | C5:q C5:q Bb4:q Bb4:q | A4:q A4:q G4:h | ' +
      'F4:q F4:q C5:q C5:q | D5:q D5:q C5:h | Bb4:q Bb4:q A4:q A4:q | G4:q G4:q F4:h',
  },
  'minuet-in-g': {
    title: 'Minuet in G', credit: 'Christian Petzold, from the Anna Magdalena Notebook', timeSig: [3, 4], keySig: 1, bpm: 100,
    melody: 'D5:q G4:e A4:e B4:e C5:e | D5:q G4:q G4:q | E5:q C5:e D5:e E5:e F#5:e | G5:q G4:q G4:q | C5:q D5:e C5:e B4:e A4:e | B4:q C5:e B4:e A4:e G4:e | F#4:q G4:e A4:e B4:e G4:e | A4:h.',
  },
  'frere-jacques-v': {
    title: 'Frère Jacques — fifth position', credit: 'Traditional (France)', timeSig: [4, 4], bpm: 96, frets: [5, 8],
    melody: 'C5:q D5:q E5:q C5:q | C5:q D5:q E5:q C5:q | E5:q F5:q G5:h | E5:q F5:q G5:h | G5:e A5:e G5:e F5:e E5:q C5:q | G5:e A5:e G5:e F5:e E5:q C5:q | C5:q G4:q C5:h | C5:q G4:q C5:h',
  },
  romanza: {
    title: 'Romanza', credit: 'Anonymous (Spanish Romance) — the melody, all on the first string', timeSig: [3, 4], keySig: 1, bpm: 96, frets: [0, 12], string: 1, chunk: 4,
    melody: 'B5:q B5:q B5:q | B5:q A5:q G5:q | G5:q F#5:q E5:q | E5:q G5:q B5:q | E6:q E6:q E6:q | E6:q D6:q C6:q | C6:q B5:q A5:q | A5:q B5:q C6:q | ' +
      'B5:q C6:q B5:q | D#6:q C6:q B5:q | B5:q A5:q G5:q | G5:q F#5:q E5:q | F#5:q F#5:q F#5:q | F#5:q G5:q F#5:q | E5:q E5:q E5:q | E5:h.',
  },
};

for (const [id, song] of Object.entries(SONGS)) {
  song.id = id;
  song.keySig ??= 0;
  song.frets ??= [0, 4];
  song.string ??= null;
}
