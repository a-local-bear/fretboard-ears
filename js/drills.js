// Ear drills beyond single notes: chord qualities, chord functions, progressions, the key and mode of
// a melody, and phrases of real tunes. Pure: decks are built from a seedable rng (deck.js mulberry32).
//
// A drill has ROUNDS rounds and is passed at PASS_SCORE, like a level; its best score is stored under
// its id (every id starts with "d-", so it never clashes with a level id).
//
// A round: { keyPc, mode, answers (choice ids to find in order; only the first try at each counts),
// choices ([{ id, label }]), and what to play: chords (numerals) with `given` (how many of them are
// shown rather than asked), cadence (play the key's cadence first), quality ({ root (MIDI), q }),
// melody ([{ o, b }]: offsets above Do and beats) with bpm, full (a tune round's whole phrase, played
// once it is answered), audition (find-the-key: taps only try notes), prog (a progression id), tune (a tune id) }.

import { ROUNDS, SCALES } from './data.js';
import { TUNES, PROGRESSIONS, tunePhrases, tuneById, progressionById, tuneRange, degName } from './songs.js';

const mod12 = (n) => ((n % 12) + 12) % 12;
const pick = (arr, rng) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** `n` items dealt from shuffled copies of `items`: each used once before any repeats, never twice in a row. */
export function deal(items, n, rng, key = (x) => x) {
  const out = [];
  let bag = [];
  while (out.length < n) {
    if (!bag.length) {
      bag = shuffle(items.slice(), rng);
      const prev = out[out.length - 1];
      if (bag.length > 1 && prev !== undefined && key(bag[bag.length - 1]) === key(prev)) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    out.push(bag.pop());
  }
  return out;
}

export const TONIC_LABELS = ['C', 'C♯ D♭', 'D', 'E♭', 'E', 'F', 'F♯ G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export const DRILL_GROUPS = [
  { id: 'chords', name: 'Chords', desc: 'Hear what kind of chord it is, and where it sits in the key.' },
  { id: 'progs', name: 'Progressions', desc: 'Follow the chords of a song as they move.' },
  { id: 'keys', name: 'Keys of melodies', desc: 'Hear whether a tune is major or minor, and find its home note.' },
  { id: 'songs', name: 'Songs', desc: 'Take down phrases of real tunes in solfège.' },
];

const MAJOR_NAMED = ['three', 'pop', 'fifties', 'sad', 'two-five', 'vamp'];

export const DRILLS = [
  {
    id: 'd-quality', group: 'chords', kind: 'quality', name: 'Major or minor chord',
    about: [
      'A chord is three notes stacked in thirds: a root, a third and a fifth. Whether the third is four semitones above the root (major) or three (minor) decides its colour: major sounds open and settled, minor darker and more inward.',
      'Each round strums a chord on a random root and then plays it note by note. Listen to the middle note of the arpeggio, the third: it is the only one that changes. A wrong answer plays the chord you chose on the same root, so you hear the two side by side.',
    ],
  },
  {
    id: 'd-func-145', group: 'chords', kind: 'function', mode: 'major', set: ['I', 'IV', 'V'], name: 'I, IV or V',
    about: [
      'The three main chords of a key each have a job. I is home and sounds at rest. IV moves away and feels open, as if the music has stepped into another room. V is tension: it contains Si, the leading note, and leans hard back towards I.',
      'The cadence sets the key, then one chord sounds. Ask yourself how it wants to move: if it is happy to stop, it is I; if it wants to come back home calmly, IV; if it pushes urgently, V. Listening to the bass note helps too: Do, Fa or Sol.',
    ],
  },
  {
    id: 'd-func-dia', group: 'chords', kind: 'function', mode: 'major', set: ['I', 'ii', 'iii', 'IV', 'V', 'vi'], name: 'Any chord of a major key',
    about: [
      'Every note of the major scale carries a chord built from the scale\'s own notes. I, IV and V are major; ii, iii and vi are minor (the seventh, vii°, is rare and left out). The minor chords are the shadows of the major ones: vi shares two notes with I, ii with IV, iii with V.',
      'Start by deciding major or minor, then find the root: hum the lowest note of the chord and sing down to Do to count the steps. With practice you will hear vi as "home, but sad" and ii as "on its way to V".',
    ],
  },
  {
    id: 'd-func-minor', group: 'chords', kind: 'function', mode: 'minor', set: ['i', 'iv', 'V', 'III', 'VI', 'VII'], name: 'Chords of a minor key',
    about: [
      'In a minor key the home chord is minor, and three bright major chords live on Me, Le and Te: III, VI and VII. Songs in minor usually borrow a major V from harmonic minor, because its raised Si pulls home much harder than Te would.',
      'The cadence (i, iv, V, i) sets the key, then one chord sounds. VI and III often sound warm and hopeful, VII like a step down from home, iv like a darker version of home, and V like a question waiting for i.',
    ],
  },
  {
    id: 'd-prog-145', group: 'progs', kind: 'progression', mode: 'major', set: ['I', 'IV', 'V'], len: 4, name: 'Progressions with I, IV, V',
    about: [
      'Now the chords move. Each round plays four chords; the first is always I, home, and you name the other three in order. This is exactly what you do when you work out a song: you hear home first, then follow where the harmony goes.',
      'Follow the bass: on I it plays Do, on IV it rises to Fa, on V to Sol. Sing the bass line quietly along with the progression, and the chord names follow from the notes you sing. Replay as often as you like; only your first answer for each chord counts.',
    ],
  },
  {
    id: 'd-prog-dia', group: 'progs', kind: 'progression', mode: 'major', set: ['I', 'ii', 'IV', 'V', 'vi'], len: 4, name: 'Progressions with ii and vi',
    about: [
      'The minor chords ii and vi join I, IV and V. Together they make almost every pop song: I–V–vi–IV, I–vi–IV–V and ii–V–I are all in here somewhere.',
      'Two clues help tell them apart. First the colour: vi and ii are minor, so the progression darkens for a moment. Then the bass: vi puts La in the bass, a step below Do\', and ii puts Re there, a step above Do. If you hear the bass fall a third from I, it is almost always vi.',
    ],
  },
  {
    id: 'd-prog-minor', group: 'progs', kind: 'progression', mode: 'minor', set: ['i', 'iv', 'V', 'III', 'VI', 'VII'], len: 4, name: 'Minor progressions',
    about: [
      'Four chords in a minor key, starting on i. The major chords VI, VII and III appear in rock, film music and folk, and the major V brings the leading note when the music wants to come home.',
      'Listen for the bass walking down: i to VII to VI is Do, Te, Le, the start of the Andalusian cadence. A bright major chord right after i is usually VI or VII; one that sounds like a new home of its own is III, the relative major.',
    ],
  },
  {
    id: 'd-named-major', group: 'progs', kind: 'named', progs: MAJOR_NAMED, name: 'Name the progression',
    about: [
      'A handful of progressions carry most popular music, and once you know them by ear you can recognise a song\'s harmony in seconds. Each round plays one of six common progressions in a random key; name it.',
      'Open each one in the songbook first and play it a few times, ideally along with a song that uses it. Then notice the shape: where the minor chord comes, whether the loop starts at home, and how it turns around to the beginning.',
    ],
  },
  {
    id: 'd-named-all', group: 'progs', kind: 'named', progs: PROGRESSIONS.map((p) => p.id), name: 'Name any progression',
    about: [
      'All ten progressions of the songbook, major and minor, including the twelve-bar blues. Mode is now part of the question: decide first whether home is a major or a minor chord, which halves the choices.',
      'The minor-feel pop loop and the minor rock loop are the same four chords, so listen to which chord feels like home. That is the difference between a song in a major key and its relative minor.',
    ],
  },
  {
    id: 'd-mode', group: 'keys', kind: 'mode', name: 'Major or minor tune',
    about: [
      'A melody carries its key even without chords. Each round plays a short tune, from the songbook or freshly made, in a random key: is it major or minor?',
      'Find home first (usually the last note), then listen to the third above it: Mi in major, the lower Me in minor. Melodies that end by falling Re → Do, or Me → Re → Do, give it away quickly.',
    ],
  },
  {
    id: 'd-tonic-major', group: 'keys', kind: 'tonic', modes: ['major'], name: 'Find the key: major tunes',
    about: [
      'This is how you work out any song: hear where home is, find that note on your instrument, and you know the key. Each round plays a major tune in a random key. Tap a note to hear it after the tune, as often as you like; when one sounds like the place the tune wants to stop, press That\'s home.',
      'Have your guitar in your hands: hum the last note of the tune and find it on the neck, then check your answer here. Only the first note you commit counts, and a wrong guess doesn\'t end the round.',
    ],
  },
  {
    id: 'd-tonic-any', group: 'keys', kind: 'tonic', modes: ['major', 'minor'], name: 'Find the key: any tune',
    about: [
      'Major and minor tunes mixed. Home is still the note the tune comes to rest on, whether that note carries a major or a minor chord.',
      'A minor tune shares its notes with the major key a minor third above it (A minor and C major, for instance), so the notes alone don\'t decide the key. Listen for where the tune settles, not just which notes it uses.',
    ],
  },
  {
    id: 'd-tune-major', group: 'songs', kind: 'tune', mode: 'major', len: 5, name: 'Song phrases: major',
    about: [
      'Real melodies, five notes at a time. The cadence sets the key, then the start of a phrase from a well-known tune plays; answer it note by note in solfège. The buttons cover the tune\'s whole range, including notes below Do (marked with a comma, like Sol,).',
      'If you recognise the tune, sing it in your head and name the notes as you sing. If you don\'t, it is dictation like before: find the first note relative to Do, then follow each step.',
    ],
  },
  {
    id: 'd-tune-minor', group: 'songs', kind: 'tune', mode: 'minor', len: 5, name: 'Song phrases: minor',
    about: [
      'Phrases of minor tunes, named from the minor tonic: Do Re Me Fa Sol Le Te. Some tunes raise the sixth or seventh on the way up (La and Si instead of Le and Te), and the buttons include those notes when the tune uses them.',
      'Sing Do, Me and Sol, the minor chord, before you start, and keep them in your ear: most phrases begin and end on one of them.',
    ],
  },
];

export const drillById = (id) => DRILLS.find((d) => d.id === id) || null;

// ---------- melodies ----------

/**
 * A short melody that makes its key clear: it starts on Do, the third or Sol, moves mostly by step
 * within Sol, … Do', touches the third, and ends on Do approached from a neighbour or from Sol.
 * Returns [{ o, b }] with the last note held.
 */
export function tonalMelody(mode, rng, len = 7) {
  const sc = SCALES[mode] || SCALES.major;
  const pool = [...sc.map((s) => s - 12).filter((o) => o >= -5), ...sc, 12];
  const third = sc[2];
  for (let attempt = 0; ; attempt++) {
    let i = pool.indexOf(pick([0, third, 7, 0], rng));
    const seq = [pool[i]];
    while (seq.length < len - 2) {
      const r = rng();
      const size = r < 0.6 ? 1 : r < 0.85 ? 2 : 3;
      const dir = rng() < 0.5 ? -1 : 1;
      let j = i + dir * size;
      if (j < 0 || j >= pool.length) j = i - dir * size;
      if (j < 0 || j >= pool.length || j === i) continue;
      i = j;
      seq.push(pool[i]);
    }
    const last = seq[seq.length - 1];
    const home = last >= 6 ? 12 : 0;
    const lead = pick(home === 12 ? [14, sc[6], 7] : [2, sc[6] - 12, -5], rng);
    const out = [...seq, lead, home];
    const ok = out.some((o) => mod12(o) === third) && out.every((o, k) => k === 0 || o !== out[k - 1]);
    if (ok || attempt > 60) return out.map((o, k) => ({ o, b: k === out.length - 1 ? 2 : 1 }));
  }
}

/** Phrases of the songbook's tunes of a mode, as { tune, notes ([{ o, b }]) }; `filter` keeps some. */
function tunePhraseList(mode, filter = () => true, tuneId = null) {
  const out = [];
  const seen = new Set();
  for (const tune of TUNES) {
    if (tuneId ? tune.id !== tuneId : tune.mode !== mode) continue;
    for (const ph of tunePhrases(tune)) {
      const notes = ph.map(({ o, b }) => ({ o, b }));
      const sig = `${tune.id}:${notes.map((n) => n.o).join()}`;
      if (seen.has(sig) || !filter(notes)) continue;
      seen.add(sig);
      out.push({ tune, notes });
    }
  }
  return out;
}

/** Choices for a tune's notes: the scale of its mode across its range, plus any other note it uses. */
export function tuneChoices(tune) {
  const [lo, hi] = tuneRange(tune);
  const used = new Set(tunePhrases(tune).flat().map((n) => n.o));
  const sc = SCALES[tune.mode];
  const out = [];
  for (let o = lo; o <= hi; o++) if (used.has(o) || sc.includes(mod12(o))) out.push(o);
  return out.map((o) => ({ id: String(o), label: degName(o) }));
}

// ---------- decks ----------

const numeralChoices = (set) => set.map((n) => ({ id: n, label: n }));

/** The drill's ROUNDS rounds. `opts.tuneId` limits a tune drill to one tune (the songbook's practice). */
export function buildDrillDeck(drill, rng = Math.random, opts = {}) {
  const key = () => Math.floor(rng() * 12);
  switch (drill.kind) {
    case 'quality': {
      const qs = shuffle(Array.from({ length: ROUNDS }, (_, i) => (i % 2 ? 'min' : 'maj')), rng);
      return qs.map((q) => ({
        keyPc: 0, mode: 'major', quality: { root: 40 + Math.floor(rng() * 12), q }, answers: [q],
        choices: [{ id: 'maj', label: 'Major' }, { id: 'min', label: 'Minor' }],
      }));
    }
    case 'function':
      return deal(drill.set, ROUNDS, rng).map((n) => ({
        keyPc: key(), mode: drill.mode, cadence: true, chords: [n], given: 0, answers: [n], choices: numeralChoices(drill.set),
      }));
    case 'progression': {
      const seen = new Set();
      return Array.from({ length: ROUNDS }, () => {
        let slots;
        for (let t = 0; t < 30; t++) {
          slots = [drill.set[0]];
          while (slots.length < drill.len) {
            const prev = slots[slots.length - 1];
            slots.push(pick(drill.set.filter((n) => n !== prev), rng));
          }
          if (!seen.has(slots.join())) break;
        }
        seen.add(slots.join());
        return { keyPc: key(), mode: drill.mode, chords: slots, given: 1, answers: slots.slice(1), choices: numeralChoices(drill.set) };
      });
    }
    case 'named': {
      const progs = drill.progs.map(progressionById);
      const choices = progs.map((p) => ({ id: p.id, label: p.name, sub: p.slots.length > 4 ? '12 bars' : p.slots.join(' ') }));
      return deal(progs, ROUNDS, rng, (p) => p.id).map((p) => ({
        keyPc: key(), mode: p.mode, chords: p.slots, given: 0, prog: p.id, answers: [p.id], choices,
      }));
    }
    case 'mode': {
      const modes = shuffle(Array.from({ length: ROUNDS }, (_, i) => (i % 2 ? 'minor' : 'major')), rng);
      const byMode = (m) => tunePhraseList(m, (ns) => ns.length >= 5 && ns.some((n) => mod12(n.o) === SCALES[m][2]));
      const lists = { major: byMode('major'), minor: byMode('minor') };
      return modes.map((m) => {
        const fromTune = lists[m].length && rng() < 0.5 ? pick(lists[m], rng) : null;
        return {
          keyPc: key(), mode: m, melody: fromTune ? fromTune.notes : tonalMelody(m, rng), bpm: fromTune ? fromTune.tune.bpm : 100,
          tune: fromTune?.tune.id ?? null, answers: [m], choices: [{ id: 'major', label: 'Major' }, { id: 'minor', label: 'Minor' }],
        };
      });
    }
    case 'tonic': {
      const homeEnd = (ns) => ns.length >= 5 && mod12(ns[ns.length - 1].o) === 0;
      const lists = Object.fromEntries(drill.modes.map((m) => [m, tunePhraseList(m, homeEnd)]));
      const choices = TONIC_LABELS.map((label, pc) => ({ id: String(pc), label }));
      return Array.from({ length: ROUNDS }, () => {
        const m = pick(drill.modes, rng);
        const k = key();
        const fromTune = lists[m].length && rng() < 0.5 ? pick(lists[m], rng) : null;
        return {
          keyPc: k, mode: m, melody: fromTune ? fromTune.notes : tonalMelody(m, rng), bpm: fromTune ? fromTune.tune.bpm : 100,
          tune: fromTune?.tune.id ?? null, audition: true, answers: [String(k)], choices,
        };
      });
    }
    case 'tune': {
      const list = tunePhraseList(drill.mode, (ns) => ns.length >= 3, opts.tuneId ?? drill.single ?? null);
      return deal(list, ROUNDS, rng, (x) => `${x.tune.id}:${x.notes.map((n) => n.o).join()}`).map(({ tune, notes }) => {
        const frag = notes.slice(0, drill.len);
        return {
          keyPc: key(), mode: tune.mode, cadence: true, melody: frag, full: notes, bpm: tune.bpm, tune: tune.id,
          answers: frag.map((n) => String(n.o)), choices: tuneChoices(tune),
        };
      });
    }
    default:
      throw new Error(`unknown drill kind ${drill.kind}`);
  }
}

/** The single-tune version of a tune drill (the songbook's "practise its phrases"). */
export function tuneDrill(tuneId) {
  const tune = tuneById(tuneId);
  return {
    id: `d-song-${tune.id}`, group: 'songs', kind: 'tune', mode: tune.mode, len: 6, name: tune.title, single: tune.id,
    about: [`Phrases of ${tune.title}, up to six notes at a time, in a new key every round. Answer each note in solfège; the full phrase plays again once you have it.`],
  };
}

