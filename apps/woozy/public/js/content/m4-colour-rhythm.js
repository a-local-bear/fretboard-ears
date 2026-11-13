// Module 4 — Colour: extensions, voice leading, embellishment.
// Module 5 — Rhythm and feel.

import { QUIZ } from '../ui/quiz.js';
import { ul } from './helpers.js';

export const colour = [
  {
    id: 'extensions',
    title: 'Extensions: 9ths, 6ths, sus and add',
    minutes: 20,
    summary: 'The finishing colours — and which ones suit which chords.',
    blocks: [
      { t: 'p', html: `<p>Sevenths got you the sound. <b>Extensions</b> — 9ths, 11ths, 13ths, plus 6ths, sus and add chords — are the finishing colours. You do not need new theory for each one. Think of them as upgrades inside three families:</p>
        <table class="table"><thead><tr><th>Family</th><th>Upgrade from</th><th>Try</th></tr></thead><tbody>
        <tr><td><b>Major</b> (I, IV)</td><td>maj7</td><td><b>maj9</b> airier · <b>6/9</b> sunny, no 7th · <b>add9</b> pop-pretty · <b>6</b> vintage · <b>maj7♯11</b> shimmering, lovely on IV</td></tr>
        <tr><td><b>Minor</b> (ii, iii, vi, i)</td><td>m7</td><td><b>m9</b> lush, <i>the</i> neo-soul chord · <b>m11</b> open and modern · <b>m6</b> bittersweet, Dorian · <b>m(add9)</b></td></tr>
        <tr><td><b>Dominant</b> (V and friends)</td><td>7</td><td><b>9</b> funky · <b>13</b> smooth · <b>7sus4</b> gentle · <b>7♯9</b> gritty, the Hendrix chord</td></tr>
        </tbody></table>` },
      {
        t: 'chords', title: 'Movable shapes, root on the 5th string',
        items: [
          { name: 'Cmaj9', frets: 'x3243x' }, { name: 'C6/9', frets: 'x32233' }, { name: 'Cm9', frets: 'x3133x' }, { name: 'Cm11', frets: 'x3334x' },
          { name: 'C9', frets: 'x3233x' }, { name: 'C13', frets: 'x32335' }, { name: 'C7#9', frets: 'x3234x' },
        ],
        caption: 'Notice the family resemblance: Cmaj9, C9 and Cm9 differ by one fret each, exactly like maj7 / 7 / m7 did.',
      },
      {
        t: 'chords', title: 'Movable shapes, root on the 6th string',
        items: [
          { name: 'Gmaj9', frets: '3x4435' }, { name: 'G6/9', frets: '322233' }, { name: 'Gm9', frets: '3x3335' }, { name: 'Gm11', frets: '3x331x' }, { name: 'G13', frets: '3x345x' },
        ],
      },
      {
        t: 'chords', title: 'Open-position gems',
        items: [
          { name: 'Cadd9', frets: 'x32033' }, { name: 'Em9', frets: '022032' }, { name: 'Fmaj7#11', frets: 'xx3200' }, { name: 'Em(add9)', frets: '024000' },
          { name: 'Asus2', frets: 'x02200' }, { name: 'Dsus2', frets: 'xx0230' }, { name: 'A7sus4', frets: 'x02030' }, { name: 'E7sus4', frets: '020200' },
        ],
      },
      { t: 'h', text: 'Upgrade a progression' },
      {
        t: 'prog', key: 'C', pattern: 'soul', groove: 'soul', bpm: 80, prefer: 'movable', title: 'Same roots, richer chords',
        variants: [
          { label: 'Plain 7ths', prog: 'ii7 | V7 | Imaj7 | %' },
          { label: 'Extended', prog: 'ii9 | V13 | Imaj9 | I6/9', caption: 'Same roots, same jobs — just more colour on top.' },
        ],
      },
      {
        t: 'prog', key: 'C', pattern: 'arp', title: 'The ♯11 shimmer on IV',
        variants: [
          { label: 'IVmaj7', prog: 'Imaj7 | IVmaj7' },
          { label: 'IVmaj7♯11', prog: 'Imaj7 | IVmaj7#11', caption: 'The ♯11 of the IV chord is just the 7th note of the key, so it stays “inside” while sounding like sunlight on water.' },
        ],
      },
      { t: 'h', text: 'Sus chords: motion without changing chord' },
      { t: 'p', html: `<p><b>sus2</b> and <b>sus4</b> replace the 3rd with its neighbour, so the chord is neither major nor minor — open, unresolved, very indie. Flicking between a chord and its sus versions gives a part <i>movement</i> while the harmony stays put.</p>` },
      {
        t: 'prog', pattern: 'quarters', groove: 'bedroom', bpm: 92, title: 'Sus flicks on D and A',
        abs: [
          { name: 'Dsus4', frets: 'xx0233', beats: 1 }, { name: 'D', frets: 'xx0232', beats: 1 }, { name: 'Dsus2', frets: 'xx0230', beats: 1 }, { name: 'D', frets: 'xx0232', beats: 1 },
          { name: 'Asus4', frets: 'x02230', beats: 1 }, { name: 'A', frets: 'x02220', beats: 1 }, { name: 'Asus2', frets: 'x02200', beats: 1 }, { name: 'A', frets: 'x02220', beats: 1 },
        ],
      },
      { t: 'callout', kind: 'tip', html: `<p>You cannot hold every note of a 13th chord on a guitar, and you should not try. <b>Drop the 5th first, then the root</b> (the bass has it). The 3rd, the 7th and the colour note are the whole chord.</p>` },
      {
        t: 'quiz', title: 'Check: which colour where?', count: 5,
        gen: QUIZ.fixed([
          { q: 'Which extension gives a minor chord that lush neo-soul sound?', choices: ['m9', 'm7♭5', 'sus4', '7♯9'], answer: 0, explain: 'Minor 7 plus the 9th on top. Dm9, Am9, Em9 …' },
          { q: 'You want the IV chord to shimmer. Which chord?', choices: ['IVmaj7♯11', 'IV7♯9', 'iv6', 'IVsus4'], answer: 0, explain: 'The ♯11 over IV is the 7th of the key — bright and floating.' },
          { q: 'A sus4 chord replaces which note?', choices: ['The 3rd', 'The root', 'The 5th', 'The 7th'], answer: 0, explain: 'No 3rd means it is neither major nor minor until it resolves.' },
          { q: 'Voicing a 13th chord on guitar, which note do you drop first?', choices: ['The 5th', 'The 3rd', 'The 7th', 'The 13th'], answer: 0, explain: 'The 5th adds the least. Never drop the 3rd or 7th — they define the chord.' },
          { q: 'Which is the softer stand-in for V7?', choices: ['V7sus4', 'V7♯9', 'viiø7', '♭II7'], answer: 0, explain: 'The sus4 removes the chord\'s most restless note, the 3rd.' },
          { q: '6/9 chords belong to which family?', choices: ['Major', 'Minor', 'Dominant', 'Diminished'], answer: 0, explain: 'A major triad plus the 6th and 9th — no 7th at all.' },
        ]),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play ii9 – V13 – Imaj9 in C, then in F (root-6 shapes) and in G.',
        'Take a Imaj7 – IVmaj7 vamp. Each time round, change exactly one chord to an extension from its family.',
        'Explore: the <a href="#/chords">Chord Library</a> shows every shape for every chord in this lesson, in any key.',
      ) },
    ],
  },

  {
    id: 'voice-leading',
    title: 'Voice leading: move as little as possible',
    minutes: 15,
    summary: 'Why two guitarists playing the same chords can sound completely different.',
    blocks: [
      { t: 'p', html: `<p>Two guitarists play the same four chords. One sounds like a chord chart; the other sounds like a record. The difference is usually <b>voice leading</b>: moving each note of a chord to the <i>nearest</i> note of the next chord, instead of jumping the whole shape around the neck.</p>` },
      { t: 'h', text: 'Guide tones: the 3rd and the 7th' },
      { t: 'p', html: `<p>The 3rd and 7th are the notes that say what a chord <i>is</i>; the root and 5th are scaffolding. In a ii–V–I they do something beautiful: <b>the 7th of each chord falls one fret to become the 3rd of the next.</b></p>` },
      {
        t: 'prog', pattern: 'ring', groove: 'bedroom', bpm: 76, title: 'Shell voicings: root, 3rd, 7th',
        abs: [
          { name: 'Dm7', frets: 'x535xx' }, { name: 'G7', frets: '3x34xx' }, { name: 'Cmaj7', frets: 'x324xx', beats: 8 },
        ],
        caption: 'Watch the D and G strings. Dm7 → G7: one note drops a fret. G7 → Cmaj7: the other one does. That is the whole progression.',
      },
      { t: 'h', text: 'Stay in one place' },
      {
        t: 'prog', pattern: 'lazy', groove: 'bedroom', title: 'Same chords: jumpy versus smooth',
        variants: [
          { label: 'Jumpy', abs: [{ name: 'Dm7', frets: '10-x-10-10-10-x' }, { name: 'G7', frets: '3x343x' }, { name: 'Cmaj7', frets: '8x998x', beats: 8 }], caption: 'Every chord uses a root-on-the-6th-string shape, so the hand leaps from fret 10 to 3 to 8.' },
          { label: 'Smooth', abs: [{ name: 'Dm7', frets: 'x57565' }, { name: 'G7', frets: '3x343x' }, { name: 'Cmaj7', frets: 'x35453', beats: 8 }], caption: 'Alternating root-5 and root-6 shapes: nothing leaves frets 3–7.' },
        ],
      },
      { t: 'p', html: `<p>The practical rule: when the next root is a 4th up (ii → V, V → I, I → IV), <b>switch between a 5th-string-root shape and a 6th-string-root shape near the same fret</b> rather than sliding one shape along the neck. The progression player in this app picks voicings this way automatically.</p>` },
      { t: 'h', text: 'Common tones on top' },
      { t: 'p', html: `<p>A classic dream-pop trick: keep the top note or two <b>the same</b> while the chords move underneath. The repeated high notes glue everything together and make simple changes sound enormous. The easiest version uses the open B and high-E strings as drones, in the key of E:</p>` },
      {
        t: 'prog', pattern: 'eighths', groove: 'jangle', bpm: 116, title: 'Open-string drones in E',
        abs: [
          { name: 'E', frets: '022100' }, { name: 'F#m11', frets: '244200' }, { name: 'Aadd9', frets: '577600' }, { name: 'Badd11', frets: '799800' },
        ],
        caption: 'One three-finger shape slides up the neck while the top two strings ring open the whole time.',
      },
      {
        t: 'prog', pattern: 'arp', groove: 'bedroom', title: 'A held note between two chords',
        abs: [{ name: 'Cmaj7', frets: 'x32000' }, { name: 'Fmaj7', frets: 'xx3210' }],
        caption: 'The open high E is the 3rd of C and the 7th of F. It rings straight through the change.',
      },
      {
        t: 'quiz', title: 'Check: voice leading', count: 5,
        gen: QUIZ.fixed([
          { q: 'In <b>ii7 → V7</b>, the 7th of the ii chord moves…', choices: ['down one fret, to become the 3rd of V', 'up a fifth', 'nowhere — it is the root of V', 'down a whole step to the 5th of V'], answer: 0, explain: 'Dm7 → G7: C (♭7 of Dm) falls to B (3rd of G).' },
          { q: 'Which two notes define a chord\'s quality?', choices: ['The 3rd and the 7th', 'The root and the 5th', 'The root and the 3rd', 'The 5th and the 9th'], answer: 0, explain: 'They are called guide tones. Root and 5th can be left to the bass.' },
          { q: 'Your ii chord has its root on the 5th string. For smooth voice leading, where is the V shape?', choices: ['Root on the 6th string, around the same fret', 'Root on the 5th string, 5 frets higher', 'Root on the 6th string, 7 frets higher', 'In open position'], answer: 0, explain: 'A 4th up = same fret, next string down. No travel.' },
          { q: '<b>Dm7 → G7</b>: which note do the two chords share?', choices: ['F', 'C', 'B', 'A'], answer: 0, explain: 'Dm7 = D F A C. G7 = G B D F. F (and D) are in both.' },
          { q: '<b>Cmaj7 → Fmaj7</b>: which note can stay on top through the change?', choices: ['E', 'B', 'G', 'D'], answer: 0, explain: 'E is the 3rd of Cmaj7 and the 7th of Fmaj7.' },
        ]),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play the three shell voicings above, then move the whole cluster to other keys.',
        'Take Imaj7 – vi7 – ii7 – V7 in G and find the version where your hand moves least.',
        'Pick any loop you like and find one note that can stay on top of all its chords.',
      ) },
    ],
  },

  {
    id: 'embellish',
    title: 'Embellishments: make one chord sound like five',
    minutes: 20,
    summary: 'Slides, sus hammer-ons, pinky melodies and double-stop fills.',
    blocks: [
      { t: 'p', html: `<p>A chord does not have to sit still. The players you are chasing decorate constantly — a slide here, a hammer-on there, a little melody on the top string — so that one chord per bar sounds like a living part.</p>` },
      { t: 'h', text: '1 · Slide into it' },
      { t: 'p', html: `<p>Play the shape one fret below your target and slide the whole thing up into place just before the beat. Any movable shape works; maj7 and m7 shapes love it.</p>` },
      {
        t: 'prog', pattern: 'ring', groove: 'bedroom', bpm: 80, title: 'Approach from a fret below',
        abs: [
          { name: 'Amaj7', frets: '5x665x', beats: 3.5 }, { name: 'C#maj7', frets: 'x46564', beats: 0.5 },
          { name: 'Dmaj7', frets: 'x57675', beats: 3.5 }, { name: 'G#maj7', frets: '4x554x', beats: 0.5 },
        ],
        caption: 'The half-beat chords are the same shapes one fret low. On a real guitar, pick once and slide.',
      },
      { t: 'h', text: '2 · Sus hammer-ons' },
      { t: 'p', html: `<p>Inside an open chord, hammer onto (or pull off from) the note next to the 3rd. It is the same sus2 / sus4 idea from the extensions lesson, turned into a little rhythmic figure.</p>` },
      {
        t: 'tab', bpm: 76, title: 'Hammer-ons and pull-offs on D and A',
        tab: '4/0+3/2+2/3+1/0:1 1/2h:1 2/3:1 3/2:1 4/0+3/2+2/3+1/3:1 1/2p:1 2/3:1 3/2:1 | 5/0+4/2+3/2+2/0:1 2/2h:1 3/2:1 4/2:1 5/0+4/2+3/2+2/3:1 2/2p:1 3/2:1 4/2:1',
        caption: 'Bar 1: Dsus2 → hammer to D, then Dsus4 → pull off to D. Bar 2: the same idea on A. (h = hammer-on, p = pull-off.)',
      },
      { t: 'h', text: '3 · A melody on top of the chord' },
      { t: 'p', html: `<p>Hold the chord and use a free finger — usually the pinky — for notes on the top string. With maj7 shapes, the notes one or two frets above the chord's top note are nearly always in the scale.</p>` },
      {
        t: 'tab', bpm: 80, title: 'Top-string melody over Amaj7 → Dmaj7',
        tab: '5/0+4/2+3/1+2/2+1/0:2 1/0:1 1/2:1 1/4:2 1/2:2 | 4/0+3/2+2/2+1/2:2 1/2:1 1/4:1 1/5:2 1/4:2',
        caption: 'Strum the chord, keep it held, and let the high-e string sing: E F♯ G♯ F♯ over Amaj7, then F♯ G♯ A G♯ over Dmaj7.',
      },
      { t: 'h', text: '4 · Double-stop fills' },
      { t: 'p', html: `<p>Between chords, play two notes at once — 3rds and 4ths on neighbouring strings, taken from the scale around the chord shape. This is the Hendrix and Curtis Mayfield school that neo-soul guitar grew out of.</p>` },
      {
        t: 'tab', bpm: 78, title: 'Double-stops around G and C',
        tab: '6/3+4/5+3/4+2/3:2 2/3+1/3:1 2/5+1/5:1 2/3+1/3:2 4/4+3/4:1 4/5+3/4:1 | 5/3+4/5+3/5+2/5:2 2/5+1/5:1 2/8+1/8:1 2/5+1/5:2 4/5+3/5:1 4/7+3/5:1',
        caption: 'Chord, then a little conversation in two-note shapes. Same-fret pairs on the top two strings are 4ths — they sound good almost anywhere in the pentatonic scale.',
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Take any two-chord vamp and give each chord one decoration: a slide in, a hammer-on, or a top-string note.',
        'Loop G – C and improvise fills using only two-note shapes on the top three strings.',
        'Less is more: one decoration per bar, in the same place each time, sounds like a <i>part</i>. Decorations everywhere sound like noodling.',
      ) },
    ],
  },
];

