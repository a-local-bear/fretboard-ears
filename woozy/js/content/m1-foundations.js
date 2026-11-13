// Module 1 — The map: keys, numbers, and what chords do.
// Module 2 — Seventh chords: the sound, the shapes, the small voicings.

import { QUIZ } from '../ui/quiz.js';
import { jobs, ul } from './helpers.js';

export const foundations = [
  {
    id: 'numbers',
    title: 'Keys and the number system',
    minutes: 15,
    summary: 'Stop thinking in chord names. Start thinking in numbers that work in every key.',
    blocks: [
      { t: 'p', html: `<p>You already know chords as shapes with names — G, Em, C, D. Songwriters think one level up: in <b>numbers</b>. A song is a pattern of numbers, and the key just decides which chords those numbers mean today. Learn a pattern once and you can play it, move it, or bend it in any key.</p>` },
      { t: 'h', text: 'Seven notes, seven chords' },
      { t: 'p', html: `<p>A major key is seven notes — the major scale. Build a chord on each note, using only notes from that scale, and you get a family of seven chords that always sound like they belong together. They get Roman numerals: <b>UPPERCASE for major</b> chords, <b>lowercase for minor</b>.</p>` },
      { t: 'keys', key: 'C', title: 'The seven chords of a key', caption: 'Tap a chord to hear it. Change the key and watch the names change while the numerals stay exactly where they are.' },
      { t: 'p', html: `<p>The pattern never changes: <b>major – minor – minor – major – major – minor – diminished</b>. So in every major key, <b>I, IV and V are major</b> and <b>ii, iii and vi are minor</b>. (The vii° is the odd one out — it's rarely used on its own, so park it for now.)</p>` },
      { t: 'h', text: 'Your fretboard already knows this' },
      { t: 'p', html: `<p>Because you know barre chords, you can find a whole key from one anchor point. Put the root of the <b>I</b> chord on the 6th string. Then:</p>${ul(
        '<b>IV</b> is on the <b>same fret, 5th string</b>. <b>V</b> is two frets above IV.',
        '<b>ii</b> is two frets above I on the 6th string. <b>iii</b> is two frets above that.',
        '<b>vi</b> is two frets above V on the 5th string — or three frets <i>below</i> I on the 6th.',
      )}<p>That little box of six roots is the same shape in every key. Move the box, change the key.</p>` },
      { t: 'rootmap', key: 'G', title: 'The root map' },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play <b>I – IV – V – IV</b> with barre chords in G, then A, then C. Say the numbers out loud as you change.',
        'Play <b>I – vi – IV – V</b> in the same three keys.',
        'Take a three- or four-chord song you already know and work out its numbers. From now on, that is how you remember songs.',
      ) },
      { t: 'quiz', title: 'Quick check: numbers ↔ chords', count: 6, gen: QUIZ.mix(QUIZ.degree(), QUIZ.numeral()) },
    ],
  },

  {
    id: 'functions',
    title: 'Home, away, tension',
    minutes: 15,
    summary: 'Every chord in a key has a job. Know the jobs and you can choose the next chord on purpose.',
    blocks: [
      { t: 'p', html: `<p>The chords in a key aren't equals. Each has a <b>job</b>, and knowing the job is what lets you <i>choose</i> the next chord instead of guessing.</p>${ul(
        '<b class="tag fn-T">Home</b> — the <b>I</b> chord. Rest, arrival. <b>vi</b> and <b>iii</b> share two of its three notes, so they work as softer, sadder versions of home.',
        '<b class="tag fn-S">Away</b> — <b>IV</b> and <b>ii</b>. Movement, opening up, leaving the house.',
        '<b class="tag fn-D">Tension</b> — <b>V</b>. Leans hard back towards home.',
      )}<p>Most progressions are a small trip: <b>home → away → tension → home</b>.</p>` },
      { t: 'prog', key: 'G', prog: 'I | IV | V | I', pattern: 'classic', title: 'The basic trip', caption: 'Card colours show the job: teal = home, gold = away, coral = tension.' },
      { t: 'h', text: 'Swap chords that do the same job' },
      { t: 'p', html: `<p>Any chord can be replaced by another one with the same job. <b>IV ↔ ii.</b> <b>I ↔ vi</b> (or iii). That single idea generates most of pop music:</p>` },
      {
        t: 'prog', key: 'G', pattern: 'classic', title: 'One family, six famous loops',
        variants: [
          { label: 'I–IV–V–I', prog: 'I | IV | V | I', caption: 'The original trip.' },
          { label: 'I–ii–V–I', prog: 'I | ii | V | I', caption: 'ii stands in for IV. Slightly softer “away”.' },
          { label: 'I–vi–IV–V', prog: 'I | vi | IV | V', caption: 'vi extends home before leaving. The 1950s doo-wop loop.' },
          { label: 'I–V–vi–IV', prog: 'I | V | vi | IV', caption: 'The four-chord pop loop. Tension resolves to the “sad home” instead of the real one.' },
          { label: 'vi–IV–I–V', prog: 'vi | IV | I | V', caption: 'The same four chords, started from vi. Suddenly it is melancholy.' },
          { label: 'I–iii–IV–V', prog: 'I | iii | IV | V', caption: 'iii as a stepping stone between I and IV.' },
        ],
      },
      { t: 'h', text: 'Where the loop starts is the mood' },
      { t: 'p', html: `<p>Loop-based songs have no real ending — the loop just comes round again. So the chord you <b>start</b> on, and the chord you linger on, sets the mood far more than the key does. Start on I and it's settled. Start on vi and it's wistful. Start on <b>IV</b> and it floats, never quite landing — a bedroom-pop favourite for exactly that reason.</p>` },
      {
        t: 'prog', key: 'C', pattern: 'lazy', title: 'Same chords, three moods',
        variants: [
          { label: 'Starts home', prog: 'I | V | vi | IV' },
          { label: 'Starts sad', prog: 'vi | IV | I | V' },
          { label: 'Starts floating', prog: 'IV | I | V | vi' },
        ],
      },
      {
        t: 'build', key: 'D', sevenths: false, title: 'Build a trip',
        prompt: 'In <b>D major</b>, build a four-chord trip: <b>home → away → tension → home</b>. Any chords with those jobs will do — try not to use the obvious ones.',
        check: jobs(['T', 'S', 'D', 'T']),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play I – IV – V – I in A. Now replace IV with ii. Now replace the last I with vi. Listen to how each swap changes the story.',
        'Loop the four chords of I – V – vi – IV, starting from each chord in turn. Which starting point sounds most like the music you want to make?',
      ) },
      {
        t: 'quiz', title: 'Check: jobs and loops', count: 6,
        gen: QUIZ.mix(QUIZ.job(), QUIZ.job(), QUIZ.progressionEar({ options: ['I | V | vi | IV', 'I | vi | IV | V', 'vi | IV | I | V'] })),
      },
    ],
  },
];

