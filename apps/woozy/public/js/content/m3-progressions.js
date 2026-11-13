// Module 3 — Progressions with attitude: vamps, ii–V–I, minor & Dorian,
// borrowed chords, secondary dominants and chromatic glue.

import { QUIZ } from '../ui/quiz.js';
import { exactly, includes, ul } from './helpers.js';

export const progressions = [
  {
    id: 'vamps',
    title: 'The two-chord vamp',
    minutes: 15,
    summary: 'Most of this genre is two chords and a feeling. Learn to make two chords enough.',
    blocks: [
      { t: 'p', html: `<p>A secret of this whole genre: a lot of great songs barely <i>have</i> a chord progression. Two chords, round and round, for the whole verse — sometimes the whole song. The interest comes from the groove, the tone, and the melody on top. A busy progression leaves no room for any of that. So before four-chord loops, get good at two.</p>` },
      {
        t: 'prog', key: 'A', title: 'Six vamps, six moods', pattern: 'lazy', groove: 'bedroom',
        variants: [
          { label: 'I ↔ IV', prog: 'Imaj7 | IVmaj7', caption: '<b>The dreamy seesaw.</b> Two major 7ths; neither pulls anywhere. Pure Sunday afternoon.' },
          { label: 'ii ↔ V', prog: 'ii7 | V7', caption: '<b>Permanent anticipation.</b> It never lands on home, so it never stops leaning forward.' },
          { label: 'I ↔ ii', prog: 'Imaj7 | ii7', caption: '<b>A gentle rock.</b> Home, and one step away.' },
          { label: 'IV ↔ iii', prog: 'IVmaj7 | iii7', caption: '<b>Wistful.</b> You never hear the I chord, so home is only implied.' },
          { label: 'I ↔ vi', prog: 'Imaj7 | vi7', caption: '<b>Nostalgic.</b> Bright, then shaded, then bright again.' },
          { label: 'I ↔ ♭VII', prog: 'Imaj7 | bVIImaj7', caption: '<b>Floating.</b> A whole step down and back. (♭VII is not in the key — it is borrowed. More on that soon.)' },
        ],
      },
      { t: 'h', text: 'How long each chord lasts changes everything' },
      { t: 'p', html: `<p><b>Harmonic rhythm</b> is how often the chords change. Same two chords, three different songs:</p>` },
      {
        t: 'prog', key: 'A', pattern: 'lazy', title: 'Harmonic rhythm',
        variants: [
          { label: 'Two bars each', prog: 'Imaj7 | % | IVmaj7 | %', caption: 'Spacious and hypnotic. Lots of room for a melody — good for verses.' },
          { label: 'One bar each', prog: 'Imaj7 | IVmaj7', caption: 'The default.' },
          { label: 'Two beats each', prog: 'Imaj7 IVmaj7 | Imaj7 IVmaj7', caption: 'Urgent, lifting. Good for a pre-chorus or a hook.' },
        ],
      },
      { t: 'h', text: 'Keeping two chords interesting' },
      { t: 'p', html: ul(
        '<b>Change the voicing on the repeat</b> — a full shape first time, a small top-string shape the second.',
        '<b>Swap a colour note</b> — Imaj7 → I6, IVmaj7 → IVmaj9. Same job, new light.',
        '<b>Change the rhythm, not the chords.</b>',
        '<b>Let the bass and the melody do the moving.</b> Your guitar can stay still.',
      ) },
      { t: 'prog', key: 'A', prog: 'Imaj7 | IVmaj7 | I6 | IVmaj9', pattern: 'lazy', title: 'Same two chords, new colours' },
      { t: 'callout', kind: 'guitar', html: `<p>Set a timer for five minutes. Loop <b>Imaj7 – IVmaj7</b> in A with the band on, and just stay there. Change strum patterns, voicings, dynamics. Hum over it. This is most of what writing in this style actually feels like.</p>` },
      {
        t: 'quiz', title: 'Ear check: which vamp?', count: 5,
        gen: QUIZ.progressionEar({ options: ['Imaj7 | IVmaj7 | Imaj7 | IVmaj7', 'ii7 | V7 | ii7 | V7', 'Imaj7 | vi7 | Imaj7 | vi7', 'Imaj7 | bVIImaj7 | Imaj7 | bVIImaj7'] }),
      },
    ],
  },

  {
    id: 'two-five-one',
    title: 'ii–V–I and the art of not going home',
    minutes: 15,
    summary: 'The strongest pull in harmony — and the bedroom-pop habit of dodging it.',
    blocks: [
      { t: 'p', html: `<p>If the two-chord vamp is standing still, <b>ii – V – I</b> is walking home. Each root falls a fifth to the next one (D → G → C), which is the strongest pull there is. It is the engine of jazz, soul and R&amp;B — and therefore of Steve Lacy, King Krule and everything called neo-soul.</p>` },
      { t: 'prog', key: 'C', prog: 'ii7 | V7 | Imaj7 | %', prefer: 'movable', title: 'ii – V – I', pattern: 'lazy' },
      { t: 'h', text: 'Chains of falling fifths' },
      { t: 'p', html: `<p>Keep stepping backwards along the same chain and you get longer progressions that all feel inevitable:</p>` },
      {
        t: 'prog', key: 'C', pattern: 'lazy', title: 'Longer chains',
        variants: [
          { label: 'Turnaround', prog: 'Imaj7 | vi7 | ii7 | V7', caption: '<b>I – vi – ii – V.</b> From vi onwards every root falls a fifth. It loops forever.' },
          { label: '3-6-2-5', prog: 'iii7 | vi7 | ii7 | V7', caption: '<b>iii – vi – ii – V.</b> One more step back. The I chord is never played — only implied by the pull.' },
          { label: 'With arrival', prog: 'iii7 vi7 | ii7 V7 | Imaj7 | %', caption: 'The same chain at double speed, then two bars of rest on home.' },
        ],
      },
      { t: 'h', text: 'Not going home' },
      { t: 'p', html: `<p>Bedroom pop loves the <i>pull</i> of these progressions but often dodges the arrival, so the loop stays restless and dreamy. Four classic dodges:</p>` },
      {
        t: 'prog', key: 'C', pattern: 'lazy', title: 'Four ways to stay away',
        variants: [
          { label: 'Start on IV', prog: 'IVmaj7 | V7 | iii7 | vi7', caption: '<b>IV – V – iii – vi.</b> The tension lands on iii (a stand-in for home), then slides to vi. Huge in city pop and bedroom pop alike.' },
          { label: 'Walk down', prog: 'IVmaj7 | iii7 | ii7 | Imaj7', caption: '<b>IV – iii – ii – I.</b> Stepwise and smooth; home arrives almost by accident.' },
          { label: 'Deceptive', prog: 'ii7 | V7 | vi7 | %', caption: '<b>ii – V – vi.</b> You expected home and got its sad cousin.' },
          { label: 'Climb', prog: 'ii7 | iii7 | IVmaj7 | V7', caption: '<b>ii – iii – IV – V.</b> A staircase that ends on tension — perfect just before a new section.' },
        ],
      },
      {
        t: 'build', key: 'A', title: 'Build it',
        prompt: 'Build a <b>ii – V – I in A major</b> using seventh chords (three chords).',
        check: exactly('ii7 | V7 | Imaj7'),
      },
      {
        t: 'quiz', title: 'Ear check: which progression?', count: 5,
        gen: QUIZ.progressionEar({ options: ['Imaj7 | vi7 | ii7 | V7', 'IVmaj7 | V7 | iii7 | vi7', 'IVmaj7 | iii7 | ii7 | Imaj7', 'ii7 | V7 | Imaj7 | Imaj7'] }),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play ii – V – I in C, F, B♭ and G with the six movable shapes. Keep each one inside a three-fret area.',
        'Loop IV – V – iii – vi in G. Then try to sing or hum anything over it — notice how it never asks you to stop.',
      ) },
    ],
  },

  {
    id: 'minor-dorian',
    title: 'Minor keys and Dorian',
    minutes: 20,
    summary: 'The moody side of the map, and the one-note change that makes minor groove.',
    blocks: [
      { t: 'p', html: `<p>Every major key has a moody twin that uses exactly the same notes: its <b>relative minor</b>, built from the 6th note. C major and A minor are the same seven notes and the same seven chords. The only difference is which chord feels like home.</p>
        <p>In this app, minor-key chords are numbered against the tonic's <i>major</i> scale, so the flats are visible: <b>i · ii° · ♭III · iv · v · ♭VI · ♭VII</b>. In A minor that is Am, B°, C, Dm, Em, F, G.</p>` },
      { t: 'keys', key: 'A', mode: 'minor', sevenths: true, title: 'The chords of a minor key' },
      { t: 'h', text: 'Minor loops you will use constantly' },
      {
        t: 'prog', key: 'A', mode: 'minor', pattern: 'lazy', title: 'Four minor loops',
        variants: [
          { label: 'i ↔ iv', prog: 'i7 | iv7', caption: 'The minor seesaw.' },
          { label: 'i–♭VI–♭III–♭VII', prog: 'i7 | bVImaj7 | bIIImaj7 | bVII', caption: '<b>The big one.</b> Moody but warm, because two of its four chords are major 7ths.' },
          { label: 'i–♭VII–♭VI–♭VII', prog: 'i7 | bVII | bVImaj7 | bVII', caption: 'Down two steps and back up again.' },
          { label: 'i–iv–♭VII–♭III', prog: 'i7 | iv7 | bVII7 | bIIImaj7', caption: 'iv – ♭VII – ♭III is secretly a ii–V–I into the relative major. The clouds part on the last chord.' },
        ],
      },
      { t: 'h', text: 'The V problem' },
      { t: 'p', html: `<p>Natural minor's <b>v</b> chord is minor (Em in A minor), so it does not pull home very hard. When you want real tension, borrow the <b>major V7</b> (E7) — the one outside chord that minor keys use all the time. And <b>iiø7 – V7 – i7</b> is the minor-key version of ii–V–I.</p>` },
      {
        t: 'prog', key: 'A', mode: 'minor', pattern: 'lazy', title: 'Soft v versus strong V7',
        variants: [
          { label: 'minor v', prog: 'i7 | iv7 | v7 | i7', caption: 'All from the key. Gentle, folky, a little aimless.' },
          { label: 'major V7', prog: 'i7 | iv7 | V7 | i7', caption: 'The V7 has one note from outside the key (G♯ in A minor), a half-step below home. Hear it pull.' },
          { label: 'iiø–V–i', prog: 'iiø7 | V7 | i7 | %', caption: 'The minor ii–V–i. Dark, jazzy, very King Krule.' },
        ],
      },
      { t: 'h', text: 'Dorian: minor that grooves' },
      { t: 'p', html: `<p>Raise one note of the minor scale — the 6th — and you get the <b>Dorian</b> mode. That one note turns the iv chord from minor into <b>major (IV or IV7)</b> and takes the gloom out of the key. If a minor groove sounds cool, funky or hopeful rather than sad, it is almost certainly Dorian. Men I Trust live here.</p>` },
      { t: 'scale', key: 'A', scale: 'minor', choices: ['minor', 'dorian'], title: 'Natural minor versus Dorian', caption: 'Switch the scale back and forth: exactly one note moves (♭6 becomes 6).' },
      {
        t: 'prog', key: 'A', mode: 'minor', pattern: 'soul', groove: 'dream', title: 'Dorian vamps',
        variants: [
          { label: 'i ↔ IV', prog: 'i7 | IV7', caption: '<b>The Dorian vamp.</b> Am7 – D7. The D7 contains F♯, the raised 6th.' },
          { label: 'i ↔ ii', prog: 'i7 | ii7', caption: 'In Dorian the ii chord is a plain minor 7 (not diminished). Two minor 7ths a step apart.' },
          { label: 'with 9ths', prog: 'i9 | IV9', caption: 'The same vamp with 9ths on top. Instant neo-soul.' },
          { label: 'stepwise', prog: 'i7 | ii7 | bIIImaj7 | ii7', caption: 'Up the Dorian scale and back.' },
        ],
      },
      {
        t: 'quiz', title: 'Check: minor and Dorian', count: 6,
        gen: QUIZ.fixed([
          { q: 'What is the relative minor of <b>C major</b>?', choices: ['A minor', 'E minor', 'D minor', 'C minor'], answer: 0, explain: 'The relative minor starts on the 6th note of the major scale: C D E F G <b>A</b>.' },
          { q: 'What is the relative minor of <b>G major</b>?', choices: ['E minor', 'B minor', 'A minor', 'D minor'], answer: 0, explain: 'G A B C D <b>E</b> — or three frets below the major key\'s root.' },
          { q: 'Which chord gives away the Dorian mode?', choices: ['A major IV chord in a minor key', 'A minor iv chord in a major key', 'A diminished ii chord', 'A major 7th on the tonic'], answer: 0, explain: 'Dorian raises the 6th, which turns iv into IV (or IV7). i7 – IV7 is the signature.' },
          { q: 'In <b>A minor</b>, the ♭VImaj7 chord is…', choices: ['Fmaj7', 'Gmaj7', 'Cmaj7', 'Dm7'], answer: 0, explain: 'A minor: Am7, Bø7, Cmaj7, Dm7, Em7, Fmaj7, G7.' },
          { q: 'Why do minor-key songs borrow a <b>major V7</b>?', choices: ['It pulls home harder than the natural minor v', 'It makes the key major', 'It is easier to play', 'It removes the tension'], answer: 0, explain: 'The V7 contains a note a half-step below the tonic, which wants to resolve up to it.' },
          { q: 'Which note separates <b>A Dorian</b> from <b>A natural minor</b>?', choices: ['F♯', 'G♯', 'C♯', 'B♭'], answer: 0, explain: 'Natural minor has F (♭6); Dorian raises it to F♯ (6).' },
          { q: 'In a minor key, <b>iv7 – ♭VII7 – ♭IIImaj7</b> is really…', choices: ['a ii–V–I in the relative major', 'a borrowed progression', 'a Dorian vamp', 'a deceptive cadence'], answer: 0, explain: 'In A minor: Dm7 – G7 – Cmaj7, which is ii–V–I in C major.' },
        ]),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Loop <b>Am7 – D7</b> with the “Dream-pop bounce” band. Then swap D7 for Dm7 and feel the mood drop.',
        'Play i – ♭VI – ♭III – ♭VII in A minor, E minor and D minor.',
        'Find the relative minor of every key you can play a I – IV – V in.',
      ) },
    ],
  },

  {
    id: 'borrowed',
    title: 'Borrowed chords: the bittersweet trick',
    minutes: 20,
    summary: 'Take chords from the parallel minor. The minor iv alone is worth the whole lesson.',
    blocks: [
      { t: 'p', html: `<p>This is the trick that makes a progression sound <i>expensive</i>. Stay in a major key, but <b>borrow chords from the minor key with the same tonic</b> — C major borrowing from C minor. For a moment the ground shifts under the melody: bittersweet, nostalgic, like a cloud crossing the sun. It is all over Mac DeMarco, and half the Beatles catalogue before him.</p>
        <p>The chords on loan from the parallel minor: <b>iv, ♭VII, ♭VI and ♭III</b> (less often v and iiø). In C major that is Fm, B♭, A♭ and E♭.</p>` },
      { t: 'h', text: 'The minor iv — the most useful borrowed chord there is' },
      { t: 'p', html: `<p>Play IV, turn it minor, then go home: <b>IV → iv → I</b>. One note — the 3rd of the IV chord — slides down a fret, then down one more into the I chord. That falling half-step line is the sound of sweet sadness.</p>` },
      { t: 'prog', key: 'C', prog: 'Imaj7 | IVmaj7 | iv6 | Imaj7', pattern: 'ring', bpm: 76, title: 'IV → iv → I', caption: 'In C, listen for A (in Fmaj7) → A♭ (in Fm6) → G (in Cmaj7). Purple cards are borrowed chords.' },
      { t: 'callout', kind: 'tip', html: `<p>On guitar this is nearly free: whatever shape you are using for IV, lower its 3rd by one fret. You already know which dot that is.</p>` },
      {
        t: 'prog', key: 'C', pattern: 'lazy', title: 'The iv in a loop',
        variants: [
          { label: 'As a turnaround', prog: 'Imaj7 | iii7 | IVmaj7 | iv6', caption: 'The iv sits at the end of the loop and melts back into I.' },
          { label: 'Two chords', prog: 'Imaj7 | iv6', caption: 'Just home and the borrowed chord. Simple and devastating.' },
          { label: 'From the top', prog: 'IVmaj7 | iv6 | iii7 | vi7', caption: 'Starting on IV and going straight to iv.' },
        ],
      },
      { t: 'h', text: '♭VII: the relaxed one' },
      { t: 'p', html: `<p><b>♭VII</b> is a major chord one whole step below home (B♭ in C). It has none of V's urgency — it just strolls back to I. Rock uses it as I – ♭VII – IV. Dream pop floats between Imaj7 and ♭VIImaj7.</p>` },
      {
        t: 'prog', key: 'C', pattern: 'lazy', title: 'Three ways to use ♭VII',
        variants: [
          { label: 'I–♭VII–IV', prog: 'I | bVII | IV | I', pattern: 'classic', caption: 'Sunny and unbothered.' },
          { label: 'Float', prog: 'Imaj7 | % | bVIImaj7 | %', caption: 'Two major 7ths a whole step apart. Weightless.' },
          { label: '♭VI–♭VII–I', prog: 'bVI | bVII | I | %', pattern: 'classic', caption: 'Two major chords climbing by whole steps into home. Triumphant — the “level complete” cadence.' },
        ],
      },
      { t: 'h', text: '♭VI and ♭III: deep colour' },
      {
        t: 'prog', key: 'C', pattern: 'lazy', title: 'Further into the parallel minor',
        variants: [
          { label: 'I ↔ ♭VI', prog: 'Imaj7 | bVImaj7', caption: 'Like the sky changing colour and changing back.' },
          { label: 'I–♭III–IV–iv', prog: 'Imaj7 | bIIImaj7 | IVmaj7 | iv6', caption: '♭III lifts, IV brightens, iv sighs.' },
          { label: 'The full tour', prog: 'Imaj7 | bIIImaj7 | bVImaj7 | bVIImaj7', caption: 'Three borrowed chords in a row before the loop comes home.' },
        ],
      },
      { t: 'callout', kind: 'tip', html: `<p>Borrowed chords are seasoning. One per section is usually plenty — the effect depends on the contrast with the ordinary chords around it.</p>` },
      {
        t: 'build', key: 'G', borrowed: true, title: 'Use the minor iv',
        prompt: 'In <b>G major</b>, build a loop of at least three chords that includes a <b>minor iv</b> (Cm7 or Cm6).',
        check: includes(
          (c) => c.deg === 5 && c.info.kind === 'borrowed', 3,
          (hit) => `${hit.symbol} is the borrowed iv. Press play and listen for the moment the colour changes.`,
          'There is no minor iv in there yet — look in the “Borrowed” row for Cm7 or Cm6.',
        ),
      },
      {
        t: 'quiz', title: 'Check: spot the borrowed chord', count: 6,
        gen: QUIZ.mix(
          QUIZ.outsider({ progs: ['Imaj7 | IVmaj7 | iv6 | Imaj7', 'I | bVII | IV | I', 'Imaj7 | iii7 | bVImaj7 | V7', 'Imaj7 | bIIImaj7 | IVmaj7 | V7', 'vi7 | IVmaj7 | iv7 | Imaj7'] }),
          QUIZ.spotTheOutsider({ pairs: [
            ['Imaj7 | IVmaj7 | IVmaj7 | Imaj7', 'Imaj7 | IVmaj7 | iv6 | Imaj7'],
            ['I | V | IV | I', 'I | bVII | IV | I'],
            ['Imaj7 | vi7 | IVmaj7 | V7', 'Imaj7 | bVImaj7 | IVmaj7 | V7'],
          ] }),
        ),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play IV → iv → I in C, G, D, A and E. Find the single note that moves each time.',
        'Take any loop from earlier lessons and replace its last chord with iv. Keep the ones that give you a shiver.',
      ) },
    ],
  },

  {
    id: 'chromatic',
    title: 'Secondary dominants and chromatic glue',
    minutes: 25,
    summary: 'Chords that exist to point at the next chord: V-of-anything, half-step slides, passing diminished, planing.',
    blocks: [
      { t: 'p', html: `<p>Borrowed chords come from a parallel key. The chords in this lesson come from nowhere in particular — they exist to <b>point at the next chord</b>. They are glue: a flash of outside colour that makes whatever follows feel inevitable.</p>` },
      { t: 'h', text: 'Secondary dominants: every chord can have its own V' },
      { t: 'p', html: `<p>V7 pulls to I. But you can aim a dominant 7th at <i>any</i> chord in the key: go a fifth above your target and play a 7th chord there. It is written <b>V7/ii</b> (“five of two”), <b>V7/vi</b>, and so on. In C major:</p>${ul(
        '<b>V7/ii</b> = A7 → Dm7', '<b>V7/vi</b> = E7 → Am7', '<b>V7/V</b> = D7 → G7', '<b>V7/IV</b> = C7 → Fmaj7',
      )}<p>On the neck: if the target chord's root is on the 5th string, its V is on the <b>same fret of the 6th string</b>.</p>` },
      {
        t: 'prog', key: 'C', pattern: 'lazy', title: 'Secondary dominants in action',
        variants: [
          { label: 'V7/ii', prog: 'Imaj7 | V7/ii | ii7 | V7', caption: 'C – A7 – Dm7 – G7. The A7 holds one note from outside the key (C♯), pushing up into D.' },
          { label: 'V7/vi', prog: 'Imaj7 | V7/vi | vi7 | IVmaj7', caption: 'C – E7 – Am7 – F. The “III7 gut-punch”: it brightens for a second, then drops you into the minor chord.' },
          { label: 'Chain', prog: 'IVmaj7 | V7/vi | vi7 | V7/IV', caption: 'F – E7 – Am7 – C7, and the C7 points straight back at F. Every dominant aims at the next chord.' },
          { label: 'V7/V', prog: 'Imaj7 | V7/V | V7 | Imaj7', caption: 'C – D7 – G7 – C. A double run-up to home.' },
        ],
      },
      { t: 'h', text: 'Half-step slides: the neo-soul move' },
      { t: 'p', html: `<p>The cheapest, coolest glue of all: <b>approach any chord from one fret above or below, with the same shape.</b> Slide in on the last beat before the change. Steve Lacy does this constantly.</p>` },
      {
        t: 'prog', key: 'C', pattern: 'soul', groove: 'soul', bpm: 80, prefer: 'movable', title: 'Slides and side-steps',
        variants: [
          { label: 'From above', prog: 'ii9 | V13 | Imaj9:3 bIImaj7:1 | Imaj9', caption: 'D♭maj7 appears for one beat and falls back into C.' },
          { label: 'From below', prog: 'Imaj7:3 bii7:1 | ii7 | V7 | Imaj7', caption: 'C♯m7 for one beat, sliding up into Dm7.' },
          { label: 'Walk-down', prog: 'Imaj7 | iii7 biii7 | ii7 | V7', caption: 'Em7 – E♭m7 – Dm7. The middle chord is not “in” anything. It is just passing through.' },
          { label: 'Tritone sub', prog: 'ii7 | bII7 | Imaj7 | %', caption: 'Swap V7 for the dominant chord one fret above home (D♭7 → C). Jazz players call it a tritone substitution; think of it as “slide into I from above”.' },
        ],
      },
      { t: 'h', text: 'Passing diminished' },
      { t: 'p', html: `<p>Put a diminished 7th chord between two chords a whole step apart and the bass climbs by half-steps.</p>` },
      { t: 'prog', key: 'C', prog: 'Imaj7 | #i°7 | ii7 | V7', pattern: 'lazy', title: 'I – ♯i° – ii – V', caption: 'C – C♯°7 – Dm7 – G7. An old jazz move that still sounds fresh over a lazy groove.' },
      { t: 'h', text: 'Planing: one shape, anywhere' },
      { t: 'p', html: `<p>King Krule's signature: stop asking “what key is this?” and just move a chord shape around. Major 7ths shifted in parallel by whole steps or minor thirds sound woozy and unmoored. The key keeps slipping, but because the <i>shape</i> never changes your ear goes along with it.</p>` },
      {
        t: 'prog', key: 'C', pattern: 'lazy', groove: 'boom', prefer: 'movable', title: 'Parallel major 7ths',
        variants: [
          { label: 'Up in thirds', prog: 'Imaj7 | bIIImaj7 | bVImaj7 | bIImaj7', caption: 'Cmaj7 – E♭maj7 – A♭maj7 – D♭maj7. One shape, four keys.' },
          { label: 'Down in steps', prog: 'Imaj7 | bVIImaj7 | bVImaj7 | bVIImaj7', caption: 'Down a whole step, down another, back up.' },
        ],
      },
      { t: 'h', text: 'Line clichés: a melody hidden inside the chords' },
      { t: 'p', html: `<p>Hold one chord and move a single note down by half-steps. The chord “changes” four times while your hand barely moves.</p>` },
      {
        t: 'prog', pattern: 'arp', groove: 'bedroom', bpm: 84, title: 'The minor line cliché',
        abs: [
          { name: 'Am', frets: 'x07555' }, { name: 'Am(maj7)', frets: 'x06555' }, { name: 'Am7', frets: 'x05555' }, { name: 'Am6', frets: 'x04555' },
        ],
        caption: 'Barre the top three strings at fret 5 and let the open A ring. Only the D-string note moves: fret 7 → 6 → 5 → 4.',
      },
      { t: 'prog', key: 'C', prog: 'I | Imaj7 | I7 | IVmaj7', pattern: 'lazy', title: 'The major line cliché', caption: 'C – Cmaj7 – C7 – F. The top of the chord falls C → B → B♭ and lands on A, the 3rd of F.' },
      {
        t: 'quiz', title: 'Check: glue chords', count: 6,
        gen: QUIZ.mix(
          QUIZ.secondary(),
          QUIZ.secondary(),
          QUIZ.fixed([
            { q: 'A <b>tritone substitution</b> replaces V7 with…', choices: ['the dominant 7th one fret above the tonic', 'the minor iv chord', 'a diminished chord on V', 'the relative minor'], answer: 0, explain: 'In C: D♭7 instead of G7. It slides down a half-step into I.' },
            { q: '<b>Planing</b> means…', choices: ['moving one chord shape around in parallel', 'playing only open chords', 'holding one bass note under changing chords', 'strumming on the off-beats'], answer: 0, explain: 'Same shape, different frets — the harmony follows the hand, not the key.' },
            { q: 'In <b>C – C♯°7 – Dm7</b>, what is the C♯°7 doing?', choices: ['Passing: it connects C and D by half-step', 'Acting as the tonic', 'Replacing the IV chord', 'Nothing — it is a mistake'], answer: 0, explain: 'A passing diminished chord fills the gap between two chords a whole step apart.' },
            { q: 'The half-step slide approaches a chord…', choices: ['from one fret above or below, same shape', 'from a fifth above', 'from its relative minor', 'only ever from below'], answer: 0, explain: 'Either direction works. Arrive on the target chord on a strong beat.' },
          ]),
        ),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Play I – VI7 – ii – V in C, G and F (the VI7 is V7/ii). Then I – III7 – vi – IV.',
        'Take a two-chord vamp and approach each chord from one fret below on the “and” of beat 4.',
        'Pick one maj7 shape and move it anywhere you like for four bars. Record it. Keep the ten seconds that sound like a song.',
      ) },
    ],
  },
];
