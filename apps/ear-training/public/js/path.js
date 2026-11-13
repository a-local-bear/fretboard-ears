// The path: the ladder of levels (data.js LEVELS) in stages, with what each stage is for and a tip
// for every level. A level is done once passed (PASS_SCORE); nothing is ever locked.
// Text names notes as intervals from the root, in words: root, second, flat third … seventh, octave.
// Pure data and functions only.

import { FAMILIES, LEVELS, PASS_SCORE } from './data.js';

/** Per stage (a level family): desc (one line) and about (a paragraph on what the stage is for). */
const TEXT = {
  major: {
    desc: 'The seven notes of the major scale, built up from the triad, then in any key.',
    about: 'Every note is heard against the root, the home note of the key. Before each note the app plays a cadence, a short chord sequence that tells your ear where home is, so you learn what each interval above the root feels like rather than its absolute pitch. The scale grows from the triad outwards: root and fifth, then the third, then the notes between them. Once you know the whole octave the key changes with every attempt, because staying in one key trains absolute pitch instead of the sound of each interval.',
  },
  majorChrom: {
    desc: 'The five notes between the notes of the major scale.',
    about: 'Between the seven notes of the scale lie five more, and good melodies use them for colour and tension: blue notes, passing notes and notes borrowed from minor. Each is named as a lowered scale note: flat second, flat third, flat fifth, flat sixth and flat seventh. A chromatic note almost always leads by a half step to a scale note next to it, and that pull is what you learn to hear.',
  },
  minor: {
    desc: 'The natural minor scale, with its flat third, flat sixth and flat seventh.',
    about: 'Minor keys have their own home: a minor chord, with a flat third. The natural minor scale lowers three notes of the major scale, the third, sixth and seventh, and each lowered note brings its own shade. The root, second, fourth and fifth are the notes you already know, heard in a darker setting. The cadence is minor from here on.',
  },
  minorChrom: {
    desc: 'All twelve notes over a minor key.',
    about: 'Over a minor key the outsiders change. The major third, sixth and seventh now come from outside the scale, together with the flat second and flat fifth. The seventh matters most: minor songs borrow it all the time, because it pulls up into the root far harder than the flat seventh does. The names are the ones you know; only the key around them is different.',
  },
  all: {
    desc: 'Any note, any octave, major or minor.',
    about: 'The last level removes the remaining boundaries: any of the twelve notes, in any octave, over a major or minor key that changes with every attempt, answered anywhere on the neck. When you can do this, the fretboard is no longer a map you have to read but an instrument you hear with.',
  },
};

const TIPS = {
  'major-t0': 'Root and fifth only. The root is home; the fifth is open and solid, a second place the ear could rest. Decide by feel before you think about pitch.',
  'major-t1': 'The third joins between them. It is bright and sweet, the note that makes the chord major. Root, third and fifth together are the major triad.',
  'major-t2': 'The second is the first restless note: it sits between the root and the third and wants to fall back to the root. Listen for that lean towards home.',
  'major-3': 'The fourth fills the gap between the third and the fifth. It is the first note that really pulls: it leans down onto the third, a half step below.',
  'major-4': 'The sixth is gentle and a little wistful; it likes to fall back to the fifth.',
  'major-5': 'The seventh is the most restless note of the scale. It sits a half step below the octave and almost forces the music upward.',
  'major-6': 'The whole octave at once. If two notes still get mixed up, stop and sing from the root up to each of them.',
  'major-rk': 'The whole octave in a new major key each time you start. Let the cadence reset your ear; the numbers do not change, only where the root sits on the neck.',
  'major-2oct': 'Two octaves, answered anywhere on the neck. The octave matters now: listen for whether the note lies above or below the last root you heard.',
  'major-dict-2': 'Two notes in a row: play them back in order. Keep the cadence in your head; each note is still heard against the root, not against the note before it.',
  'major-dict-4': 'Four-note phrases. Sing the phrase back before you play it, so you hold it in memory instead of chasing the sound.',

  'majorChrom-1st': 'The lower half of the octave with its chromatic notes: the flat second, flat third and flat fifth join the root, second, third and fourth. Listen for where each outside note wants to move.',
  'majorChrom-2nd': 'The upper half, from the flat fifth to the octave. The flat sixth sighs down onto the fifth; the flat seventh is the bluesy one, a whole step below the octave.',
  'majorChrom-oct': 'All twelve notes over a major key. Decide first whether the note belongs to the scale; if it does not, hear which neighbour it leans on.',
  'majorChrom-2oct': 'All twelve notes over two octaves, anywhere on the neck.',
  'majorChrom-dict-2': 'Two notes, one of them from outside the scale and a half step away from the other. Hear which of the two is the outsider.',
  'majorChrom-dict-4': 'Four-note phrases with one chromatic note, a half step from the note next to it. Sing the phrase back before you play it.',

  'minor-t': 'Root, flat third and fifth: the minor triad. The flat third is what makes the key minor; hear how it darkens the chord compared with the third you know.',
  'minor-5': 'The first five notes of the minor scale. The second and the fourth are familiar, but the second now sits a half step under the flat third and can lean either way.',
  'minor-6': 'The flat sixth lies a half step above the fifth and sighs down onto it. It is the most expressive note of the minor scale.',
  'minor-oct': 'The flat seventh completes the scale. It lies a whole step below the octave, so it does not pull upward the way the seventh does; it sounds open, a little like folk or rock.',
  'minor-2oct': 'The minor scale over two octaves, anywhere on the neck.',
  'minor-dict-2': 'Two notes in minor. Sing root, flat third, fifth before you start, to keep the minor chord in your ear.',
  'minor-dict-4': 'Four-note phrases in minor. Sing each phrase back before you play it.',

  'minorChrom-1st': 'The lower half over a minor key. The third is now the stranger: hear it rub against the minor chord.',
  'minorChrom-2nd': 'The upper half over a minor key. The sixth and the seventh are the outsiders here, and the seventh pulls hard up to the octave.',
  'minorChrom-oct': 'All twelve notes over a minor key.',
  'minorChrom-2oct': 'All twelve notes over a minor key and two octaves, anywhere on the neck.',
  'minorChrom-dict-2': 'Two notes in a minor key, one of them from outside the scale and a half step away from the other.',
  'minorChrom-dict-4': 'Four-note phrases in minor with one chromatic note. Sing each phrase back before you play it.',

  'all-neck': 'Listen to the cadence for major or minor first. Then find the nearest root and place the note against it.',
};

/** The stages in order: { id (the family), name, desc, about, levels (level specs, ladder order) }. */
export const STAGES = Object.keys(FAMILIES).map((id) => ({
  id, name: FAMILIES[id].name, ...TEXT[id], levels: LEVELS.filter((l) => l.family === id),
}));

/** Index of the stage a level belongs to. */
export const stageOf = (level) => STAGES.findIndex((s) => s.id === level.family);

/** What to listen for in a level. */
export const tipOf = (levelId) => TIPS[levelId] ?? '';

/** Done: the level has been passed once. */
export const levelDone = (level, progress) => (progress?.best?.[level.id] ?? -1) >= PASS_SCORE;

/** The first level not done yet, or null when the whole path is done. */
export const nextLevel = (progress) => LEVELS.find((l) => !levelDone(l, progress)) ?? null;

/** How many levels are done: { done, total }, of the whole path or of the given levels. */
export function pathCount(progress, levels = LEVELS) {
  return { done: levels.filter((l) => levelDone(l, progress)).length, total: levels.length };
}
