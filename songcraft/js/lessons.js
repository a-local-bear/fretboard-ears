// The lessons: two tracks (chords, then riffs and melodies). Each lesson is a list of blocks and
// ends with a challenge that is checked live in the chord builder or the riff lab.
//
// Blocks:  { p }      a paragraph; {I}, {♭VII}, {V7} become chords of the current key, {key} its name
//          { tip }    a highlighted paragraph
//          { family } the seven chords of the key, to tap
//          { demo }   a loop to play: { prog, pattern?, bpm?, riff? | gen? | motif?, note }
// Riffs are written in scale degrees, one token per 8th note: 1–7, ' = octave up, , = octave down,
// - = no new note, | between bars (ignored).

import { SCALES, PENTA, QUALITIES, mod12, describe, isDiatonic } from './theory.js';
import { STEPS_PER_BAR, chordSteps } from './song.js';
import { riffNotes, riffReport, barRhythms, guideTones } from './riff.js';

/** "3 - 4 - | 5, - 1' -" → riff offsets. */
export function parseRiff(text) {
  return text.split(/\s+/).filter((t) => t && t !== '|').map((t) => {
    const m = /^([b♭#♯]?)([1-7])([',]*)$/.exec(t);
    if (!m) return null;
    const acc = m[1] === 'b' || m[1] === '♭' ? -1 : m[1] ? 1 : 0;
    const oct = [...m[3]].reduce((n, c) => n + (c === "'" ? 12 : -12), 0);
    return SCALES.major[Number(m[2]) - 1] + acc + oct;
  });
}

const fam = (c) => QUALITIES[c.q].fam;
const tonic = (c, mode) => c.root === 0 && (mode === 'minor' ? fam(c) === 'min' : fam(c) === 'maj');
const pairs = (song) => song.chords.map((c, i) => [c, song.chords[(i + 1) % song.chords.length]]);
const plain = (c) => ['', 'm', 'dim'].includes(c.q);

/** Rubbing or outside notes of a riff: how many, and how many are not followed by a step to a note that fits. */
export function rubs(song) {
  const notes = riffNotes(song);
  const tense = notes.map((n, i) => ({ n, next: notes[i + 1] })).filter(({ n }) => n.fit === 'rub' || n.fit === 'out');
  const hanging = tense.filter(({ n, next }) => !next || Math.abs(next.offset - n.offset) > 2 || next.fit === 'rub' || next.fit === 'out');
  return { total: tense.length, hanging: hanging.length };
}

/** How many bars share the most common rhythm (bars with no notes do not count). */
const sharedRhythm = (song) => {
  const counts = {};
  for (const r of barRhythms(song)) if (r.includes('x')) counts[r] = (counts[r] || 0) + 1;
  return Math.max(0, ...Object.values(counts));
};

const HOOK = "3 - 3 2 1 - - - | 2 - 2 3 2 - - - | 3 - 3 2 1 - - - | 1 - 2 1 6, - - -";

export const LESSONS = [
  // ------------------------------------------------------------------ chords
  {
    id: 'c1', track: 'chords', title: 'Seven chords in every key',
    sub: 'Where chords come from, and why they are numbered',
    blocks: [
      { p: 'Pick a key and you get seven chords for free: one built on each note of its scale. Most songs use only these seven, and many use three or four. Tap them. This is the whole family of {key}.' },
      { family: true },
      { p: 'The numbers are roman numerals: capitals for major chords, small letters for minor ones. The pattern never changes. In every major key, <b>I, IV and V are major</b>, <b>ii, iii and vi are minor</b>, and vii° is the odd one out.' },
      { p: 'That is why songwriters think in numbers. Change the key above and the chord names change, but {I} {IV} {V} keeps its sound: only higher or lower.' },
      { demo: { prog: 'I IV V I', note: 'I, IV and V: the three major chords of the key. Thousands of songs need nothing more.' } },
      { demo: { prog: 'I vi ii V', note: 'The same key, now with two of its minor chords.' } },
      { tip: 'Every chord diagram in this app is a real shape you can play. Tap any chord to see it.' },
    ],
    challenge: {
      target: 'build', text: 'Build a loop of four chords, all from inside the key. Use at least three different ones.',
      check: (s) => s.chords.length >= 4 && s.chords.every((c) => isDiatonic(c, s.mode)) && new Set(s.chords.map((c) => c.root)).size >= 3,
    },
  },
  {
    id: 'c2', track: 'chords', title: 'Home, away, tension',
    sub: 'The three jobs a chord can do',
    blocks: [
      { p: 'A progression is a small journey. Each of the seven chords has one of three jobs, shown by its colour everywhere in this app.' },
      { roles: true },
      { p: '<b>Home</b> is {I}. Its relatives {vi} and {iii} share two of its three notes and feel close to home. <b>Away</b> is {IV} and its relative {ii}: movement without urgency. <b>Tension</b> is {V}: it wants to go home.' },
      { demo: { prog: 'I IV I I', note: 'Home, away, home. A gentle sway: nothing pulls.' } },
      { demo: { prog: 'I V I I', note: 'Home, tension, home. Hear how V leans back into I.' } },
      { demo: { prog: 'I IV V V', pattern: 'pop', note: 'Home, away, tension: and it stops on tension. The loop feels unfinished, so your ear wants the first chord again. That pull is what keeps a song moving.' } },
      { tip: 'A useful recipe: start at home, go away, build tension, come back. Then break the recipe on purpose.' },
    ],
    challenge: {
      target: 'build', text: 'Build a loop that starts at home (I) and ends on tension, so that the last chord pulls back to the first.',
      check: (s) => s.chords.length >= 3 && tonic(s.chords[0], s.mode) && describe(s.chords[s.chords.length - 1], s.mode).role === 'tension',
    },
  },
  {
    id: 'c3', track: 'chords', title: 'Four chords, many songs',
    sub: 'The same chords in a different order are a different song',
    blocks: [
      { p: 'Four chords carry a huge share of pop and indie: {I}, {V}, {vi} and {IV}. What changes from song to song is the order, and above all which chord comes first.' },
      { demo: { prog: 'I V vi IV', note: 'The best-known order. Bright and confident: it starts at home.' } },
      { demo: { prog: 'vi IV I V', note: 'The same loop started on vi. Same four chords, but now it sounds wistful, because the first chord is the one the ear takes as home.' } },
      { demo: { prog: 'I vi IV V', note: 'The doo-wop order. It ends on V, so it rolls forward into each repeat.' } },
      { demo: { prog: 'IV I V vi', pattern: 'eighths', note: 'Started on IV. It never quite settles: a favourite of indie anthems.' } },
      { tip: 'When a loop of yours sounds too plain, do not reach for new chords first. Start it on a different chord.' },
    ],
    challenge: {
      target: 'build', text: 'Build a four-chord loop that starts on vi and has I somewhere inside it.',
      check: (s) => s.mode === 'major' && s.chords.length >= 4 && s.chords[0].root === 9 && fam(s.chords[0]) === 'min' && s.chords.some((c) => tonic(c, 'major')),
    },
  },
  {
    id: 'c4', track: 'chords', title: 'How long a chord lasts',
    sub: 'Harmonic rhythm and strumming',
    blocks: [
      { p: 'Chords do not have to last one bar each. How often the chord changes is called harmonic rhythm, and it shapes a song as much as the chords themselves.' },
      { demo: { prog: 'I:8 IV V', note: 'I stays for two bars, then IV and V get one each. Slow start, then it moves.' } },
      { demo: { prog: 'I V:2 vi:2 IV V', note: 'V and vi share one bar, two beats each. A quick change adds a push in the middle.' } },
      { p: 'The strumming pattern matters just as much. Here is one progression played four ways.' },
      { demo: { prog: 'I V vi IV', pattern: 'ring', note: 'Let ring: one strum per bar. Space for a voice.' } },
      { demo: { prog: 'I V vi IV', pattern: 'arp', note: 'Picked: the notes of each chord one by one.' } },
      { demo: { prog: 'I V vi IV', pattern: 'eighths', bpm: 120, note: 'Driving 8ths: all downstrokes. The indie-rock engine.' } },
      { demo: { prog: 'I V vi IV', pattern: 'pop', note: 'Pop strum: down, down-up, up-down-up.' } },
    ],
    challenge: {
      target: 'build', text: 'Give one chord half a bar and another chord two bars.',
      check: (s) => s.chords.some((c) => c.beats === 2) && s.chords.some((c) => c.beats === 8),
    },
  },
  {
    id: 'c5', track: 'chords', title: 'Colour: sevenths, add9 and sus',
    sub: 'Same job, different mood',
    blocks: [
      { p: 'A triad has three notes. Add a fourth note, or swap one, and the chord keeps its job but changes colour. This is the quickest way to move a plain progression towards indie or jazz.' },
      { demo: { prog: 'I IV I IV', pattern: 'ring', note: 'Plain triads.' } },
      { demo: { prog: 'Imaj7 IVmaj7 Imaj7 IVmaj7', pattern: 'ring', note: 'Major sevenths. Soft and hazy: dream pop, bossa nova, neo-soul.' } },
      { demo: { prog: 'Iadd9 IVadd9 Iadd9 IVadd9', pattern: 'arp', note: 'Add9: the triad with one extra note on top. Shimmering, open: the sound of a lot of indie guitar.' } },
      { demo: { prog: 'I Vsus4:2 V:2 vi IV', note: 'A sus4 holds back the middle note of the chord, then lets it fall into place.' } },
      { demo: { prog: 'vi7 ii7 V7 Imaj7', pattern: 'jazz', note: 'Every chord as a seventh chord, with a jazz feel. Minor chords take a 7, V takes a 7, and I and IV take a maj7.' } },
      { tip: 'In the chord builder, pick a chord and use the Colour row. The 7 on V makes its pull stronger. The maj7 on I makes home softer.' },
    ],
    challenge: {
      target: 'build', text: 'Colour at least two chords in your loop: a seventh, an add9 or a sus.',
      check: (s) => s.chords.filter((c) => !plain(c)).length >= 2,
    },
  },
  {
    id: 'c6', track: 'chords', title: 'Borrowed chords',
    sub: 'The indie move: take a chord from the minor key',
    blocks: [
      { p: 'Every major key has a twin: the minor key on the same note. You can borrow its chords for a bar. They sound like a cloud passing over, and they are everywhere in indie, britpop and film music.' },
      { demo: { prog: 'I IV iv I', note: 'The minor four. After IV, one note drops a half step and the chord turns minor, then falls home. Bittersweet.' } },
      { demo: { prog: 'I iii IV iv', pattern: 'arp', note: 'A classic indie loop: it ends on the minor four, which leans back into I.' } },
      { demo: { prog: 'I ♭VII IV I', pattern: 'eighths', bpm: 116, note: 'The flat seven: a major chord a whole step below home. Open and rocky.' } },
      { demo: { prog: 'I ♭VI ♭VII I', pattern: 'eighths', note: 'Flat six, flat seven, home: two borrowed chords climbing by whole steps. Heroic.' } },
      { tip: 'Borrowed chords work best one at a time, between chords of the key. In the builder they are in the row "From outside the key".' },
    ],
    challenge: {
      target: 'build', text: 'Use a chord borrowed from the minor key, and bring it home: the chord after it must be I.',
      check: (s) => s.mode === 'major' && pairs(s).some(([a, b]) => describe(a, 'major').kind === 'borrowed' && tonic(b, 'major')),
    },
  },
  {
    id: 'c7', track: 'chords', title: 'Push chords',
    sub: 'Secondary dominants: a V for any chord',
    blocks: [
      { p: 'V pulls to I. You can lend that pull to any other chord of the key by playing <em>its own</em> V just before it. These push chords are major (or 7) chords that do not belong to the key, and they always resolve up a fourth.' },
      { demo: { prog: 'I III7 vi IV', note: 'III7 is the V of vi. Compare with plain I, iii, vi, IV: the push chord makes the arrival on vi dramatic.' } },
      { demo: { prog: 'I VI7 ii V', note: 'VI7 is the V of ii. An old jazz and soul move.' } },
      { demo: { prog: 'I II7 V V', note: 'II7 is the V of V: tension leading to tension.' } },
      { demo: { prog: 'I I7 IV iv', note: 'Even I can become a push chord: I7 is the V of IV. Followed here by the minor four from the last lesson.' } },
      { tip: 'To find the push chord for a target, go down a fourth from its root and play a 7 chord there. For {vi} that gives {III7}; for {ii} it gives {VI7}.' },
    ],
    challenge: {
      target: 'build', text: 'Add a push chord and land it where it points.',
      check: (s) => pairs(s).some(([a, b]) => { const d = describe(a, s.mode); return d.kind === 'secondary' && d.target === b.root; }),
    },
  },
  {
    id: 'c8', track: 'chords', title: 'The jazz engine: ii, V, I',
    sub: 'Seventh chords moving by fourths',
    blocks: [
      { p: 'Jazz harmony is built from one short phrase: {ii7}, {V7}, {Imaj7}. Away, tension, home, each root a fourth above the last, every chord a seventh chord.' },
      { demo: { prog: 'ii7 V7 Imaj7:8', pattern: 'jazz', note: 'Two five one. Listen to how smoothly each chord hands over to the next.' } },
      { demo: { prog: 'Imaj7 vi7 ii7 V7', pattern: 'jazz', note: 'The turnaround: I and vi, then a ii, V that brings you back to the top.' } },
      { demo: { prog: 'Imaj7 VI7 ii7 V7', pattern: 'jazz', note: 'The same with a push chord: VI7 in place of vi7 drives into ii.' } },
      { demo: { prog: 'Imaj7 ♯i°7 ii7 V7', pattern: 'jazz', note: 'A passing diminished chord fills the half step between I and ii.' } },
      { demo: { prog: 'iii7 VI7 ii7 V7', pattern: 'jazz', note: 'A chain: each chord is the V (or ii) of the next. It only reaches home when the loop restarts.' } },
      { tip: 'For a jazzy pop song you do not need all of it. One ii7, V7 before the chorus, or maj7 chords on I and IV, is enough.' },
    ],
    challenge: {
      target: 'build', text: 'Build a loop that contains ii7, V7, Imaj7 in a row.',
      start: { prog: 'Imaj7 vi7 IVmaj7 V7', pattern: 'jazz' },
      check: (s) => s.mode === 'major' && s.chords.some((c, i) => {
        const b = s.chords[(i + 1) % s.chords.length];
        const d = s.chords[(i + 2) % s.chords.length];
        return s.chords.length >= 3 && c.root === 2 && ['m7', 'm9'].includes(c.q) && b.root === 7 && ['7', '9'].includes(b.q) && d.root === 0 && ['maj7', 'maj9', '6'].includes(d.q);
      }),
    },
  },
  {
    id: 'c9', track: 'chords', title: 'Minor keys', mode: 'minor',
    sub: 'When the sad twin is home',
    blocks: [
      { p: 'Start a major-key loop on vi often enough and vi becomes home. That is a minor key: the same seven chords, renumbered from the minor chord. This lesson is in {key}.' },
      { family: true },
      { p: 'Home is {i}. The bright chords {♭III}, {♭VI} and {♭VII} are all major, which is why minor-key songs can still sound huge.' },
      { demo: { prog: 'i ♭VI ♭III ♭VII', note: 'The minor-key four-chord loop. In a major key this would be vi, IV, I, V.' } },
      { demo: { prog: 'i ♭VII ♭VI ♭VII', pattern: 'eighths', note: 'Stepping down and back up. Moody and driving.' } },
      { p: 'The natural minor has one weakness: its five is minor ({v}) and does not pull. So songs borrow a major five, {V}, for a strong way home.' },
      { demo: { prog: 'i iv v i', note: 'With the minor five: it drifts home.' } },
      { demo: { prog: 'i iv V7 i', note: 'With the major five: it is pulled home.' } },
      { demo: { prog: 'i ♭VII ♭VI V', note: 'Walking down to the major five. Flamenco, surf, and a hundred pop choruses.' } },
    ],
    challenge: {
      target: 'build', text: 'In a minor key, use the major V and resolve it to i.',
      start: { prog: 'i ♭VI ♭III ♭VII', mode: 'minor' },
      check: (s) => s.mode === 'minor' && pairs(s).some(([a, b]) => a.root === 7 && fam(a) === 'maj' && tonic(b, 'minor')),
    },
  },
  {
    id: 'c10', track: 'chords', title: 'Write your own',
    sub: 'A recipe to start from',
    blocks: [
      { p: 'You now have everything a songwriter uses every day. Here is a way to put it together when the page is blank.' },
      { p: '<b>1. Choose the first chord.</b> I for bright, vi for wistful, IV for restless.<br><b>2. Choose the last chord.</b> V (or iv, or ♭VII) if the loop should roll on; I if it should rest.<br><b>3. Fill the middle</b> with chords of the key. The builder suggests what tends to come next.<br><b>4. Add one surprise:</b> a borrowed chord, a push chord, or a half-bar change.<br><b>5. Colour it:</b> sevenths for jazz, add9 and sus for indie, plain triads for punch.<br><b>6. Pick a strum and a tempo</b> and listen to it loop. Change one thing at a time.' },
      { demo: { prog: 'Iadd9 iii7 IVmaj7 iv', pattern: 'arp', bpm: 88, note: 'Indie: add9 and maj7 colours, ending on the minor four.' } },
      { demo: { prog: 'vi IV I V:2 III7:2', pattern: 'pop', bpm: 104, note: 'Pop: the four chords from vi, with a push chord in the last half bar to swing back into vi.' } },
      { demo: { prog: 'IVmaj7 iii7 ii7 V7', pattern: 'jazz', bpm: 92, note: 'Jazzy: walking down from IV, then a ii, V that points home without arriving.' } },
      { tip: 'A loop is a verse or a chorus, not yet a song. Write two loops in the same key that start on different chords, and you have both.' },
    ],
    challenge: {
      target: 'build', text: 'Write your own loop: four to eight chords, at least one surprise from outside the key, ending on tension.',
      check: (s) => s.chords.length >= 4 && s.chords.some((c) => describe(c, s.mode).kind !== 'key') && describe(s.chords[s.chords.length - 1], s.mode).role === 'tension',
    },
  },

  // ------------------------------------------------------------------ riffs and melodies
  {
    id: 'r1', track: 'riffs', title: 'Chord tones always fit',
    sub: 'The notes inside the chord are your safe ground',
    blocks: [
      { p: 'Every chord is made of three or four notes. Play those notes one at a time while the chord sounds and you cannot play a wrong note. That is all "fitting" means: the riff and the chord agree.' },
      { demo: { prog: 'I V vi IV', pattern: 'ring', riff: "1 - 3 - 5 - 3 - | 7, - 2 - 5 - 2 - | 6, - 1 - 3 - 1 - | 6, - 1 - 4 - 1 -", note: 'Only chord tones: the root, 3rd and 5th of each chord. It already sounds like a riff.' } },
      { p: 'Where the note falls matters. Beats 1 and 3 are the strong beats: a chord tone there makes the whole bar sound right, whatever happens in between.' },
      { demo: { prog: 'I V vi IV', pattern: 'pop', riff: '3 - - - - - - - | 7, - - - - - - - | 1 - - - - - - - | 6, - - - - - - -', note: 'One note per chord: its 3rd. The 3rd is the note that makes a chord major or minor, so this line tells the whole story of the progression.' } },
      { tip: 'In the riff lab, the notes of the current chord are marked with a ring in every column. Aim for the rings on beats 1 and 3.' },
    ],
    challenge: {
      target: 'riff', text: 'Write at least six notes. Every note you put on beat 1 or beat 3 must be a chord tone (use at least three of those beats).',
      check: (s) => { const n = riffNotes(s); const strong = n.filter((x) => x.step % 4 === 0); return n.length >= 6 && strong.length >= 3 && strong.every((x) => x.fit === 'chord'); },
    },
  },
  {
    id: 'r2', track: 'riffs', title: 'The pentatonic',
    sub: 'Five notes that cannot clash',
    blocks: [
      { p: 'The major scale has seven notes. Two of them, the 4th and the 7th, sit a half step from a neighbour, and half steps are where clashes come from. Leave those two out and you have the <b>major pentatonic: 1, 2, 3, 5, 6</b>.' },
      { p: 'No two of these five are a half step apart, so a melody made from them sounds smooth over every chord of the key. That is why so many hooks, in pop, folk, indie and soul, are pentatonic.' },
      { demo: { prog: 'I V vi IV', riff: HOOK, note: 'A pentatonic hook. The notes barely change from bar to bar. The chords change underneath and give each bar a different colour.' } },
      { p: 'The pentatonic gives you the notes. The last lesson tells you where to put them: when one of the five is also a tone of the chord, it belongs on beat 1 or 3.' },
      { tip: 'In a minor key the same five notes are the minor pentatonic: 1, ♭3, 4, 5, ♭7. The riff lab shows the right one for your key.' },
    ],
    challenge: {
      target: 'riff', text: 'Write a riff of at least eight notes that uses only pentatonic notes.',
      check: (s) => { const n = riffNotes(s); return n.length >= 8 && n.every((x) => PENTA[s.mode].includes(mod12(x.offset))); },
    },
  },
  {
    id: 'r3', track: 'riffs', title: 'Rhythm is the hook',
    sub: 'One note is enough if the rhythm is good',
    blocks: [
      { p: 'People remember rhythm before pitch. Here is a single note, the 5th of the key, played evenly.' },
      { demo: { prog: 'I V vi IV', pattern: 'ring', riff: '5 - 5 - 5 - 5 - | 5 - 5 - 5 - 5 - | 5 - 5 - 5 - 5 - | 5 - 5 - 5 - 5 -', note: 'Four even notes per bar. Correct, and forgettable.' } },
      { demo: { prog: 'I V vi IV', pattern: 'ring', riff: '5 - - 5 - - 5 - | 5 - - 5 - - 5 - | 5 - - 5 - - 5 - | 5 - - 5 - - 5 -', note: 'The same note grouped 3 + 3 + 2. Two of the three notes fall between the beats. That is syncopation, and now it is a riff.' } },
      { p: 'Notice that the one note never changes while four chords pass under it, and it sounds different over each. A note held across chord changes is one of the oldest tricks in guitar music.' },
      { demo: { prog: 'I V vi IV', riff: "- - 5 5 - 6 5 - | - - 5 5 - 6 5 - | - - 5 5 - 6 5 - | - - 5 5 - 6 1' -", note: 'Silence is rhythm too. This riff waits a full beat before it starts, in every bar.' } },
    ],
    challenge: {
      target: 'riff', text: 'Use one single pitch. Give it a rhythm with gaps, and repeat that rhythm in at least three bars.',
      check: (s) => { const n = riffNotes(s); return new Set(n.map((x) => x.offset)).size === 1 && sharedRhythm(s) >= 3 && barRhythms(s).some((r) => r.includes('x') && (r.match(/x/g) || []).length <= 5); },
    },
  },
  {
    id: 'r4', track: 'riffs', title: 'Say it, repeat it, change it',
    sub: 'A riff is a small idea used again',
    blocks: [
      { p: 'A short idea, a bar or less, is called a motif. A riff is a motif repeated. A melody is a motif repeated and then changed. Almost nothing memorable is a string of new ideas.' },
      { demo: { prog: 'I V vi IV', motif: '1 - 3 5 - 3 - -', note: 'One bar, repeated and moved to fit each chord: the rhythm and the shape stay, the notes shift to the nearest chord tones.' } },
      { p: 'The usual plan for four bars: <b>say it, say it again, say it again, answer it</b>. The answer keeps something (often the rhythm of the first notes) and changes the ending.' },
      { demo: { prog: 'I V vi IV', riff: '1 - 3 5 - 3 - - | 7, - 2 5 - 2 - - | 1 - 3 6 - 3 - - | 1 - 6, 4 3 2 1 -', note: 'Three statements and an answer that runs down to the home note.' } },
      { tip: 'The riff lab has a Repeat bar 1 button. Write one bar, press it, then edit the last bar.' },
    ],
    challenge: {
      target: 'riff', text: 'Write bar 1 and press Repeat bar 1. Then change the last bar so that it has a different rhythm: an answer.',
      check: (s) => { const r = barRhythms(s); return r.length >= 3 && r[0].includes('x') && r.filter((x) => x === r[0]).length >= 2 && r[r.length - 1].includes('x') && r[r.length - 1] !== r[0]; },
    },
  },
  {
    id: 'r5', track: 'riffs', title: 'Passing notes and rubs',
    sub: 'Notes outside the chord, and what to do with them',
    blocks: [
      { p: 'Between chord tones lie the other notes of the scale. Most of them are <b>colour</b>: they sound open and can be held. A few are <b>rubs</b>: they sit a half step above a chord tone and grind against it. The 4th of the key over the I chord is the famous one.' },
      { p: 'A rub is not a wrong note. It is tension, and tension is welcome if it lets go: <b>move it down one step</b> onto the chord tone below.' },
      { demo: { prog: 'I IV I IV', pattern: 'ring', riff: "3 - 4 - 3 - 1 - | 6 - 5 - 6 - 1' - | 5 - 4 - 3 - - - | 4 - 3 - 4 - - -", note: 'Bar 1: the 4 rubs against the I chord for one beat and falls back to the 3. Bar 3: the same rub as a passing note on the way down.' } },
      { p: 'The simple rule: chord tones on the strong beats, anything from the scale on the way between them, and never stop on a rub.' },
      { tip: 'In the riff lab, a note you place turns orange when it rubs. The checklist under the grid tells you whether it resolves.' },
    ],
    challenge: {
      target: 'riff', text: 'Use at least one rubbing note (orange), and resolve every one of them by a step.',
      check: (s) => { const r = rubs(s); return r.total >= 1 && r.hanging === 0; },
    },
  },
  {
    id: 'r6', track: 'riffs', title: 'Indie: drones and ringing notes',
    sub: 'One note stays while everything moves',
    blocks: [
      { p: 'A lot of indie guitar is built on a simple idea: pick a pattern of two or three notes, <b>keep the top note the same through every chord</b>, and let everything ring. On guitar the constant note is often an open string.' },
      { demo: { prog: 'I iii IV iv', pattern: 'ring', gen: { style: 'indie', seed: 11 }, bpm: 104, note: 'The high note never moves. Over each chord it means something else: a chord tone here, an add9 or a sus there.' } },
      { p: 'The other ingredients: constant 8th notes, the same picking pattern in every bar, and a low voice that moves to the nearest note of the next chord rather than jumping.' },
      { demo: { prog: 'Iadd9 V vi7 IVmaj7', pattern: 'ring', gen: { style: 'indie', seed: 4 }, bpm: 112, note: 'Another one. The chords only ring once per bar: the riff does the strumming.' } },
      { tip: 'Press Indie in the riff lab for a new idea over your own chords. Then make it yours: move the low notes, thin out the pattern.' },
    ],
    challenge: {
      target: 'riff', text: 'Keep one note ringing: the same pitch must appear at least twice in every bar, with at least two other pitches moving around it.',
      check: (s) => {
        const bars = Math.floor(s.riff.length / STEPS_PER_BAR);
        if (bars < 2) return false;
        let common = null;
        for (let b = 0; b < bars; b++) {
          const c = {};
          for (const o of s.riff.slice(b * STEPS_PER_BAR, (b + 1) * STEPS_PER_BAR)) if (o != null) c[o] = (c[o] || 0) + 1;
          const twice = Object.keys(c).filter((k) => c[k] >= 2);
          common = common ? common.filter((k) => twice.includes(k)) : twice;
        }
        return common.length > 0 && new Set(s.riff.filter((o) => o != null)).size >= 3;
      },
    },
  },
  {
    id: 'r7', track: 'riffs', title: 'Pop: the hook',
    sub: 'Few notes, small range, one rhythm',
    blocks: [
      { p: 'A pop hook is something a crowd can sing back after one hearing. So it is small: <b>three to five different notes</b>, mostly neighbours, inside one octave, in <b>one rhythm that repeats</b>.' },
      { demo: { prog: 'vi IV I V', gen: { style: 'pop', seed: 8 }, note: 'A generated hook. Count the different notes: there are very few.' } },
      { p: 'It lands on a chord tone at the start of each bar, and the last bar answers the first three. The longest note usually comes last, so the phrase can breathe.' },
      { demo: { prog: 'I V vi IV', gen: { style: 'pop', seed: 21 }, bpm: 108, note: 'Another hook, same rules, different rhythm.' } },
      { tip: 'Sing your riff. If you cannot sing it, it is a guitar part, which is fine. If you can, it may be your chorus.' },
    ],
    challenge: {
      target: 'riff', text: 'Write a hook: at least six notes, no more than five different pitches, all within an octave, with a rhythm that repeats in at least two bars.',
      check: (s) => { const o = riffNotes(s).map((x) => x.offset); return o.length >= 6 && new Set(o).size <= 5 && Math.max(...o) - Math.min(...o) <= 12 && sharedRhythm(s) >= 2; },
    },
  },
  {
    id: 'r8', track: 'riffs', title: 'Jazzy: guide tones and approach notes',
    sub: 'Spell out the chords, and slide into them',
    blocks: [
      { p: 'A jazz line makes you hear the chords even with no one playing them. Its secret is the <b>guide tones</b>: the 3rd and the 7th of each chord. Start each chord on one of them.' },
      { demo: { prog: 'ii7 V7 Imaj7 VI7', pattern: 'jazz', riff: '1 - - - - - - - | 7, - - - - - - - | 7, - - - - - - - | ♯1 - - - - - - -', bpm: 100, note: 'Guide tones alone: one note per chord, its 3rd or its 7th. The line hardly moves, a step at most, and still you can hear every chord change in it.' } },
      { p: 'The second ingredient is the <b>approach note</b>: just before a chord changes, play the note a half step below your next target. It is outside the key for an instant, and resolves at once.' },
      { demo: { prog: 'ii7 V7 Imaj7 VI7', pattern: 'jazz', gen: { style: 'jazz', seed: 5 }, bpm: 100, note: 'Guide tones on the changes, the chord run up or down in between, an approach note at the end of each bar. Swing does the rest.' } },
      { tip: 'Set the riff lab to All notes to see the notes outside the key. Used on the last 8th note of a bar, a half step from where you land, they sound deliberate.' },
    ],
    challenge: {
      target: 'riff', text: 'Start at least three chords on their 3rd or 7th, and use one note from outside the key that moves a half step to the next note.',
      start: { prog: 'ii7 V7 Imaj7 VI7', pattern: 'jazz', mode: 'major' },
      check: (s) => {
        const at = chordSteps(s);
        let starts = 0;
        at.forEach((ci, step) => {
          if ((step === 0 || at[step - 1] !== ci) && s.riff[step] != null && guideTones(s.chords[ci]).some((g) => mod12(g) === mod12(s.riff[step]))) starts++;
        });
        const n = riffNotes(s);
        const approach = n.some((x, i) => !SCALES[s.mode].includes(mod12(x.offset)) && n[i + 1] && Math.abs(n[i + 1].offset - x.offset) === 1);
        return starts >= Math.min(3, s.chords.length) && approach;
      },
    },
  },
  {
    id: 'r9', track: 'riffs', title: 'Put it together',
    sub: 'From a loop to a part of a song',
    blocks: [
      { p: 'You have the whole toolkit. A way to work when you sit down with the guitar:' },
      { p: '<b>1. Loop your chords</b> and listen a few times before you play anything.<br><b>2. Find a rhythm</b> on one note. Tap it, mute the strings and strum it.<br><b>3. Put chord tones on beats 1 and 3.</b><br><b>4. Fill between them</b> with pentatonic notes, moving by step.<br><b>5. Repeat the bar</b> and let the chords change under it. Adjust only the notes that rub.<br><b>6. Answer it</b> in the last bar.<br><b>7. Season to taste:</b> a drone for indie, fewer notes for pop, guide tones and an approach note for jazz.' },
      { demo: { prog: 'Imaj7 iii7 IVmaj7 iv7', pattern: 'ring', bpm: 96, riff: '3 - - 5 - - 3 - | 3 - - 5 - - 3 - | 3 - - 6 - - 3 - | ♭3 - - ♭6 - 5 4 -', note: 'All of it at once: one rhythm, a note that stays for three bars, chord tones on the strong beats, two borrowed notes over the minor four, and an answer that walks down.' } },
      { tip: 'When a riff works, play it on the guitar from the tab, then save it in My ideas. Then write a second loop for the other part of the song.' },
    ],
    challenge: {
      target: 'riff', text: 'Write a riff of at least eight notes that you like. The checklist under the grid must show no red marks.',
      check: (s) => { const r = riffReport(s); return r.count >= 8 && r.lines.every((l) => l.ok !== false); },
    },
  },
];

export const TRACKS = [
  { id: 'chords', name: 'Chord progressions', mark: 'C' },
  { id: 'riffs', name: 'Riffs and melodies', mark: 'R' },
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id);
export const lessonNumber = (l) => LESSONS.filter((x) => x.track === l.track).indexOf(l) + 1;
/** The first lesson not done yet, or null when all are. */
export const nextLesson = (done) => LESSONS.find((l) => !done.includes(l.id)) || null;

/** Ready-made loops for the chord builder. */
export const PRESETS = [
  { style: 'Pop', prog: 'I V vi IV', pattern: 'pop', name: 'The four chords' },
  { style: 'Pop', prog: 'vi IV I V', pattern: 'pop', name: 'Started on vi' },
  { style: 'Pop', prog: 'I vi IV V', pattern: 'pop', name: 'Doo-wop' },
  { style: 'Pop', prog: 'IV V iii vi', pattern: 'pop', name: 'Royal road' },
  { style: 'Indie', prog: 'I iii IV iv', pattern: 'arp', name: 'Minor four' },
  { style: 'Indie', prog: 'Iadd9 V vi7 IVmaj7', pattern: 'eighths', name: 'Shimmer' },
  { style: 'Indie', prog: 'I ♭VII IV I', pattern: 'eighths', name: 'Flat seven' },
  { style: 'Indie', prog: 'IV I V vi', pattern: 'eighths', name: 'Never settles' },
  { style: 'Jazzy', prog: 'ii7 V7 Imaj7 VI7', pattern: 'jazz', name: 'Two five one' },
  { style: 'Jazzy', prog: 'Imaj7 vi7 ii7 V7', pattern: 'jazz', name: 'Turnaround' },
  { style: 'Jazzy', prog: 'IVmaj7 iii7 ii7 V7', pattern: 'jazz', name: 'Walk down' },
  { style: 'Jazzy', prog: 'Imaj7 ♯i°7 ii7 V7', pattern: 'jazz', name: 'Passing diminished' },
  { style: 'Minor', mode: 'minor', prog: 'i ♭VI ♭III ♭VII', pattern: 'pop', name: 'Minor four chords' },
  { style: 'Minor', mode: 'minor', prog: 'i ♭VII ♭VI V', pattern: 'eighths', name: 'Walk down to V' },
  { style: 'Minor', mode: 'minor', prog: 'i iv ♭VII ♭III', pattern: 'arp', name: 'Circle' },
  { style: 'Minor', mode: 'minor', prog: 'i7 iv7 ♭VImaj7 V7', pattern: 'jazz', name: 'Minor jazz' },
];
