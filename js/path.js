// The progression path: a suggested order through the app, in stages. Each stage is a few levels
// followed by a guide that shows how to use the new notes on the guitar, usually over a backing loop.
//
// Steps: { kind: 'level', id (a level id from data.js) } or { kind: 'guide', id, title, intro, tries[],
// loop? ({ key, mode, slots, tempo, bars }, see harmony.js normalizeBacking) }.
// A level step is done once passed (PASS_SCORE); a guide once the player marks it done.
// Pure data and functions only.

import { CHAPTERS, PASS_SCORE, levelsFor } from './data.js';

const L = (id) => ({ kind: 'level', id });
const G = (spec) => ({ kind: 'guide', ...spec });

export const STAGES = [
  {
    name: 'First notes',
    desc: 'Do to Fa on one string, then use them over a two-chord loop.',
    steps: [
      L('one-0'), L('one-1'), L('one-2'),
      G({
        id: 'g-first', title: 'Do, Re, Mi, Fa over a loop',
        intro: 'You can tell the first four notes apart. Now hear how they sit over chords: the same note feels different as the harmony moves under it.',
        tries: [
          'Find Do on the B string, 1st fret (C). Play it at the start of every chord. Over I it feels like home; over IV it feels like it wants to move.',
          'Hold Mi through both chords. Over I it is the bright third of the chord; over IV it becomes a soft, dreamy major seventh.',
          'Play Fa over the I chord and let it fall to Mi. That half step is one of the strongest pulls in the scale.',
          'Make up three-note melodies with Do, Re, Mi and Fa. End each one on Do or Mi and hear it settle.',
          'Sing each note before you play it. If the guitar surprises you, stop and sing it again.',
        ],
        loop: { key: 0, mode: 'major', slots: ['I', 'IV'], tempo: 70, bars: 2 },
      }),
    ],
  },
  {
    name: 'The whole octave',
    desc: 'Sol to Do\', then melodies over common progressions.',
    steps: [
      L('one-3'), L('one-4'),
      G({
        id: 'g-five', title: 'Melodies over I – V',
        intro: 'With Sol and La you have the notes of both main chords. Aim for chord notes as the harmony changes and your lines will sound intentional.',
        tries: [
          'Over I, land on Do, Mi or Sol (the notes of the C chord). Over V, land on Re or Sol (from the G chord).',
          'Sol is in both chords. Play it all the way through and hear it stay put while the harmony changes under it.',
          'Call and response: play a short phrase that ends on Re over V, then answer it with one that ends on Do over I.',
          'Hum a phrase over the loop first, then find it on the string. Hearing it before playing it is the whole point.',
        ],
        loop: { key: 0, mode: 'major', slots: ['I', 'V'], tempo: 80, bars: 1 },
      }),
      L('one-5'), L('one-6'), L('one-major-2nd'),
      G({
        id: 'g-octave', title: 'The full scale over I – vi – IV – V',
        intro: 'You know all seven notes. Use them to follow a full progression, and start working out melodies you already know.',
        tries: [
          'Si leans hard into Do. Play Si over V and resolve it to Do as the loop comes back to I.',
          'Play the root of each chord as it arrives: Do (I), La (vi), Fa (IV), Sol (V).',
          'Now play the third of each chord instead: Mi, Do, La, Si. Thirds sound more melodic than roots.',
          'Work out a tune you know by singing it in solfège first. Happy Birthday starts Sol Sol La Sol Do\' Si.',
        ],
        loop: { key: 0, mode: 'major', slots: ['I', 'vi', 'IV', 'V'], tempo: 80, bars: 1 },
      }),
    ],
  },
  {
    name: 'Across the neck',
    desc: 'The same octave in three box patterns.',
    steps: [
      L('pA-6'), L('pB-6'), L('pC-6'),
      G({
        id: 'g-patterns', title: 'One melody, three patterns',
        intro: 'The patterns change the shapes under your fingers but not the names. Moving between them is how the whole neck becomes one place.',
        tries: [
          'Play the scale up and down in Pattern I, one note per beat, and keep going when the chord changes.',
          'Do the same in Pattern II, then switch pattern each time the loop starts again. Say the note names out loud as you go.',
          'Over ii land on Re, over V on Si, over I on Do. Find that line in each pattern.',
          'Play your tune from the last guide in each pattern. Start by finding Do, then let your ear lead.',
        ],
        loop: { key: 0, mode: 'major', slots: ['ii', 'V', 'I'], tempo: 80, bars: 1 },
      }),
    ],
  },
  {
    name: 'Intervals and phrases',
    desc: 'Two notes, then short melodies, then singing them first.',
    steps: [
      L('one-pairs-1st'), L('one-pairs-oct'), L('one-dict-2'), L('one-dict-3'),
      G({
        id: 'g-phrases', title: 'Take dictation from real music',
        intro: 'Melodies are made of the moves you just practised. Hearing them in songs and on the loop is the next step.',
        tries: [
          'Play a two-note phrase over the loop, then echo it in another pattern or an octave higher.',
          'Pick a song you know well. Its last note is usually Do: hum it, find it, then work out the first three notes of the song from there.',
          'Write three short phrases in solfège (say Mi Re Do, Sol La Sol, Do Mi Sol). Play each over the loop and notice which chords they fit.',
        ],
        loop: { key: 0, mode: 'major', slots: ['I', 'vi', 'IV', 'V'], tempo: 70, bars: 2 },
      }),
      L('one-sing-1'), L('one-sing-oct'), L('one-sing-p3'),
      G({
        id: 'g-sing', title: 'Sing it, then play it',
        intro: 'This is the goal of the method: play what you hear in your head. Your voice is the bridge from the idea to the fretboard.',
        tries: [
          'Sing a short phrase over the loop without the guitar. Then find it on the neck.',
          'Start with two notes. Add a note when it feels easy, up to four or five.',
          'Lost a note? Sing from it down (or up) to Do and count the steps.',
          'Improvise by singing and playing at the same time, the guitar doubling your voice.',
        ],
        loop: { key: 0, mode: 'major', slots: ['I', 'IV'], tempo: 70, bars: 2 },
      }),
    ],
  },
  {
    name: 'Minor',
    desc: 'The minor scale and its darker colours.',
    steps: [
      L('one-minor-oct'), L('one-pairs-minor'), L('one-dict-minor'),
      G({
        id: 'g-minor', title: 'Minor colours over i – VII – VI – V',
        intro: 'Same Do, different scale. Three notes (Me, Le and Te) carry most of the minor sound.',
        tries: [
          'Hold Me over i. That minor third is what makes the chord sound sad.',
          'Over VI, play Le and let it fall to Sol when V arrives. That half-step sigh is pure minor.',
          'Over V (a major chord here), play Si, the raised seventh, and resolve it to Do on i.',
          'Play one of your major phrases in minor: same steps, but with Me, Le and Te.',
        ],
        loop: { key: 0, mode: 'minor', slots: ['i', 'VII', 'VI', 'V'], tempo: 80, bars: 1 },
      }),
    ],
  },
  {
    name: 'Any key',
    desc: 'Find Do wherever it is, then everything else follows.',
    steps: [
      L('one-rk-major'), L('one-rk-minor'), L('one-pairs-rk'), L('one-dict-rk'),
      G({
        id: 'g-keys', title: 'Move your melodies to new keys',
        intro: 'Solfège names are relative to Do, so a tune you know in C is the same tune in any key. Find Do and the rest comes along.',
        tries: [
          'This loop is in G. Before playing anything, find Do by humming the first chord\'s root and matching it on the neck.',
          'Play your tune in G, then change the key in the backing track (D, A, E) and play it again.',
          'Change key without looking at the chord names. Find Do by ear first, then check.',
        ],
        loop: { key: 7, mode: 'major', slots: ['I', 'vi', 'IV', 'V'], tempo: 90, bars: 1 },
      }),
    ],
  },
  {
    name: 'Chromatic colour',
    desc: 'The notes between the notes.',
    steps: [
      L('one-majorChrom-oct'), L('one-minorChrom-oct'),
      G({
        id: 'g-chrom', title: 'Blue notes and approach notes',
        intro: 'Chromatic notes add tension. They sound good when they lead somewhere, usually by a half step.',
        tries: [
          'Over I, play Me and slide it up to Mi. That is the blues in two notes.',
          'Play Te over I and let it fall to La. It gives a rock and folk colour.',
          'Before each chord arrives, play the note one fret below its root, then the root.',
        ],
        loop: { key: 0, mode: 'major', slots: ['I', 'IV'], tempo: 80, bars: 2 },
      }),
    ],
  },
  {
    name: 'The whole neck',
    desc: 'Any octave, any position, any key.',
    steps: [
      L('neck-major-oct'), L('neck-major-2oct'), L('neck-rk-all'), L('neck-dict-5'),
      G({
        id: 'g-free', title: 'Play what you hear',
        intro: 'You can hear a note in any key and find it anywhere. From here it is practice: keep the daily session going and play music.',
        tries: [
          'Build your own loops on the Backing track screen and improvise over them, singing first.',
          'Learn one new tune a week by ear, then play it in two keys and two positions.',
          'Use Practise every day: it picks warm-ups, weak notes and phrases from your stats.',
        ],
        loop: { key: 9, mode: 'minor', slots: ['i', 'VI', 'III', 'VII'], tempo: 90, bars: 1 },
      }),
    ],
  },
];

