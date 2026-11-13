// The course: units, lessons and the teaching cards shown before each lesson.
//
// Lesson kinds
//   notes       introduces new notes (staff <-> name <-> fretboard)
//   mix         shuffles everything learned so far in this part of the neck
//   rhythm      note values: questions, listening and tapping
//   melody      short generated tunes with real rhythms
//   song        a real tune, phrase by phrase
//   accidentals the bar-line rule and naturals
//   keysig      reading under a key signature
//   checkpoint  a longer test of a whole section
//
// Positions are written "string:fret" (1 = thinnest string); "4:4#" / "3:3b"
// pick the spelling of a black-key note.

import { parsePosList, keyAlterations, describePos, describeStep } from './theory.js';
import { SONGS } from './songs.js';

const G = 'G4'; // rhythm exercises are written on the open 3rd string

const UNIT_DATA = [
  // -------------------------------------------------------------------------
  {
    id: 'u1', title: 'First String', blurb: 'E, F and G on the thinnest string', tone: 'teal', zone: 'open',
    lessons: [
      {
        kind: 'notes', title: 'E and F', learn: '1:0 1:1', basics: true,
        intro: [
          { title: 'The staff', text: 'Music is written on five lines called the staff. The curly sign at the front is the treble clef — guitar music always uses it. The higher a note sits, the higher it sounds.', staff: { melody: 'F4:w A4:w C5:w E5:w' } },
          { title: 'Your fretboard', text: 'This diagram shows the neck like tablature does: string 1, the thinnest, is at the top and the nut is on the left. “Open” means you pluck the string without pressing a fret.', fretboard: { marks: [['1:0', '']] } },
        ],
      },
      { kind: 'notes', title: 'Meet G', learn: '1:3' },
      {
        kind: 'rhythm', title: 'Count to four',
        rhythm: { timeSig: [4, 4], bpm: 72, cells: { q: 3, h: 2, w: 0.5 }, counts: 'beats' },
        mcq: [['beats', 'q'], ['beats', 'h'], ['beats', 'w'], ['which', 'h', ['q', 'h', 'w']], ['name', 'w', ['q', 'h', 'w']], ['fill', ['q', 'h']]],
        intro: [
          { title: 'The beat', text: 'Music has a steady pulse — the beat. The two numbers after the clef are the time signature: the top one tells you how many beats are in each measure. Here that is four.', staff: { melody: `${G}:q ${G}:q ${G}:q ${G}:q | ${G}:q ${G}:q ${G}:q ${G}:q`, timeSig: [4, 4], counts: 'beats' } },
          { title: 'How long notes last', text: 'The shape of a note tells you how many beats it lasts.', symbols: [['q', 'Quarter note', '1 beat'], ['h', 'Half note', '2 beats'], ['w', 'Whole note', '4 beats']] },
          { title: 'Tapping rhythms', text: 'After the count-in, tap the pad exactly when each note starts. For long notes, tap once and wait — do not tap again until the next note.' },
        ],
      },
      { kind: 'melody', title: 'First melodies', melody: { timeSig: [4, 4], bpm: 76, cells: { q: 3, h: 2, w: 0.3 } } },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'u2', title: 'Second String', blurb: 'B, C and D — and your first songs', tone: 'violet', zone: 'open',
    lessons: [
      { kind: 'notes', title: 'B and C', learn: '2:0 2:1' },
      { kind: 'notes', title: 'Meet D', learn: '2:3' },
      { kind: 'song', title: 'Mary Had a Little Lamb', song: 'mary-lamb' },
      {
        kind: 'rhythm', title: 'Rests',
        rhythm: { timeSig: [4, 4], bpm: 72, cells: { q: 3, h: 1.5, qr: 2.5, hr: 1 }, must: ['qr', 'hr'], counts: 'beats' },
        mcq: [['name', 'rq', ['rq', 'rh', 'q']], ['beats', 'rh'], ['which', 'rw', ['rw', 'rh', 'rq']], ['restFor', 'q'], ['restFor', 'h'], ['fill', ['rq', 'h']]],
        intro: [
          { title: 'Silence counts too', text: 'A rest tells you to stay silent for a number of beats. Keep counting through it!', symbols: [['rq', 'Quarter rest', '1 beat'], ['rh', 'Half rest', '2 beats — sits on the line'], ['rw', 'Whole rest', 'a whole measure — hangs from the line']] },
          { title: 'Tapping with rests', text: 'When you reach a rest, simply do not tap. The playhead keeps moving, and so does your counting.' },
        ],
      },
      { kind: 'mix', title: 'Two strings together', melody: { timeSig: [4, 4], bpm: 80, cells: { q: 3, h: 2, qr: 1 } } },
      { kind: 'song', title: 'Jingle Bells', song: 'jingle-bells' },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'u3', title: 'Third String', blurb: 'G and A, plus eighth notes', tone: 'coral', zone: 'open',
    lessons: [
      { kind: 'notes', title: 'G and A', learn: '3:0 3:2', tip: 'This G is lower than the G on string 1 — same letter, eight notes apart.' },
      {
        kind: 'rhythm', title: 'Eighth notes',
        rhythm: { timeSig: [4, 4], bpm: 66, cells: { q: 3, h: 1, ee: 3.5, qr: 0.8 }, must: ['ee'], counts: 'eighths' },
        mcq: [['beats', 'e'], ['name', 'e', ['q', 'e', 'h']], ['which', 'ee', ['ee', 'q', 'h']], ['howMany', 'e', 'q'], ['howMany', 'e', 'h'], ['fill', ['q', 'ee']]],
        intro: [
          { title: 'Half a beat', text: 'An eighth note lasts half a beat, so two of them fit into one beat. Pairs are usually joined by a beam.', symbols: [['e', 'Eighth note', '½ beat'], ['ee', 'Two eighths', '1 beat together']] },
          { title: 'Count the “ands”', text: 'Say “1 and 2 and 3 and 4 and”. Notes on the numbers fall on the beat; the “ands” fall exactly in between.', staff: { melody: `${G}:q ${G}:e ${G}:e ${G}:q ${G}:e ${G}:e`, timeSig: [4, 4], counts: 'eighths' } },
        ],
      },
      { kind: 'song', title: 'Hot Cross Buns', song: 'hot-cross-buns' },
      { kind: 'mix', title: 'Three strings', melody: { timeSig: [4, 4], bpm: 80, cells: { q: 3, h: 1.5, ee: 2 } } },
      { kind: 'song', title: 'Aura Lee', song: 'aura-lee' },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'u4', title: 'Fourth String', blurb: 'D, E and F — down to the bottom of the staff', tone: 'blue', zone: 'open',
    lessons: [
      { kind: 'notes', title: 'D and E', learn: '4:0 4:2', tip: 'The open 4th string is a D that hangs just below the bottom line.' },
      { kind: 'notes', title: 'Meet F', learn: '4:3' },
      {
        kind: 'rhythm', title: 'Three-four time',
        rhythm: { timeSig: [3, 4], bpm: 80, cells: { q: 3, h: 2, 'h.': 1.5, ee: 1.2, qr: 0.6 }, must: ['h.'], counts: 'beats' },
        mcq: [['beats', 'h.'], ['text', { prompt: 'A dot after a note adds…', choices: ['half of its value', 'one extra beat, always', 'nothing — it is decoration'], answer: 0 }], ['timeTop', [3, 4]], ['timeTop', [4, 4]], ['fill', ['q', 'h'], [3, 4]], ['which', 'h.', ['h', 'h.', 'q.']]],
        intro: [
          { title: 'Three beats in a bar', text: 'When the top number is 3, every measure has three beats: count “1 2 3, 1 2 3”. Waltzes move like this.', staff: { melody: `${G}:q ${G}:q ${G}:q | ${G}:h ${G}:q | ${G}:h.`, timeSig: [3, 4], counts: 'beats' } },
          { title: 'The dot', text: 'A dot after a note adds half of its value. A half note is 2 beats, so a dotted half note is 2 + 1 = 3 beats — a whole measure of three-four.', symbols: [['h', 'Half note', '2 beats'], ['h.', 'Dotted half note', '3 beats']] },
        ],
      },
      { kind: 'song', title: 'Frère Jacques', song: 'frere-jacques' },
      { kind: 'mix', title: 'Four strings', melody: { timeSig: [3, 4], bpm: 84, cells: { q: 3, h: 2, 'h.': 1, ee: 1.5 } } },
      { kind: 'song', title: 'Amazing Grace', song: 'amazing-grace' },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'u5', title: 'Fifth String', blurb: 'A, B and C on ledger lines', tone: 'amber', zone: 'open',
    lessons: [
      {
        kind: 'notes', title: 'Middle C and B', learn: '5:3 5:2',
        intro: [{ title: 'Ledger lines', text: 'Notes that are too low for the staff get short lines of their own, called ledger lines. Read them like extra staff lines that only appear when needed.', staff: { melody: 'E4:w D4:w C4:w B3:w A3:w', labels: true } }],
      },
      { kind: 'notes', title: 'Low A', learn: '5:0' },
      { kind: 'song', title: 'Twinkle, Twinkle', song: 'twinkle' },
      {
        kind: 'rhythm', title: 'Dotted quarter notes',
        rhythm: { timeSig: [4, 4], bpm: 66, cells: { q: 3, h: 1.5, ee: 1.5, 'q.e': 3.5 }, must: ['q.e'], counts: 'eighths' },
        mcq: [['beats', 'q.'], ['text', { prompt: 'A dotted quarter note is usually followed by…', choices: ['an eighth note', 'a whole note', 'a bar line'], answer: 0 }], ['which', 'q.', ['q', 'q.', 'h.']], ['fill', ['e', 'q'], [4, 4], `${G}:q ${G}:q ${G}:q.`], ['howMany', 'e', 'q.']],
        intro: [
          { title: 'One and a half beats', text: 'A dot adds half of a note’s value, so a dotted quarter lasts 1½ beats. The eighth note after it completes the second beat.', symbols: [['q.', 'Dotted quarter', '1½ beats'], ['e', 'Eighth note', '½ beat']] },
          { title: 'How to count it', text: 'Tap on “1”, hold through “and 2”, then tap the short note on the “and” of 2.', staff: { melody: `${G}:q. ${G}:e ${G}:q ${G}:q`, timeSig: [4, 4], counts: 'eighths' } },
        ],
      },
      { kind: 'mix', title: 'Five strings', melody: { timeSig: [4, 4], bpm: 80, cells: { q: 3, h: 1.5, ee: 1.5, 'q.e': 1.5 } } },
      { kind: 'song', title: 'Ode to Joy', song: 'ode-to-joy' },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'u6', title: 'Sixth String', blurb: 'The lowest notes: E, F and G', tone: 'green', zone: 'open',
    lessons: [
      { kind: 'notes', title: 'Low G and F', learn: '6:3 6:1' },
      { kind: 'notes', title: 'Low E', learn: '6:0', tip: 'The open 6th string is the lowest note a guitar can play.' },
      {
        kind: 'rhythm', title: 'Ties',
        rhythm: {
          timeSig: [4, 4], bpm: 72, counts: 'beats',
          patterns: ['q q h~ | h q q', 'h q q~ | q q h', 'q q q q~ | q h q', 'q h q~ | q q h', 'h. q~ | q q h', 'q q~ q q | h h', 'h~ q q | w', 'q h~ q | h h', 'h h~ | h q q', 'q q h~ | q q h'],
        },
        mcq: [['tie', 'h', 'q'], ['tie', 'q', 'q'], ['tie', 'h', 'h'], ['tie', 'w', 'q'], ['text', { prompt: 'Two notes of the same pitch are joined by a tie. What do you do?', choices: ['Play once and hold for both', 'Play both notes', 'Skip the second note’s time'], answer: 0 }]],
        intro: [
          { title: 'Tied notes', text: 'A tie is a curved line joining two notes of the same pitch. Play the first note and keep it ringing through the second — their lengths add up. Ties let a note last across a bar line.', staff: { melody: `${G}:q ${G}:q ${G}:h~ | ${G}:h ${G}:q ${G}:q`, timeSig: [4, 4], counts: 'beats' } },
        ],
      },
      { kind: 'song', title: 'When the Saints', song: 'saints' },
      { kind: 'song', title: 'Sixth String Stomp', song: 'stomp' },
      { kind: 'mix', title: 'All six strings', melody: { timeSig: [4, 4], bpm: 84, cells: { q: 3, h: 1.5, ee: 2, 'q.e': 1, qr: 0.6 } } },
      { kind: 'checkpoint', title: 'Open-position checkpoint' },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'u7', title: 'Sharps & Flats', blurb: 'The notes between the notes', tone: 'pink', zone: 'open', explicitAccidentals: true,
    lessons: [
      {
        kind: 'notes', title: 'F sharp', learn: '1:2# 4:4# 6:2#',
        intro: [{ title: 'Sharps', text: 'A sharp sign (♯) in front of a note raises it by one fret. F is on the 1st fret of string 1, so F♯ is one fret higher: the 2nd fret.', staff: { melody: 'F5:w F#5:w', labels: true }, fretboard: { marks: [['1:1', 'F'], ['1:2#', 'F♯']] } }],
      },
      { kind: 'notes', title: 'C sharp and G sharp', learn: '2:2# 5:4# 3:1# 6:4# 1:4#' },
      {
        kind: 'notes', title: 'Flats', learn: '3:3b 5:1b 2:4b 4:1b',
        intro: [{ title: 'Flats', text: 'A flat sign (♭) lowers a note by one fret. B is an open string, and there is no fret below open — so B♭ is found on the next string down: 3rd string, 3rd fret.', staff: { melody: 'B4:w Bb4:w', labels: true }, fretboard: { marks: [['2:0', 'B'], ['3:3b', 'B♭']] } }],
      },
      {
        kind: 'accidentals', title: 'Naturals and the bar line', explicitAccidentals: false,
        intro: [
          { title: 'It lasts for the measure', text: 'A sharp or flat stays in force until the next bar line: every later note on that same line or space is affected too, even without a sign of its own.', staff: { melody: 'F#5:q G5:q F#5:q E5:q | F5:q G5:q F5:h', timeSig: [4, 4], labels: true } },
          { title: 'The natural sign', text: 'A natural sign (♮) cancels a sharp or flat for the rest of the measure.', staff: { melody: 'F#5:q E5:q F5:q E5:q', timeSig: [4, 4], labels: true }, symbols: [['sharp', 'Sharp', 'one fret higher'], ['flat', 'Flat', 'one fret lower'], ['natural', 'Natural', 'back to normal']] },
        ],
      },
      { kind: 'song', title: 'Hall of the Mountain King', song: 'mountain-king' },
      { kind: 'song', title: 'Für Elise', song: 'fur-elise' },
      { kind: 'song', title: 'Greensleeves', song: 'greensleeves' },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'u8', title: 'Key Signatures', blurb: 'Sharps and flats that stay switched on', tone: 'indigo', zone: 'open',
    lessons: [
      {
        kind: 'keysig', title: 'G major: one sharp', keySig: 1,
        intro: [{ title: 'Key signatures', text: 'Sharps or flats placed right after the clef are a key signature. They apply to every note with that letter — in every octave — for the whole piece. One sharp on the F line means every F is played F♯.', staff: { melody: 'G4:q A4:q B4:q C5:q | D5:q E5:q F#5:q G5:q', keySig: 1, timeSig: [4, 4], labels: true } }],
      },
      { kind: 'song', title: 'Drunken Sailor', song: 'drunken-sailor' },
      {
        kind: 'keysig', title: 'D major: two sharps', keySig: 2,
        intro: [{ title: 'Two sharps', text: 'Sharps always arrive in the same order: F♯ first, then C♯. With two sharps, every F and every C is raised by one fret.', staff: { melody: 'D4:q E4:q F#4:q G4:q | A4:q B4:q C#5:q D5:q', keySig: 2, timeSig: [4, 4], labels: true } }],
      },
      { kind: 'song', title: 'Joy to the World', song: 'joy-to-the-world' },
      {
        kind: 'keysig', title: 'F major: one flat', keySig: -1,
        intro: [{ title: 'One flat', text: 'The first flat is always B♭. With this key signature every B is played one fret lower.', staff: { melody: 'F4:q G4:q A4:q Bb4:q | C5:q D5:q E5:q F5:q', keySig: -1, timeSig: [4, 4], labels: true } }],
      },
      { kind: 'song', title: 'Twinkle in F', song: 'twinkle-f' },
      { kind: 'song', title: 'Minuet in G', song: 'minuet-in-g' },
      { kind: 'checkpoint', title: 'Sharps, flats and keys' },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'u9', title: 'Fifth Position', blurb: 'Move up the neck: frets 5 to 8', tone: 'orange', zone: 'fifth', frets: [4, 9],
    lessons: [
      {
        kind: 'notes', title: 'High A, B and C', learn: '1:5 1:7 1:8',
        intro: [
          { title: 'Up the neck', text: 'Slide your hand up so your first finger sits at the 5th fret — that is fifth position. The dots on the fingerboard at frets 5, 7 and 9 help you find your way.', fretboard: { marks: [['1:5', 'A'], ['1:7', 'B'], ['1:8', 'C']] } },
          { title: 'Ledger lines above', text: 'Notes higher than the staff use ledger lines too, this time on top.', staff: { melody: 'G5:w A5:w B5:w C6:w', labels: true } },
        ],
      },
      {
        kind: 'notes', title: 'Old notes, new places', learn: '2:5 2:6 2:8 3:5 3:7',
        intro: [{ title: 'Same notes, new strings', text: 'E, F and G on the 2nd string here are exactly the E, F and G you learned on string 1 — same sound, same place on the staff, different spot on the neck.', fretboard: { marks: [['2:5', 'E'], ['2:6', 'F'], ['2:8', 'G'], ['3:5', 'C'], ['3:7', 'D']] } }],
      },
      { kind: 'notes', title: 'Fourth string: G, A, B', learn: '4:5 4:7 4:9', tip: 'B needs a little stretch of the fourth finger to the 9th fret.' },
      { kind: 'notes', title: 'The low strings', learn: '5:5 5:7 5:8 6:5 6:7 6:8' },
      {
        kind: 'rhythm', title: 'Sixteenth notes',
        rhythm: { timeSig: [4, 4], bpm: 56, cells: { q: 2.5, h: 0.8, ee: 2, ssss: 3, ess: 1.5, sse: 1.5 }, must: ['ssss', 'ess', 'sse'], counts: 'eighths' },
        mcq: [['beats', 's'], ['name', 's', ['e', 's', 'q']], ['howMany', 's', 'q'], ['howMany', 's', 'e'], ['which', 's', ['e', 's', 'q']]],
        intro: [
          { title: 'Four to a beat', text: 'A sixteenth note lasts a quarter of a beat: four of them fit in one beat. They have two beams (or two flags).', symbols: [['s', 'Sixteenth note', '¼ beat'], ['e', 'Eighth note', '½ beat']] },
          { title: 'Counting sixteenths', text: 'Count “1 e and a, 2 e and a”. Keep your taps perfectly even — the tempo is slow on purpose.', staff: { melody: `${G}:s ${G}:s ${G}:s ${G}:s ${G}:q ${G}:e ${G}:s ${G}:s ${G}:q`, timeSig: [4, 4], counts: 'eighths' } },
        ],
      },
      { kind: 'mix', title: 'Fifth-position workout', melody: { timeSig: [4, 4], bpm: 80, cells: { q: 3, h: 1.5, ee: 2 } } },
      { kind: 'song', title: 'Frère Jacques up high', song: 'frere-jacques-v' },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'u10', title: 'The Whole Neck', blurb: 'To the 12th fret and beyond the staff', tone: 'slate', zone: 'neck', frets: [0, 12],
    lessons: [
      {
        kind: 'notes', title: 'To the twelfth fret', learn: '1:10 1:12', review: '1:0 1:1 1:3 1:5 1:7 1:8',
        intro: [{ title: 'One string, one octave', text: 'Walk up the first string and the natural notes fall on frets 0, 1, 3, 5, 7, 8, 10 and 12: E F G A B C D E. The 12th fret is the same note as the open string, one octave higher.', staff: { melody: 'E5:w F5:w G5:w A5:w B5:w C6:w D6:w E6:w', labels: true } }],
      },
      {
        kind: 'notes', title: 'Twelfth-fret landmarks', learn: '2:12 3:12 4:12 5:12 6:12',
        intro: [{ title: 'The octave fret', text: 'At the 12th fret — marked with two dots — every string plays the same note as its open string, one octave up: E, B, G, D, A, E.', fretboard: { marks: [['1:12', 'E'], ['2:12', 'B'], ['3:12', 'G'], ['4:12', 'D'], ['5:12', 'A'], ['6:12', 'E']] } }],
      },
      { kind: 'notes', title: 'Seventh position', learn: '2:8 2:10 3:7 3:9' },
      {
        kind: 'rhythm', title: 'Syncopation',
        rhythm: { timeSig: [4, 4], bpm: 66, cells: { q: 2.5, h: 1, ee: 2, syn: 3.5, 'q.e': 1.5 }, must: ['syn'], counts: 'eighths' },
        mcq: [['text', { prompt: 'In a syncopated rhythm, important notes land…', choices: ['between the beats', 'only on beat 1', 'on rests'], answer: 0 }], ['beats', 'q.'], ['howMany', 'e', 'h'], ['fill', ['e', 'q'], [4, 4], `${G}:e ${G}:q ${G}:e ${G}:q ${G}:e`]],
        intro: [{ title: 'Off the beat', text: 'Syncopation puts long notes on the “ands”, between the beats. In this pattern the middle note starts on the “and” of 1 and holds across beat 2.', staff: { melody: `${G}:e ${G}:q ${G}:e ${G}:q ${G}:q`, timeSig: [4, 4], counts: 'eighths' } }],
      },
      {
        kind: 'notes', title: 'Sharps on string one', learn: '1:2# 1:11#',
        intro: [{ title: 'Two sharps for Romanza', text: 'The next song is in E minor, whose key signature has one sharp: F♯, on the 2nd fret. It also borrows a D♯ — the 11th fret, one fret below the high E.', staff: { melody: 'E5:w F#5:w D#6:w E6:w', labels: true, explicit: true } }],
      },
      { kind: 'song', title: 'Romanza', song: 'romanza' },
      { kind: 'checkpoint', title: 'Final checkpoint' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------
const XP = { notes: 10, mix: 10, rhythm: 10, melody: 10, accidentals: 10, keysig: 10, song: 15, checkpoint: 20 };
const ICON = {
  notes: 'music-note', mix: 'guitar', rhythm: 'metronome', melody: 'music-notes', accidentals: 'lightbulb', keysig: 'hash',
  song: 'star', checkpoint: 'flag-checkered',
};

function build() {
  const known = {}; // zone -> notes learned so far (in order)
  const lessons = [];
  const units = UNIT_DATA.map((u, ui) => {
    const frets = u.frets ?? [0, 4];
    known[u.zone] ??= [];
    const unit = { id: u.id, index: ui, title: u.title, blurb: u.blurb, tone: u.tone, zone: u.zone, frets, lessons: [] };
    const unitNew = [];
    u.lessons.forEach((l, li) => {
      const zoneKnown = known[u.zone];
      if (l.review) for (const n of parsePosList(l.review)) if (!zoneKnown.some((k) => k.key === n.key)) zoneKnown.push(n);
      const learn = l.learn ? parsePosList(l.learn) : [];
      const before = zoneKnown.slice();
      let pool = [...before, ...learn.filter((n) => !before.some((k) => k.key === n.key))];
      const keySig = l.keySig ?? (l.song ? SONGS[l.song].keySig : 0);
      if (l.kind === 'keysig') {
        const alt = keyAlterations(keySig);
        pool = pool.filter((n) => (alt[n.pitch.letter] || 0) === n.pitch.alter);
      }
      const lesson = {
        id: `${u.id}-${li + 1}`, index: lessons.length, unit, number: li + 1,
        kind: l.kind, title: l.title, icon: ICON[l.kind], xp: XP[l.kind],
        learn, pool, fresh: unitNew.map((n) => n.key), // notes introduced earlier in this unit
        frets, // the part of the neck shown on screen (a song may use a narrower window to place its notes)
        keySig,
        explicitAccidentals: l.explicitAccidentals ?? Boolean(u.explicitAccidentals),
        basics: Boolean(l.basics), tip: l.tip ?? null,
        rhythm: l.rhythm ?? null, mcq: l.mcq ?? null, melody: l.melody ?? null,
        song: l.song ? SONGS[l.song] : null,
        intro: l.intro ?? [],
      };
      if (lesson.kind === 'song' && !lesson.song) throw new Error(`lesson ${lesson.id}: unknown song`);
      lesson.blurb = describeLesson(lesson);
      for (const n of learn) { if (!zoneKnown.some((k) => k.key === n.key)) zoneKnown.push(n); unitNew.push(n); }
      unit.lessons.push(lesson);
      lessons.push(lesson);
    });
    return unit;
  });
  return { units, lessons };
}

function describeLesson(l) {
  switch (l.kind) {
    case 'notes': return `New: ${l.learn.map((n) => n.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`;
    case 'mix': return 'Mix up everything so far';
    case 'rhythm': return 'Read and tap rhythms';
    case 'melody': return 'Read short tunes in rhythm';
    case 'song': return l.song.credit;
    case 'accidentals': return 'How long a sharp or flat lasts';
    case 'keysig': return `Read in a new key`;
    case 'checkpoint': return 'Prove what you know';
    default: return '';
  }
}

const built = build();
export const UNITS = built.units;
export const LESSONS = built.lessons;
export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;

/** the teaching card that introduces one note */
export function noteCard(n, tip) {
  const place = describePos(n);
  return {
    title: `${n.name} — ${place}`,
    text: `${n.f === 0 ? `Pluck the ${place.replace('open ', '')} without pressing a fret` : `Press the ${place.replace(', ', ' just behind the ')}`}. On the staff, this ${n.name} sits ${describeStep(n.step)}.${tip ? ' ' + tip : ''}`,
    note: n,
  };
}

/** all notes a player has met, given the set of finished lesson ids */
export function learnedNotes(done) {
  const out = [];
  for (const l of LESSONS) {
    if (!done.has(l.id)) continue;
    for (const n of l.learn) if (!out.some((k) => k.key === n.key)) out.push({ ...n, zone: l.unit.zone, frets: l.unit.frets });
  }
  return out;
}
