// Module 6 — Melody: chord tones, scales, motifs, guitar hooks, and what to
// play when the chords leave the key.

import { QUIZ } from '../ui/quiz.js';
import { ul } from './helpers.js';

export const melody = [
  {
    id: 'chord-tones',
    title: 'Chord tones: the notes that always work',
    minutes: 20,
    summary: 'Land on a note from the chord and it sounds settled. Everything else is a journey between landings.',
    blocks: [
      { t: 'p', html: `<p>Melody time. Whether it ends up sung or played, the first principle is the same: <b>a note that belongs to the chord underneath sounds settled; a note that does not sounds like it wants to move.</b> Neither is wrong — melody is the dance between the two — but you need to know which is which.</p>` },
      { t: 'h', text: 'See the chord tones' },
      { t: 'tones', key: 'C', prog: 'Imaj7 | vi7 | ii7 | V7', bpm: 72, title: 'Chord tones on the neck', caption: 'The big dots rearrange at every chord change. R = root, 3, 5, 7 are that chord\'s tones.' },
      { t: 'h', text: 'The 3rd and the 7th tell the story' },
      { t: 'p', html: `<p>Root and 5th are safe but plain — the bass is already playing the root. The <b>3rd</b> says major-or-minor; the <b>7th</b> adds the colour. A melody that touches the 3rd or 7th as each chord arrives sounds like it <i>knows</i> the chords: you can hear the harmony from the melody alone.</p>` },
      {
        t: 'melody', key: 'C', prog: 'Imaj7 | vi7 | ii7 | V7', bpm: 80, title: 'Three melodies over the same chords',
        variants: [
          { label: 'Roots', melody: '1:8 | 6,:8 | 2:8 | 5,:8', caption: 'The root of each chord. Correct — but it is a bass line, not a tune.' },
          { label: '3rds', melody: '3:8 | 1:8 | 4:8 | 7,:8', caption: 'Just the 3rd of each chord. Already it sounds like a melody.' },
          { label: 'Chord tones + rhythm', melody: '3:2 5:1 7:3 r:2 | 1\':2 7:1 5:3 r:2 | 6:2 5:1 4:3 r:2 | 4:2 3:1 2:5', caption: 'Chord tones on the long notes, one passing note between them. Tinted cells are chord tones; coloured notes sitting on a tint are “landed”.' },
        ],
      },
      { t: 'h', text: 'Strong beats and long notes' },
      { t: 'p', html: `<p>You do not have to play <i>only</i> chord tones — that would sound like an arpeggio exercise. The rule that matters: <b>the notes people notice should be chord tones.</b> That means notes on beat 1 (and 3), and any note you hold. Everything in between can be scale notes passing through.</p>
        <p>Try it on the third melody above: tap a long note to delete it, then tap the row just above or below — off the tint — and listen to it start to itch. Put it back and feel it settle.</p>` },
      { t: 'quiz', title: 'Find the chord tone', count: 6, gen: QUIZ.chordTone() },
      { t: 'callout', kind: 'guitar', html: ul(
        'Loop Imaj7 – vi7 – ii7 – V7 in the fretboard widget. Play only the <b>3rd</b> of each chord, in time, one note per bar.',
        'Now only the <b>7th</b> of each chord. Then alternate 3rd, 7th, 3rd, 7th.',
        'Join them up: play a 3rd on beat 1 of each bar and walk through scale notes to reach the next one.',
      ) },
    ],
  },

  {
    id: 'pentatonic',
    title: 'Pentatonic first, then fill the gaps',
    minutes: 20,
    summary: 'Five notes that never clash, and the two “spice” notes that complete the scale.',
    blocks: [
      { t: 'p', html: `<p>Chord tones tell you where to land. Scales give you the paths between. Start with the scale that cannot really go wrong: the <b>major pentatonic</b> — five notes, degrees <b>1 2 3 5 6</b> of the key.</p>` },
      { t: 'scale', key: 'A', scale: 'majorPent', ghost: 'major', choices: ['majorPent', 'major', 'minorPent', 'minor', 'dorian'], title: 'Major pentatonic', caption: 'Solid dots: the pentatonic. Faded dots: the two notes it leaves out, 4 and 7.' },
      { t: 'p', html: `<p>Why five notes work so well: the two it skips — the <b>4th</b> and the <b>7th</b> — are exactly the notes that make the major scale's two half-steps (3–4 and 7–1). Take them out and no two notes are closer than a whole step, so nothing grinds against any chord in the key. That is why you can noodle pentatonic over a whole song and never hit a clanger.</p>
        <p>And you already know the shape. A key's major pentatonic has <b>the same notes as the minor pentatonic of its relative minor</b>, three frets down. A major pentatonic = F♯ minor pentatonic. Same box, different home note.</p>` },
      {
        t: 'melody', key: 'A', prog: 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7', scale: 'majorPent', bpm: 84, title: 'Five notes only',
        melody: '3:2 5:1 6:3 r:2 | 6:1 5:1 3:2 2:2 r:2 | 3:2 5:1 6:3 r:2 | 1\':2 6:2 5:4',
        caption: 'Every note is from the pentatonic. Nothing clashes — and notice the first bar comes back in bar 3.',
      },
      { t: 'h', text: 'Then add the spice: 4 and 7' },
      { t: 'p', html: `<p>The 4th and 7th are the tension notes. They are beautiful when they <b>resolve</b>: 4 falls to 3; 7 rises to 1 or falls to 6. Use them as passing notes, or lean on them on purpose for an ache. One caution: <b>holding the 4th over the I chord</b> grinds against the chord's 3rd. Pass through it; do not park on it.</p>` },
      {
        t: 'melody', key: 'A', prog: 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7', scale: 'major', bpm: 84, title: 'With 4 and 7 as passing notes',
        melody: '3:2 4:1 5:3 r:2 | 7:2 6:1 5:1 6:2 r:2 | 3:2 4:1 5:3 r:2 | 1\':3 7:1 6:4',
        caption: 'The same contour, with the 4th filling the gap in bars 1 and 3, and the 7th leaning into the IV chord in bar 2.',
      },
      { t: 'h', text: 'Minor and Dorian melodies' },
      { t: 'p', html: `<p>In a minor key the default is the <b>minor pentatonic</b> (1 ♭3 4 5 ♭7). To get the Dorian flavour, add the natural <b>6th</b> (and the 2nd). Leaning on that 6th is <i>the</i> Men I Trust and neo-soul melodic colour.</p>` },
      { t: 'scale', key: 'A', scale: 'minorPent', ghost: 'dorian', choices: ['minorPent', 'dorian', 'minor', 'blues'], title: 'Minor pentatonic, with the Dorian notes faded in' },
      {
        t: 'melody', key: 'A', mode: 'minor', prog: 'i7 | IV7', scale: 'dorian', groove: 'dream', bpm: 96, title: 'A Dorian line: lean on the 6th',
        melody: '1:1 b3:1 4:1 5:3 r:2 | 6:2 5:1 4:1 b3:2 r:2',
        caption: 'Bar 2 starts on the natural 6th — which is also the 3rd of the IV chord. Scale colour and chord tone at once.',
      },
      {
        t: 'quiz', title: 'Check: scales for melodies', count: 5,
        gen: QUIZ.fixed([
          { q: 'Which two notes of the major scale does the major pentatonic leave out?', choices: ['4 and 7', '2 and 6', '3 and 7', '1 and 5'], answer: 0, explain: 'Dropping 4 and 7 removes both of the scale\'s half-steps (3–4 and 7–1).' },
          { q: '<b>A major pentatonic</b> has the same notes as…', choices: ['F♯ minor pentatonic', 'A minor pentatonic', 'E minor pentatonic', 'D major pentatonic'], answer: 0, explain: 'The relative minor is three frets below: A → F♯.' },
          { q: 'The 4th of the scale most naturally resolves to…', choices: ['the 3rd', 'the 5th', 'the 7th', 'the 6th'], answer: 0, explain: 'A half-step down. “Sus4 → major” is the same motion as a chord.' },
          { q: 'Which note gives a minor melody its Dorian colour?', choices: ['The natural 6th', 'The flat 2nd', 'The major 3rd', 'The flat 5th'], answer: 0, explain: 'Natural minor has ♭6; Dorian raises it.' },
          { q: '<b>C major pentatonic</b> is…', choices: ['C D E G A', 'C D E F G', 'C E♭ F G B♭', 'C D F G A'], answer: 0, explain: '1 2 3 5 6 of C major.' },
          { q: 'Holding the 4th over the I chord clashes with the chord\'s…', choices: ['3rd', 'root', '5th', '7th'], answer: 0, explain: 'They are a half-step apart (F against E in C major).' },
        ]),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Loop Imaj7 – IVmaj7 in A and improvise with the major pentatonic only. Stay inside one five-fret box.',
        'Add the 4th and 7th, but only between two pentatonic notes — never on beat 1.',
        'Loop Am7 – D7 and improvise in A minor pentatonic. Then add F♯ and aim for it whenever D7 arrives.',
      ) },
    ],
  },

  {
    id: 'motifs',
    title: 'Motifs: say something, then say it again',
    minutes: 25,
    summary: 'A hook is a small idea repeated and bent. Five ways to bend it.',
    blocks: [
      { t: 'p', html: `<p>Here is what separates a <i>melody</i> from a string of correct notes: <b>repetition</b>. A great tune is usually one tiny idea — a <b>motif</b> of two to five notes with a recognisable rhythm — said, said again, then twisted. People need to hear something twice before it feels like a hook.</p>` },
      { t: 'h', text: 'Five things to do with a motif' },
      {
        t: 'melody', key: 'G', prog: 'Imaj7 | vi7 | IVmaj7 | V7', bpm: 88, title: 'One motif, five treatments',
        variants: [
          { label: 'Repeat', melody: 'r:1 3:1 5:1 6:2 5:3 | r:1 3:1 5:1 6:2 5:3 | r:1 3:1 5:1 6:2 5:3 | r:1 3:1 5:1 6:2 5:3', caption: '<b>Repeat it exactly.</b> The same four notes every bar — but the chords change underneath, so the same notes mean something new each time.' },
          { label: 'Sequence', melody: 'r:1 3:1 5:1 6:2 5:3 | r:1 1:1 3:1 4:2 3:3 | r:1 6,:1 1:1 2:2 1:3 | r:1 5,:1 7,:1 1:2 7,:3', caption: '<b>Move the shape.</b> Up, up, back — copied lower each bar so that it fits each new chord.' },
          { label: 'New ending', melody: 'r:1 3:1 5:1 6:2 5:3 | r:1 3:1 5:1 6:2 1\':3 | r:1 3:1 5:1 6:2 3:3 | r:1 3:1 5:1 6:2 2:3', caption: '<b>Change only the last note.</b> Comfort and surprise at the same time.' },
          { label: 'Question & answer', melody: 'r:1 3:1 5:1 6:2 5:3 | r:1 6:1 5:1 3:2 2:3 | r:1 3:1 5:1 6:2 5:3 | r:1 3:1 2:1 7,:2 5,:3', caption: '<b>Ask, then answer.</b> Bars 1–2 end hanging in the air. Bars 3–4 start the same way but come down to rest.' },
          { label: 'Space', melody: 'r:1 3:1 5:1 6:2 5:3 | r:8 | r:1 3:1 5:1 6:2 1\':3 | r:8', caption: '<b>Leave room.</b> Half the bars are empty — space for a guitar reply, or just for breathing. The gaps make the motif <i>more</i> memorable, not less.' },
        ],
      },
      { t: 'h', text: 'Shape and range' },
      { t: 'p', html: ul(
        '<b>Mostly steps, a few leaps.</b> After a big leap, step back the other way.',
        '<b>One highest note</b>, reached once — usually about two-thirds of the way through.',
        '<b>Stay within about an octave.</b> Narrow melodies sound intimate, and they are easier to sing quietly into a bedroom mic.',
        '<b>Rhythm first.</b> Clap your motif. If it is catchy as a rhythm alone, the notes almost do not matter.',
        '<b>Start off the beat.</b> Notice the motif above begins on the “and” of 1 — it sounds like someone starting to speak.',
      ) },
      { t: 'h', text: 'Stuck? Roll the dice' },
      { t: 'p', html: `<p>Every melody grid has an <b>Idea</b> button. It builds a line the way this lesson describes — a repeated rhythm, a shape that follows the chords, chord tones on strong beats, an ending that lands — and you can then edit it note by note. Do not keep what it gives you. <i>React</i> to it: change the two notes you like least, then two more.</p>` },
      { t: 'melody', key: 'A', prog: 'Imaj7 | IVmaj7 | ii7 | V7sus4', bpm: 84, melody: '', title: 'Your turn', caption: 'Press Idea a few times until one half-works. Then fix it. Or tap in a three-note motif of your own in bar 1 and treat it four ways.' },
      { t: 'callout', kind: 'guitar', html: ul(
        'Invent a three-note motif over a two-chord vamp. Play it eight times in a row without changing it. Then change only its last note.',
        'Sing a motif first, then find it on the guitar. Your voice has better ideas than your fingers — fingers play shapes they already know.',
        'Write a four-bar question-and-answer phrase and save it in the Studio.',
      ) },
    ],
  },

  {
    id: 'hooks',
    title: 'Guitar hooks: slides, sixths and doubling the vocal',
    minutes: 15,
    summary: 'The guitar as the second singer.',
    blocks: [
      { t: 'p', html: `<p>So far “melody” could have been a vocal line. This lesson is about the <b>guitar</b> as the melodic voice: intros, riffs between vocal phrases, solos you can hum. In this genre lead guitar is rarely fast. It is simple, slightly wobbly, and it sings.</p>` },
      { t: 'h', text: 'Play along one string' },
      { t: 'p', html: `<p>Box shapes make you play like a guitarist. Playing a melody <b>up and down a single string</b> makes you play like a singer: you slide between notes and every note has the same tone. It is the heart of Mac DeMarco's lead style.</p>` },
      {
        t: 'tab', key: 'A', prog: 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7', bpm: 84, title: 'A one-string melody (B string)',
        tab: '2/5:2 2/7s:1 2/9s:3 r:2 | 2/10:2 2/9s:1 2/7s:3 r:2 | 2/5:2 2/7s:1 2/9s:1 2/10s:2 r:2 | 2/14s:3 2/12s:1 2/10s:4',
        caption: 'Everything on the B string; a slash means slide into the note. The held notes are chord tones: the 7th of Amaj7 in bar 1, the 3rd of Dmaj7 in bar 2 — and bar 4 starts on the 7th of Dmaj7.',
      },
      { t: 'h', text: 'Double the vocal' },
      { t: 'p', html: `<p>The simplest hook there is: <b>play the vocal melody on the guitar.</b> As an intro before the singing starts, in unison with the voice in the chorus, or as the solo. It ties the whole song together — and you have already written it.</p>` },
      { t: 'h', text: 'Harmonise in sixths' },
      { t: 'p', html: `<p>For a sweeter, fuller line, add a second note a <b>6th below</b> the melody. On guitar that is two strings with one skipped between them (high e + G, or B + D). As you climb the scale the pairs alternate between two shapes:</p>` },
      {
        t: 'tab', key: 'A', prog: 'Imaj7 | IVmaj7', bpm: 80, title: 'A major in 6ths (high e + G strings)',
        tab: '1/5+3/6:2 1/7+3/7:2 1/9+3/9:2 1/10+3/11:2 | 1/12+3/13:4 1/10+3/11:2 1/9+3/9:2',
        caption: 'Two shapes: “slanted” (lower note one fret higher) and “straight” (same fret). Mute the B string with the finger on the G string.',
      },
      { t: 'h', text: 'Call and response' },
      { t: 'p', html: `<p>Let the voice ask and the guitar answer. Leave the second half of every other bar empty in the vocal melody and drop a two- or three-note guitar reply into the hole. Keep the reply the same every time and it becomes the song's signature.</p>` },
      { t: 'h', text: 'The wobble' },
      { t: 'p', html: `<p>Tone is part of the hook. Slow, shallow vibrato on held notes — from your finger, a whammy bar, or a chorus/vibrato pedal — is what makes a three-note line sound like a <i>record</i>. The guitar in this app has a <b>wobble</b> control behind the speaker icon in the top bar: turn it up and listen to what it does to a long note.</p>` },
      { t: 'callout', kind: 'guitar', html: ul(
        'Take the melody you wrote in the last lesson and play it entirely on the B string, then entirely on the G string.',
        'Harmonise it: add the note a 6th below each long note.',
        'Write a two-note reply and play it in the gaps of a melody you sing.',
      ) },
    ],
  },

  {
    id: 'follow-changes',
    title: 'Melody over changing colours',
    minutes: 15,
    summary: 'When a chord leaves the key, one note changes. Sing that note.',
    blocks: [
      { t: 'p', html: `<p>When every chord comes from the key, one scale covers everything. But the moment you use a borrowed chord or a secondary dominant, <b>one note of the scale changes</b> — and the melody has a choice: ignore it (risky), avoid it (fine), or <i>sing it</i> (gorgeous). The changed note is where the emotion of the chord lives.</p>` },
      { t: 'h', text: 'Over the minor iv: sing the ♭6' },
      { t: 'p', html: `<p>IV → iv changes one note: the 3rd of the IV chord drops a half-step. In C, A becomes A♭. A melody that traces it down — <b>6 → ♭6 → 5</b> — is a guaranteed lump in the throat.</p>` },
      {
        t: 'melody', key: 'C', prog: 'Imaj7 | IVmaj7 | iv6 | Imaj7', bpm: 76, title: 'Tracing the changed note',
        melody: '3:2 5:2 3:4 | 6:6 5:2 | b6:6 4:2 | 5:8',
        caption: 'A over Fmaj7, A♭ over Fm6, G over Cmaj7. The melody simply follows the one note that moves.',
      },
      { t: 'h', text: 'Over a secondary dominant: sing its 3rd' },
      { t: 'p', html: `<p>A secondary dominant's <b>3rd</b> is its outside note — the one a half-step below the chord it is aiming at. III7 → vi in C: E7 contains G♯, which rises to A. Touch that G♯ on the way and the melody “explains” the chord.</p>` },
      {
        t: 'melody', key: 'C', prog: 'Imaj7 | V7/vi | vi7 | IVmaj7', bpm: 80, title: 'Through a secondary dominant',
        melody: '5:2 3:2 5:4 | #5:4 7:4 | 1\':6 7:2 | 6:8',
        caption: 'G over C, then G♯ over E7 — the same note, bent upwards by the chord — then on up to C over Am7.',
      },
      { t: 'h', text: 'Over ♭VII and friends' },
      { t: 'p', html: `<p>♭VII brings a ♭7 into the scale; ♭VI brings ♭6 and ♭3. The easy approach: for the bar that a borrowed chord lasts, play <b>that chord's own tones</b> (its arpeggio), then return to the key.</p>` },
      {
        t: 'melody', key: 'C', prog: 'Imaj7 | bVIImaj7 | Imaj7 | bVIImaj7', bpm: 80, title: 'Following Imaj7 → ♭VIImaj7',
        melody: '3:3 5:1 7:4 | 6:3 4:1 2:4 | 3:3 5:1 7:4 | b7:4 6:2 4:2',
        caption: 'Bar 1 climbs through C\'s chord tones; bar 2 answers by falling through B♭\'s. Bar 4 finally names the borrowed note itself: B♭.',
      },
      { t: 'p', html: `<p>The general method, for any chord that surprises you: <b>find its 3rd and 7th on the neck, and make sure the melody touches one of them.</b></p>` },
      {
        t: 'quiz', title: 'Check: the note that changed', count: 5,
        gen: QUIZ.fixed([
          { q: 'Key of C. Over the borrowed <b>iv</b> chord (Fm), which melody note captures the change?', choices: ['A♭', 'A', 'B', 'F♯'], answer: 0, explain: 'F major has A; F minor has A♭. That half-step is the whole effect.' },
          { q: '<b>E7 → Am</b> in C major: which note of E7 is outside the key?', choices: ['G♯', 'D', 'B', 'E'], answer: 0, explain: 'E7 = E G♯ B D. The G♯ is the 3rd of E7 and leads up to A.' },
          { q: 'In G major, IV → iv is C → Cm. Which note changes?', choices: ['E becomes E♭', 'G becomes G♭', 'C becomes C♯', 'B becomes B♭'], answer: 0, explain: 'The 3rd of the chord: E in C major, E♭ in C minor.' },
          { q: '♭VII in the key of D is a C major chord. Which new note does it bring?', choices: ['C natural', 'C♯', 'G♯', 'F natural'], answer: 0, explain: 'D major has C♯; the ♭VII chord\'s root is C natural — the ♭7 of the key.' },
          { q: 'Safest thing to play over a borrowed chord for one bar?', choices: ['That chord\'s own chord tones', 'The key\'s 4th', 'Chromatic runs', 'Nothing — always rest'], answer: 0, explain: 'Its arpeggio cannot clash with it. Then go back to the key.' },
        ]),
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Loop I – IV – iv – I in three keys. Find the 6 → ♭6 → 5 line on the B string each time.',
        'Loop I – III7 – vi – IV. Improvise with the major scale, but whenever III7 arrives, hit its 3rd.',
      ) },
    ],
  },
];