/** Every step in order, each with its position: { ...step, stage (index), n (index in STEPS) }. */
export const STEPS = STAGES.flatMap((s, stage) => s.steps.map((step) => ({ ...step, stage }))).map((s, n) => ({ ...s, n }));

const LEVELS = new Map(CHAPTERS.flatMap((c) => levelsFor(c.id)).map((l) => [l.id, l]));
/** The level spec of a level step (null for a guide). */
export const levelOf = (step) => (step.kind === 'level' ? LEVELS.get(step.id) ?? null : null);

/** Done: a level passed, or a guide marked done. `guides` is an array or Set of guide ids. */
export function stepDone(step, progress, guides) {
  if (step.kind === 'guide') return new Set(guides).has(step.id);
  return (progress?.best?.[step.id] ?? -1) >= PASS_SCORE;
}

/** The first step not done yet, or null when the whole path is done. */
export function nextStep(progress, guides) {
  const g = new Set(guides);
  return STEPS.find((s) => !stepDone(s, progress, g)) ?? null;
}

/** How many steps are done: { done, total }. */
export function pathCount(progress, guides) {
  const g = new Set(guides);
  return { done: STEPS.filter((s) => stepDone(s, progress, g)).length, total: STEPS.length };
}

export const guideById = (id) => STEPS.find((s) => s.kind === 'guide' && s.id === id) ?? null;

/** The step's display name: the level's title ("Major scale · Do – Mi", with its chapter) or the guide's. */
export function stepTitle(step) {
  if (step.kind === 'guide') return step.title;
  const l = levelOf(step);
  const ch = CHAPTERS.find((c) => c.id === l.chapterId);
  return `${ch.name} · ${l.title}`;
}

/** Keep only known guide ids, once each. */
export const normalizeGuides = (raw) => (Array.isArray(raw) ? [...new Set(raw.filter((id) => guideById(id)))] : []);
