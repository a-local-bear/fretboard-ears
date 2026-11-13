// The course outline: modules → lessons.

import { foundations, sevenths } from './m1-foundations.js';
import { progressions } from './m3-progressions.js';
import { colour, rhythm } from './m4-colour-rhythm.js';
import { melody } from './m6-melody.js';
import { songwriting, styles } from './m7-songwriting.js';

export const MODULES = [
  { id: 'map', title: 'The map', blurb: 'Keys, numbers, and what each chord in a key is for.', lessons: foundations },
  { id: 'sevenths', title: 'The sound', blurb: 'Seventh chords — the colour of the whole genre — and the shapes to play them anywhere.', lessons: sevenths },
  { id: 'progressions', title: 'Progressions with attitude', blurb: 'Vamps, ii–V–I, minor and Dorian, borrowed chords, chromatic glue.', lessons: progressions },
  { id: 'colour', title: 'Colour and movement', blurb: 'Extensions, voice leading, and decorating chords.', lessons: colour },
  { id: 'rhythm', title: 'Rhythm and feel', blurb: 'Strumming, the push, stabs, arpeggios — and playing less.', lessons: rhythm },
  { id: 'melody', title: 'Melody', blurb: 'Chord tones, pentatonics, motifs, guitar hooks, and following the changes.', lessons: melody },
  { id: 'songs', title: 'Writing songs', blurb: 'Form, contrast, and a workflow that ends with a finished demo.', lessons: songwriting },
  { id: 'styles', title: 'Style studies', blurb: 'Mac DeMarco, Steve Lacy, Men I Trust, King Krule — and your own first song.', lessons: styles },
];

export const LESSONS = MODULES.flatMap((m, mi) => m.lessons.map((lesson, li) => ({ ...lesson, module: m, number: `${mi + 1}.${li + 1}` })));

const BY_ID = new Map(LESSONS.map((l, i) => [l.id, i]));

export const getLesson = (id) => LESSONS[BY_ID.get(id)] || null;
export const nextLesson = (id) => LESSONS[BY_ID.get(id) + 1] || null;
export const prevLesson = (id) => LESSONS[BY_ID.get(id) - 1] || null;