export const sevenths = [
  {
    id: 'sevenths',
    title: 'Seventh chords: the bedroom-pop sound',
    minutes: 15,
    summary: 'One extra note turns campfire chords into that dreamy, jazzy colour.',
    blocks: [
      { t: 'p', html: `<p>Here is the single biggest step from campfire to bedroom pop: <b>add one note</b>. Stack one more third on top of a triad and you get a <b>seventh chord</b>. Same effort for your hand, completely different mood.</p>` },
      {
        t: 'chords', title: 'Triad → seventh, one finger at a time',
        items: [
          { name: 'C', frets: 'x32010' }, { name: 'Cmaj7', frets: 'x32000', note: 'lift your index' },
          { name: 'Am', frets: 'x02210' }, { name: 'Am7', frets: 'x02010', note: 'lift your ring finger' },
          { name: 'G', frets: '320003' }, { name: 'G7', frets: '320001', note: 'top note down 2 frets' },
        ],
        caption: 'Tap each pair. The letters in the dots tell you which chord tone each finger is playing: R = root, 3, 5, 7.',
      },
      { t: 'h', text: 'Four flavours' },
      { t: 'p', html: `<table class="table"><thead><tr><th>Chord</th><th>Formula</th><th>Sounds like</th></tr></thead><tbody>
        <tr><td><b>maj7</b></td><td>1 3 5 7</td><td>Dreamy, wistful, sunlit. <i>The</i> bedroom-pop chord.</td></tr>
        <tr><td><b>m7</b></td><td>1 ♭3 5 ♭7</td><td>Mellow and warm — minor without the drama.</td></tr>
        <tr><td><b>7</b> (dominant)</td><td>1 3 5 ♭7</td><td>Bluesy and restless. Wants to go somewhere.</td></tr>
        <tr><td><b>m7♭5</b> (ø)</td><td>1 ♭3 ♭5 ♭7</td><td>Dark and unstable. A passing chord.</td></tr>
        </tbody></table>
        <p>The gap between <b>maj7</b> and <b>7</b> is a single fret. A 7th one fret below the root is dreamy; a 7th two frets below the root is bluesy. That one fret is the difference between Mac DeMarco and a 12-bar blues.</p>` },
      { t: 'h', text: 'Sevenths in a key' },
      { t: 'p', html: `<p>Apply this to the seven chords of a key and you always get: <b>Imaj7 · ii7 · iii7 · IVmaj7 · V7 · vi7 · viiø7</b>. The two dreamy maj7 chords are I and IV. The minor chords become m7. Only <b>V</b> becomes a dominant 7th — the one restless chord in the key, which is exactly why it pulls so hard towards home.</p>` },
      { t: 'keys', key: 'C', sevenths: true, title: 'Seventh chords in a key' },
      { t: 'h', text: 'Hear the difference' },
      {
        t: 'prog', key: 'C', pattern: 'lazy', title: 'Same progression, two worlds',
        variants: [
          { label: 'Triads', prog: 'I | vi | IV | V' },
          { label: 'Sevenths', prog: 'Imaj7 | vi7 | IVmaj7 | V7' },
          { label: 'Sevenths, soft V', prog: 'Imaj7 | vi7 | IVmaj7 | V7sus4', caption: 'V7 can sound a bit too bluesy for this style. V7sus4 keeps the tension but takes the edge off.' },
        ],
      },
      { t: 'quiz', title: 'Ear check: maj7, m7 or 7?', count: 6, gen: QUIZ.qualityEar() },
      { t: 'callout', kind: 'guitar', html: ul(
        'Take any song you know in C or G and swap every chord for its seventh (I and IV → maj7, minors → m7, V → 7).',
        'Notice which swaps you love and which you don\'t. A plain triad is still a colour — sevenths are a choice, not a rule.',
      ) },
    ],
  },

  {
    id: 'shapes',
    title: 'Six shapes that unlock everything',
    minutes: 20,
    summary: 'Movable maj7, m7 and 7 shapes with the root on the 6th and 5th strings.',
    blocks: [
      { t: 'p', html: `<p>Open-position sevenths are lovely, but the real unlock is six <b>movable</b> shapes: maj7, 7 and m7 with the root on the 6th string, and the same three with the root on the 5th string. With those you can play any seventh chord, in any key, anywhere on the neck.</p>` },
      { t: 'h', text: 'Root on the 6th string' },
      {
        t: 'chords',
        items: [
          { name: 'Gmaj7', frets: '3x443x', note: 'the dreamy one' },
          { name: 'G7', frets: '3x343x', note: '7th down a fret' },
          { name: 'Gm7', frets: '3x333x', note: '3rd down a fret' },
        ],
        caption: 'Four notes, no fat. Let the finger on the 6th string lean over and mute the 5th string.',
      },
      { t: 'p', html: `<p>Look at how little changes between them. <b>maj7 → 7:</b> the 7th drops one fret. <b>7 → m7:</b> the 3rd drops one fret. If you know which dot is the 3rd and which is the 7th, you never have to memorise a chord chart again — you just adjust.</p>` },
      { t: 'h', text: 'Root on the 5th string' },
      {
        t: 'chords',
        items: [
          { name: 'Cmaj7', frets: 'x35453', note: 'the dreamy one' },
          { name: 'C7', frets: 'x35353', note: '7th down a fret' },
          { name: 'Cm7', frets: 'x35343', note: '3rd down a fret' },
        ],
        caption: 'Same logic, different string set. The 7th is on the G string, the 3rd on the B string.',
      },
      { t: 'h', text: 'Why two sets? Because of this' },
      { t: 'p', html: `<p>Remember the root map: <b>I and IV live on the same fret</b> — I with its root on the 6th string, IV with its root on the 5th. V is two frets up from IV. So a whole key sits under your hand with no big jumps.</p>` },
      { t: 'prog', key: 'G', prog: 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7', prefer: 'movable', title: 'Same fret, two strings' },
      { t: 'prog', key: 'G', prog: 'ii7 | V7 | Imaj7 | %', prefer: 'movable', title: 'ii – V – I in one hand position', caption: 'Three chords, three shapes, barely any travel. Change the key and the whole cluster moves with you.' },
      { t: 'h', text: 'The open-position sevenths worth knowing' },
      {
        t: 'chords',
        items: ['Cmaj7', 'Fmaj7', 'Gmaj7', 'Dmaj7', 'Amaj7', 'Emaj7', 'Am7', 'Em7', 'Dm7', 'A7', 'E7', 'D7', 'B7'].map((name) => ({ name, prefer: 'open' })),
        caption: 'Mix these with the movable shapes. For anything else, look it up in the <a href="#/chords">Chord Library</a>.',
      },
      { t: 'quiz', title: 'Name that shape', count: 6, gen: QUIZ.shape() },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play <b>Imaj7 → IVmaj7</b> at frets 3, 5 and 7 (the keys of G, A and B).',
        'Play <b>ii7 – V7 – Imaj7</b> in G, C and F, naming each chord as you land on it.',
        'One-fret drill: Gmaj7 → G7 → Gm7 without moving position. Then the same from C on the 5th string.',
      ) },
    ],
  },

  {
    id: 'small',
    title: 'Small chords, big vibe',
    minutes: 15,
    summary: 'Top-string voicings and three-note triads that leave room for everything else.',
    blocks: [
      { t: 'p', html: `<p>You almost never need six strings. On a recording the bass has the root covered, and thick chords fight the vocal. Smaller voicings on the top strings sound sweeter, leave space, and free up fingers for little melodies. Steve Lacy's guitar parts are built almost entirely out of these.</p>` },
      { t: 'h', text: 'Four-string sevenths' },
      {
        t: 'chords',
        items: [
          { name: 'Fmaj7', frets: 'xx3555', note: 'open Dmaj7, moved up' },
          { name: 'F7', frets: 'xx3545', note: 'open D7, moved up' },
          { name: 'Fm7', frets: 'xx3544', note: 'open Dm7, moved up' },
        ],
        caption: 'Root on the 4th string. Your index finger does the job the open D string used to do.',
      },
      { t: 'h', text: 'Three-note triads on the top strings' },
      { t: 'p', html: `<p>Smaller still: plain triads on the G, B and high-e strings. Every chord lives in <b>three places</b> up the neck. Learn the three grips and there is always a chord within two frets of wherever your hand happens to be.</p>` },
      { t: 'triads', root: 'G', title: 'One chord, three places', caption: 'Flip to minor: in every grip, only the 3rd moves — down one fret.' },
      {
        t: 'prog', title: 'I – vi – IV – V almost without moving', pattern: 'lazy', groove: 'dream', bpm: 96,
        abs: [
          { name: 'G', frets: 'xxx433' }, { name: 'Em', frets: 'xxx453' }, { name: 'C', frets: 'xxx553' }, { name: 'D', frets: 'xxx775' },
        ],
        caption: 'G → Em: one note moves. Em → C: one note moves. That is voice leading, and there is a whole lesson on it later.',
      },
      { t: 'callout', kind: 'tip', html: `<p>When you play with a bass line (or the band in this app), try leaving the root out completely and just playing the top three strings of any shape you know. The chord gets lighter and clearer, not weaker.</p>` },
      { t: 'callout', kind: 'guitar', html: ul(
        'Find all three triad grips for C, F and G. Play I – IV – V in C using the grips that are closest together.',
        'Take the open-position Dmaj7 / D7 / Dm7 shapes and slide them to frets 3, 5, 7 and 10. Name each chord (the root is on the 4th string).',
        'Loop two chords with the band on and play only top-string voicings, as short stabs.',
      ) },
    ],
  },
];
