// The songbook: public-domain tunes written in movable-do solfège, with their chords, and the
// common chord progressions behind thousands of songs. Pure data and functions only.
//
// Melody notation, one token per note, separated by spaces:
//   Name[,'][:beats]   a note: a solfège name from SEMI_NAMES (Do Ra Re Me Mi Fa Se Sol Le La Te Si),
//                      each ' raises it an octave and each , lowers it one; beats default to 1.
//   r[:beats]          a rest.
//   |                  a bar line, for reading only (timing comes from the beats).
//   /                  the end of a phrase.
// Offsets are semitones above the tune's Do, as everywhere in the app; minor tunes count from the
// minor tonic (Do Re Me Fa Sol Le Te), like the minor levels.
// `chords` has one entry per bar after the `pickup` (beats before the first full bar): one numeral,
// or two (space-separated) that split the bar evenly. Numerals come from harmony.js chordsFor(mode).

import { SEMI_NAMES, MIN_MIDI, MAX_MIDI, noteColor } from './data.js';

const mod12 = (n) => ((n % 12) + 12) % 12;

export const TUNES = [
  {
    id: 'twinkle', title: 'Twinkle, Twinkle, Little Star', mode: 'major', key: 0, bpm: 100, meter: 4, pickup: 0,
    about: 'A leap from Do up to Sol, then a slow stepwise walk all the way back down to Do. The best first tune to work out by ear, because almost every move is a step.',
    melody: `Do Do Sol Sol | La La Sol:2 | Fa Fa Mi Mi | Re Re Do:2 /
      Sol Sol Fa Fa | Mi Mi Re:2 | Sol Sol Fa Fa | Mi Mi Re:2 /
      Do Do Sol Sol | La La Sol:2 | Fa Fa Mi Mi | Re Re Do:2 /`,
    chords: ['I', 'IV I', 'IV I', 'V I', 'I IV', 'I V', 'I IV', 'I V', 'I', 'IV I', 'IV I', 'V I'],
  },
  {
    id: 'mary', title: 'Mary Had a Little Lamb', mode: 'major', key: 0, bpm: 110, meter: 4, pickup: 0,
    about: 'Only Do, Re, Mi and one Sol. It lives on the first three notes of the scale, so it is the tune to try right after the first stage.',
    melody: `Mi Re Do Re | Mi Mi Mi:2 | Re Re Re:2 | Mi Sol Sol:2 /
      Mi Re Do Re | Mi Mi Mi Mi | Re Re Mi Re | Do:4 /`,
    chords: ['I', 'I', 'V', 'I', 'I', 'I', 'V', 'I'],
  },
  {
    id: 'ode', title: 'Ode to Joy', mode: 'major', key: 0, bpm: 110, meter: 4, pickup: 0,
    about: 'Beethoven\'s theme moves almost entirely by step between Do and Sol. The two phrases are the same except for the ending: the first stops on Re (a question), the second on Do (the answer).',
    melody: `Mi Mi Fa Sol | Sol Fa Mi Re | Do Do Re Mi | Mi:1.5 Re:0.5 Re:2 /
      Mi Mi Fa Sol | Sol Fa Mi Re | Do Do Re Mi | Re:1.5 Do:0.5 Do:2 /`,
    chords: ['I', 'V', 'I', 'V', 'I', 'V', 'I', 'V I'],
  },
  {
    id: 'frere', title: 'Frère Jacques', mode: 'major', key: 0, bpm: 110, meter: 4, pickup: 0,
    about: 'Every line is played twice, which makes it easy to check yourself. The last line drops below Do to the low Sol and comes back: Do Sol, Do.',
    melody: `Do Re Mi Do | Do Re Mi Do / Mi Fa Sol:2 | Mi Fa Sol:2 /
      Sol:0.5 La:0.5 Sol:0.5 Fa:0.5 Mi Do | Sol:0.5 La:0.5 Sol:0.5 Fa:0.5 Mi Do /
      Do Sol, Do:2 | Do Sol, Do:2 /`,
    chords: ['I', 'I', 'I', 'I', 'I', 'I', 'I V', 'I V'],
  },
  {
    id: 'row', title: 'Row, Row, Row Your Boat', mode: 'major', key: 0, bpm: 100, meter: 3, pickup: 0,
    about: 'Climbs from Do to Sol, then spells the whole tonic chord downwards (Do\' Sol Mi Do) before walking home. Hearing that chord in a melody is the first step to hearing harmony.',
    melody: `Do:1.5 Do:1.5 | Do Re:0.5 Mi:1.5 | Mi Re:0.5 Mi Fa:0.5 | Sol:3 /
      Do':0.5 Do':0.5 Do':0.5 Sol:0.5 Sol:0.5 Sol:0.5 | Mi:0.5 Mi:0.5 Mi:0.5 Do:0.5 Do:0.5 Do:0.5 | Sol Fa:0.5 Mi Re:0.5 | Do:3 /`,
    chords: ['I', 'I', 'I', 'I', 'I', 'I', 'V', 'I'],
  },
  {
    id: 'birthday', title: 'Happy Birthday', mode: 'major', key: 0, bpm: 100, meter: 3, pickup: 1,
    about: 'It starts on Sol, below the Do it comes home to, and every line jumps a little higher: up a fourth, a fifth, then a whole octave to Sol\'. Each line ends on a different chord tone.',
    melody: `Sol:0.75 Sol:0.25 | La Sol Do' | Si:2 /
      Sol:0.75 Sol:0.25 | La Sol Re' | Do':2 /
      Sol:0.75 Sol:0.25 | Sol' Mi' Do' | Si La /
      Fa':0.75 Fa':0.25 | Mi' Do' Re' | Do':3 /`,
    chords: ['I', 'V', 'V', 'I', 'I', 'IV', 'I V', 'I'],
  },
  {
    id: 'jingle', title: 'Jingle Bells (chorus)', mode: 'major', key: 0, bpm: 120, meter: 4, pickup: 0,
    about: 'Repeated Mi, a jump up to Sol and a fall to Do. The first half ends on Re over V, a half cadence that asks for more; the second half answers it on Do.',
    melody: `Mi Mi Mi:2 | Mi Mi Mi:2 | Mi Sol Do:1.5 Re:0.5 | Mi:4 /
      Fa Fa Fa:1.5 Fa:0.5 | Fa Mi Mi Mi:0.5 Mi:0.5 | Mi Re Re Mi | Re:2 Sol:2 /
      Mi Mi Mi:2 | Mi Mi Mi:2 | Mi Sol Do:1.5 Re:0.5 | Mi:4 /
      Fa Fa Fa Fa | Fa Mi Mi Mi:0.5 Mi:0.5 | Sol Sol Fa Re | Do:4 /`,
    chords: ['I', 'I', 'I', 'I', 'IV', 'I', 'ii', 'V', 'I', 'I', 'I', 'I', 'IV', 'I', 'V', 'I'],
  },
  {
    id: 'grace', title: 'Amazing Grace', mode: 'major', key: 7, bpm: 90, meter: 3, pickup: 1,
    about: 'A hymn in three-four that starts on the low Sol and spans more than an octave. The low La, and Sol, below Do are where most people lose their way, so sing it slowly.',
    melody: `Sol, | Do:2 Mi:0.5 Do:0.5 | Mi:2 Re | Do:2 La, | Sol,:2 /
      Sol, | Do:2 Mi:0.5 Do:0.5 | Mi:2 Re:0.5 Mi:0.5 | Sol:5 /
      Mi | Sol:2 Mi:0.5 Do:0.5 | Mi:2 Re | Do:2 La, | Sol,:2 /
      Sol, | Do:2 Mi:0.5 Do:0.5 | Mi:2 Re | Do:3 /`,
    chords: ['I', 'I', 'IV', 'I', 'I', 'I', 'V', 'V', 'I', 'I', 'IV', 'I', 'I', 'V', 'I'],
  },
  {
    id: 'greensleeves', title: 'Greensleeves', mode: 'minor', key: 9, bpm: 120, meter: 3, pickup: 1,
    about: 'A minor tune that borrows from melodic minor: on the way up to Do it uses the raised Si (and once La) instead of Te and Le, which gives it its old, bittersweet sound.',
    melody: `Do | Me:2 Fa | Sol:1.5 Le:0.5 Sol | Fa:2 Re | Te,:1.5 Do:0.5 Re |
      Me:2 Do | Do:1.5 Si,:0.5 Do | Re:2 Si, | Sol,:2 /
      Do | Me:2 Fa | Sol:1.5 Le:0.5 Sol | Fa:2 Re | Te,:1.5 Do:0.5 Re |
      Me:1.5 Re:0.5 Do | Si,:1.5 La,:0.5 Si, | Do:3 /`,
    chords: ['i', 'III', 'VII', 'v', 'i', 'V', 'V', 'V', 'i', 'III', 'VII', 'v', 'i', 'V', 'i'],
  },
  {
    id: 'sailor', title: 'Drunken Sailor', mode: 'minor', key: 2, bpm: 120, meter: 4, pickup: 0,
    about: 'A sea shanty built on two chords a step apart, i and VII. Line three climbs with a raised La (the dorian sixth), a bright note in a minor tune.',
    melody: `Sol Sol:0.5 Sol:0.5 Sol Sol:0.5 Sol:0.5 | Sol Do Me Sol /
      Fa Fa:0.5 Fa:0.5 Fa Fa:0.5 Fa:0.5 | Fa Te, Re Fa /
      Sol Sol:0.5 Sol:0.5 Sol Sol:0.5 Sol:0.5 | Sol La Te Do' /
      Te Sol Fa Re | Do:2 Do:2 /`,
    chords: ['i', 'i', 'VII', 'VII', 'i', 'i', 'VII', 'i'],
  },
  {
    id: 'godrest', title: 'God Rest Ye Merry Gentlemen (opening)', mode: 'minor', key: 4, bpm: 110, meter: 4, pickup: 1,
    about: 'Leaps from Do up to Sol, then walks down past Do to Te below and climbs back to Sol. A whole minor scale in one breath, so it is a good test of Me, Le and Te.',
    melody: `Do | Do Sol Sol Fa | Me Re Do Te, | Do Re Me Fa | Sol:3 /
      Do | Do Sol Sol Fa | Me Re Do Te, | Do Re Me Fa | Sol:3 /`,
    chords: ['i', 'i VII', 'i iv', 'V', 'i', 'i VII', 'i iv', 'V'],
  },
];