export const rhythm = [
  {
    id: 'strumming',
    title: 'Strumming, pocket and the push',
    minutes: 15,
    summary: 'Same chords, different rhythm, different song.',
    blocks: [
      { t: 'p', html: `<p>Play the same two chords with a different rhythm and you have written a different song. In this genre the strumming hand matters as much as the fretting hand — arguably more.</p>` },
      { t: 'h', text: 'The pendulum' },
      { t: 'p', html: `<p>Keep your strumming hand swinging down-up in steady 8th notes — <b>down on the beat, up on the “and”</b> — whether or not it touches the strings. Every strum pattern is just a choice of which swings connect. That is why your hand never gets lost.</p>` },
      { t: 'rhythm', key: 'A', prog: 'Imaj7 | IVmaj7', patterns: ['quarters', 'eighths', 'classic', 'lazy'], pattern: 'quarters', title: 'Strum lab: the basics', caption: 'Count along: “1 e and a 2 e and a…”. Arrows show which swings hit the strings.' },
      { t: 'h', text: 'Syncopation: lean on the “ands”' },
      { t: 'p', html: `<p>A pattern feels laid-back and groovy when the hits land <b>off</b> the beat and the strong beats are left empty. Compare “Quarter notes” with “Lazy &amp; syncopated” above: fewer strums, more groove.</p>` },
      { t: 'h', text: 'The push' },
      { t: 'p', html: `<p>The most important feel trick in the book: <b>change chord an 8th note early</b> — on the “and” of 4 — and hold it across the barline. The whole band seems to lean forward. Once you can hear it, you will notice it in nearly every song you love.</p>` },
      { t: 'rhythm', key: 'A', prog: 'Imaj7 | IVmaj7 | ii7 | V7sus4', patterns: ['classic', 'push'], pattern: 'push', title: 'Without and with the push' },
      { t: 'h', text: 'Short and long' },
      { t: 'p', html: `<p>Let chords ring and you get dream pop. Cut them short — relax the fretting hand right after the strum — and you get funk and neo-soul. Short “stabs” leave air for the bass and drums to speak.</p>` },
      { t: 'rhythm', key: 'E', mode: 'minor', prog: 'i9 | IV9', patterns: ['ring', 'skank', 'backbeat', 'soul', 'funk'], pattern: 'soul', groove: 'soul', bpm: 84, title: 'Stabs and scratches' },
      { t: 'callout', kind: 'tip', title: 'Tempo guide', html: ul(
        '<b>Mac DeMarco-style jangle:</b> 80–110 bpm, straight 8ths, light touch.',
        '<b>Men I Trust-style glide:</b> 90–115 bpm, steady and soft.',
        '<b>Steve Lacy-style neo-soul:</b> 70–95 bpm, swung 16ths, clipped chords.',
        '<b>King Krule:</b> anywhere, often slow and deliberately loose.',
      ) },
      { t: 'callout', kind: 'ear', title: 'Swing', html: `<p>Swing means the off-beat 16th notes arrive <b>late</b>. Switch the band to “Neo-soul (swung)” or “Boom-bap” to hear it. Then try playing very slightly behind the beat yourself. Laid-back does not mean sloppy — it means late on purpose, and consistently.</p>` },
      {
        t: 'quiz', title: 'Check: rhythm words', count: 5,
        gen: QUIZ.fixed([
          { q: '“The push” means…', choices: ['changing chord an 8th note early and holding it over the barline', 'strumming harder on beat 1', 'speeding up into the chorus', 'muting the strings on beat 4'], answer: 0, explain: 'The new chord arrives on the “and” of 4 instead of on 1.' },
          { q: 'Syncopation is…', choices: ['accenting the off-beats', 'playing every 16th note', 'strumming only down-strokes', 'a kind of chord'], answer: 0, explain: 'Hits on the “ands”, space on the strong beats.' },
          { q: 'To play a stab, you…', choices: ['relax your fretting hand right after the strum', 'strum more slowly', 'use a thicker pick', 'only play the bass strings'], answer: 0, explain: 'Releasing pressure stops the strings ringing without lifting off them.' },
          { q: 'In the pendulum method, up-strums land on…', choices: ['the “ands”', 'the beats', 'beat 1 only', 'wherever feels right'], answer: 0, explain: 'Down on 1 2 3 4, up on every “and”, always.' },
          { q: 'Swing means the off-beat 16th notes are played…', choices: ['late', 'early', 'louder', 'twice'], answer: 0, explain: 'Long–short instead of even. The later, the heavier the swing.' },
        ]),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play along with each pattern in the first strum lab until you can hold it without looking.',
        'Take a loop you like and play it with the push for four bars, then without for four bars. Decide which the song wants.',
        'Mute the strings with your fretting hand and strum the “16th scratch” pattern as pure percussion.',
      ) },
    ],
  },

  {
    id: 'space',
    title: 'Arpeggios, chops and space',
    minutes: 10,
    summary: 'The fastest way to sound like a record is to play less.',
    blocks: [
      { t: 'p', html: `<p>The fastest way to sound like a record instead of a campfire is to <b>play less</b>. In a bedroom-pop arrangement the drums and bass carry the pulse. The guitar's job is colour.</p>` },
      { t: 'h', text: 'Arpeggios' },
      { t: 'p', html: `<p>Pick the chord one note at a time: the bass note first, then roll through the top strings. Slow tempo, major 7th chords and a chorus pedal — that is dream pop in one sentence.</p>` },
      { t: 'rhythm', key: 'C', prog: 'Imaj7 | iii7 | IVmaj7 | iv6', patterns: ['arp', 'arpSlow', 'ring'], pattern: 'arp', bpm: 80, title: 'Arpeggio lab' },
      { t: 'h', text: 'Leave holes' },
      { t: 'p', html: ul(
        'Strum <b>once</b> and let it ring for the whole bar.',
        'Play short chords only on <b>beats 2 and 4</b>, with the snare.',
        'Sit out the first half of a verse entirely. Come in when the vocal needs lifting.',
        'Instead of chords, double the bass line an octave up with palm muting.',
      ) },
      {
        t: 'prog', key: 'G', groove: 'dream', bpm: 100, title: 'One progression, four densities',
        variants: [
          { label: 'Busy', prog: 'Imaj7 | vi7 | IVmaj7 | V7sus4', pattern: 'eighths', caption: 'Fine on its own. Tiring under a vocal.' },
          { label: 'Ringing', prog: 'Imaj7 | vi7 | IVmaj7 | V7sus4', pattern: 'ring', caption: 'One strum per bar. The band does the rest.' },
          { label: 'Chops', prog: 'Imaj7 | vi7 | IVmaj7 | V7sus4', pattern: 'backbeat', caption: 'Short chords on 2 and 4 only.' },
          { label: 'Arpeggio', prog: 'Imaj7 | vi7 | IVmaj7 | V7sus4', pattern: 'arp', caption: 'Single notes: all the harmony, none of the weight.' },
        ],
      },
      { t: 'callout', kind: 'tip', title: 'The mute test', html: `<p>Imagine your guitar part muted. If the song still works, the part was optional — so make it smaller and give it more character. If the song falls apart, the part is probably doing too much.</p>` },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play a loop for four bars busy, four bars sparse. Record it and listen to which half makes you want to sing.',
        'Arpeggiate Imaj7 – IVmaj7 slowly, picking only strings you choose in advance. Make the pattern a hook.',
      ) },
    ],
  },
];