/**
 * Common progressions. `slots` are numerals (one bar each); `songs` are a few well-known songs that
 * use the progression (or a close variant), so the player can listen for it.
 */
export const PROGRESSIONS = [
  {
    id: 'three', name: 'Three chords', mode: 'major', slots: ['I', 'IV', 'V', 'I'],
    about: 'Home, away, tension, home. Tonic, subdominant and dominant are enough to harmonise most folk songs, hymns and early rock and roll. V pulls hardest back to I because its third is Si, the leading note.',
    songs: ['Twist and Shout', 'La Bamba', 'Twinkle, Twinkle, Little Star'],
  },
  {
    id: 'pop', name: 'Pop progression', mode: 'major', slots: ['I', 'V', 'vi', 'IV'],
    about: 'The most used loop of the last fifty years. It goes from home to the dominant, falls to the minor vi for a moment of shade, and lifts through IV back to the start.',
    songs: ['Let It Be', 'With or Without You', 'No Woman, No Cry'],
  },
  {
    id: 'fifties', name: 'Fifties progression', mode: 'major', slots: ['I', 'vi', 'IV', 'V'],
    about: 'The doo-wop loop. The bass falls a third from I to vi, a third again to IV, then steps up to V, which turns the loop around to I.',
    songs: ['Stand by Me', 'Every Breath You Take', 'Earth Angel'],
  },
  {
    id: 'sad', name: 'Minor-feel pop', mode: 'major', slots: ['vi', 'IV', 'I', 'V'],
    about: 'The pop progression started on vi. The chords are the same, but starting on the minor chord makes it sound like a minor key, until you notice I is still home.',
    songs: ['Zombie', 'Despacito'],
  },
  {
    id: 'two-five', name: 'Two-five-one', mode: 'major', slots: ['ii', 'V', 'I', 'I'],
    about: 'The backbone of jazz. The root moves down a fifth twice (Re to Sol to Do), the strongest way to approach home, and each chord shares two notes with the next.',
    songs: ['Autumn Leaves', 'Honeysuckle Rose', 'Fly Me to the Moon'],
  },
  {
    id: 'vamp', name: 'Two-chord vamp', mode: 'major', slots: ['I', 'IV'],
    about: 'Back and forth between home and the subdominant, with no V to settle it. Gospel, soul and countless jams sit on this rocking motion.',
    songs: ['Born in the U.S.A.', 'Free Fallin\' (close variant)'],
  },
  {
    id: 'andalusian', name: 'Andalusian cadence', mode: 'minor', slots: ['i', 'VII', 'VI', 'V'],
    about: 'The bass walks straight down Do, Te, Le, Sol, and the major V at the end (with the raised Si) pulls back to i. Flamenco, surf rock and a lot of film music are built on it.',
    songs: ['Hit the Road Jack', 'Walk, Don\'t Run', 'Runaway'],
  },
  {
    id: 'epic', name: 'Minor rock loop', mode: 'minor', slots: ['i', 'VI', 'III', 'VII'],
    about: 'Minor home, then three major chords. It is the minor-feel pop loop seen from the relative minor: the same chords, named from La instead of Do.',
    songs: ['Zombie', 'Numb'],
  },
  {
    id: 'minor-cadence', name: 'Minor cadence', mode: 'minor', slots: ['i', 'iv', 'V', 'i'],
    about: 'The minor version of three chords, and the cadence this app plays before minor levels. The borrowed major V gives the leading note Si its pull to Do.',
    songs: ['Sixteen Tons', 'Summertime (close variant)'],
  },
  {
    id: 'blues', name: 'Twelve-bar blues', mode: 'major', slots: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
    about: 'Twelve bars, three chords: four bars of I, two of IV and two of I, then V, IV, I and a turnaround on V. Usually played with seventh chords; plain triads here so you hear the movement.',
    songs: ['Johnny B. Goode', 'Hound Dog', 'Pride and Joy'],
  },
];

export const tuneById = (id) => TUNES.find((t) => t.id === id) || null;
export const progressionById = (id) => PROGRESSIONS.find((p) => p.id === id) || null;

// ---------- parsing ----------

const NOTE_RE = /^(r|Do|Ra|Re|Me|Mi|Fa|Se|Sol|Le|La|Te|Si)([',]*)(?::(\d+(?:\.\d+)?))?$/;

/**
 * Parse a melody string: { notes: [{ o (offset, null for a rest), b (beats), t (start beat) }],
 * phrases: [[first note index, end index)] }. Throws on an unknown token.
 */
export function parseMelody(src) {
  const notes = [];
  const phrases = [];
  let t = 0;
  let start = 0;
  for (const tok of src.split(/\s+/).filter(Boolean)) {
    if (tok === '|') continue;
    if (tok === '/') {
      if (notes.length > start) phrases.push([start, notes.length]);
      start = notes.length;
      continue;
    }
    const m = NOTE_RE.exec(tok);
    if (!m) throw new Error(`bad melody token "${tok}"`);
    const b = m[3] ? Number(m[3]) : 1;
    let o = null;
    if (m[1] !== 'r') {
      o = SEMI_NAMES.indexOf(m[1]);
      for (const c of m[2]) o += c === "'" ? 12 : -12;
    }
    notes.push({ o, b, t });
    t += b;
  }
  if (notes.length > start) phrases.push([start, notes.length]);
  return { notes, phrases };
}

const PARSED = new Map();
const parsed = (tune) => {
  if (!PARSED.has(tune.id)) PARSED.set(tune.id, parseMelody(tune.melody));
  return PARSED.get(tune.id);
};

/** The tune's notes (rests included): [{ o, b, t }]. */
export const tuneNotes = (tune) => parsed(tune).notes;

/** Total length in beats. */
export function tuneBeats(tune) {
  const ns = tuneNotes(tune);
  const last = ns[ns.length - 1];
  return last.t + last.b;
}

/** The phrases as arrays of { o, b, t } without rests. */
export const tunePhrases = (tune) => parsed(tune).phrases.map(([a, z]) => tuneNotes(tune).slice(a, z).filter((n) => n.o != null));

/** Chord changes: [{ numeral, t (beat), b (beats) }], from the per-bar `chords` after the pickup. */
export function tuneChords(tune) {
  const out = [];
  tune.chords.forEach((bar, i) => {
    const parts = bar.split(/\s+/);
    const len = tune.meter / parts.length;
    parts.forEach((numeral, j) => out.push({ numeral, t: tune.pickup + i * tune.meter + j * len, b: len }));
  });
  return out;
}

/** [lowest, highest] offset of the tune. */
export function tuneRange(tune) {
  const os = tuneNotes(tune).filter((n) => n.o != null).map((n) => n.o);
  return [Math.min(...os), Math.max(...os)];
}

/**
 * MIDI of Do for the tune in a key: the octave that keeps the whole melody inside the samples,
 * as high as possible so it sits above the chords. Null if no octave fits.
 */
export const tuneTonic = (tune, keyPc) => fitTonic(keyPc, ...tuneRange(tune));

/** MIDI of Do in key `keyPc` for notes spanning offsets lo…hi (see tuneTonic). */
export function fitTonic(keyPc, lo, hi) {
  let best = null;
  for (let tonic = MIN_MIDI + mod12(keyPc - MIN_MIDI); tonic + hi <= MAX_MIDI; tonic += 12) {
    if (tonic + lo >= MIN_MIDI) best = tonic;
  }
  return best;
}

/** A note's solfège with octave marks below Do as well as above: "Sol,", "Do'", "Mi". */
export function degName(offset) {
  const oct = Math.floor(offset / 12);
  return SEMI_NAMES[mod12(offset)] + (oct > 0 ? "'".repeat(oct) : ','.repeat(-oct));
}
export const degColor = (offset) => noteColor(offset < 0 ? mod12(offset) : offset);
