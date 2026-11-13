// Module 7 — Writing songs: form, workflow.
// Module 8 — Style studies (original examples in each artist's style — not
//            transcriptions of their songs) and the capstone.

import { QUIZ } from '../ui/quiz.js';
import { ol, ul } from './helpers.js';

export const songwriting = [
  {
    id: 'form',
    title: 'Song form and contrast',
    minutes: 15,
    summary: 'A song is a few loops arranged so that something changes at the right moment.',
    blocks: [
      { t: 'p', html: `<p>You can now build loops and write lines over them. A <b>song</b> is a few of those, arranged so that something changes at the right moments. The good news: in this genre the forms are simple, and contrast does most of the work.</p>` },
      { t: 'h', text: 'Three forms that cover almost everything' },
      { t: 'p', html: ul(
        '<b>Verse – chorus.</b> The verse tells; the chorus says the main thing. Usually verse, chorus, verse, chorus, bridge, chorus.',
        '<b>AABA.</b> One main section three times, with a contrasting bridge in the middle. No chorus; the title sits at the start or end of each A. Perfect for short, jazzy songs.',
        '<b>One loop, changing layers.</b> The same chords all the way through; sections are defined by what is playing and what the melody does. Extremely common in bedroom pop and neo-soul.',
      ) },
      { t: 'h', text: 'Contrast levers' },
      { t: 'p', html: `<p>A chorus does not need to be louder. It needs to be <i>different</i>. Pull one or two of these:</p>${ul(
        '<b>Starting chord.</b> Verse starts on I (settled); chorus starts on IV or vi (lifted, or deepened).',
        '<b>Harmonic rhythm.</b> Verse changes chord every two bars; chorus every bar. Or the reverse.',
        '<b>Melody height.</b> The chorus sits a 3rd to a 5th higher than the verse.',
        '<b>Melody rhythm.</b> Wordy verse, long held notes in the chorus. Or the reverse.',
        '<b>Density.</b> Drop the drums for a bar before the chorus; bring the lead guitar in during it.',
        '<b>The special chord.</b> Save your one borrowed chord for one section.',
      )}` },
      { t: 'h', text: 'A skeleton to steal' },
      { t: 'prog', key: 'A', prog: 'Imaj7 | % | IVmaj7 | %', pattern: 'lazy', bpm: 92, title: 'Verse — two chords, slow changes' },
      { t: 'prog', key: 'A', prog: 'IVmaj7 | V7 | iii7 | vi7', pattern: 'classic', bpm: 92, title: 'Chorus — starts on IV, changes every bar' },
      { t: 'prog', key: 'A', prog: 'bVImaj7 | bVII | bVImaj7 | V7sus4', pattern: 'ring', bpm: 92, title: 'Bridge — borrowed chords, ending on tension' },
      {
        t: 'starter', label: 'Open this skeleton in the Studio',
        song: {
          title: 'Skeleton song', key: 'A', bpm: 92, groove: 'bedroom', pattern: 'lazy',
          sections: [
            { name: 'Verse', prog: 'Imaj7 | % | IVmaj7 | %' },
            { name: 'Chorus', prog: 'IVmaj7 | V7 | iii7 | vi7' },
            { name: 'Bridge', prog: 'bVImaj7 | bVII | bVImaj7 | V7sus4' },
          ],
        },
      },
      { t: 'h', text: 'Intros, outros and other small things' },
      { t: 'p', html: ul(
        '<b>Intro:</b> the chorus chords without the vocal, or the guitar hook alone. Four bars is plenty.',
        '<b>Pre-chorus:</b> two to four bars that raise the tension — ii → V, a rising melody — and stop on V.',
        '<b>Outro:</b> repeat the hook and fade; or end on IV or iv instead of I and leave it unresolved; or land on Imaj7 and let it ring.',
        '<b>Length:</b> two to three minutes is a complete song. Do not pad.',
      ) },
      {
        t: 'quiz', title: 'Check: form', count: 4,
        gen: QUIZ.fixed([
          { q: 'Which of these will <b>not</b> make a chorus stand out from its verse?', choices: ['Keeping the chords, rhythm and melody height all the same', 'Starting it on IV instead of I', 'Moving the melody higher', 'Changing chords twice as often'], answer: 0, explain: 'Contrast needs at least one thing to change.' },
          { q: 'In an <b>AABA</b> song, the B is…', choices: ['a contrasting bridge', 'the chorus, played three times', 'a repeat of A in a new key', 'the intro'], answer: 0, explain: 'A A (bridge) A — the bridge appears once, in the middle.' },
          { q: 'A chorus that starts on <b>IV</b> instead of I tends to feel…', choices: ['lifted and open', 'finished', 'darker and heavier', 'exactly like the verse'], answer: 0, explain: 'IV is “away from home”: starting there feels like a door opening.' },
          { q: 'A pre-chorus usually ends on…', choices: ['V — tension', 'I — home', 'a full bar of silence', 'the relative minor'], answer: 0, explain: 'It winds the spring so the chorus can release it.' },
        ]),
      },
    ],
  },

  {
    id: 'workflow',
    title: 'A songwriting workflow (and how to finish)',
    minutes: 15,
    summary: 'A repeatable path from empty page to finished demo.',
    blocks: [
      { t: 'p', html: `<p>Theory done. Here is a repeatable way to go from nothing to a finished demo. It is not the only way — but when you are staring at an empty page, a process beats waiting for inspiration.</p>` },
      { t: 'h', text: 'Nine steps' },
      { t: 'p', html: ol(
        '<b>Set the vibe before the notes.</b> Tempo, groove, tone. Open the Studio, pick a band and a tempo, and get your guitar sounding right. A good sound makes you play differently.',
        '<b>Find two to four chords.</b> Start from a vamp or something in the <a href="#/cookbook">Cookbook</a>, then change one thing: a chord quality, the order, one borrowed chord.',
        '<b>Find the right-hand part.</b> Strum, stabs or arpeggio? Loop it until it plays itself.',
        '<b>Mumble a melody.</b> Record yourself humming nonsense over the loop for five minutes without stopping. A phone voice memo is perfect. Do not judge.',
        '<b>Catch the best eight seconds.</b> Listen back, find the moment that made you perk up, work out its notes on the guitar and put them in the melody grid. That is your motif.',
        '<b>Build the phrase.</b> Repeat it, change its ending, answer it.',
        '<b>Write the second section by contrast.</b> Different starting chord, different melody height, different rhythm.',
        '<b>Words.</b> Let the mumbles suggest vowel sounds and syllable counts, then write to fit. Plain, specific, conversational lines beat poetic ones: an object, a place, a time of day.',
        '<b>Finish ugly.</b> A complete rough song teaches you more than ten perfect loops. Arrange it, record it badly, move on.',
      ) },
      { t: 'h', text: 'Choosing a key' },
      { t: 'p', html: `<p>Choose the key for the <b>voice</b>: find the highest note of your melody and move the key until that note is comfortable but not lazy. Then make it guitar-friendly — E, A, D, G and C let you mix open strings with movable shapes, and everything else is a capo away. In the Studio, changing the key moves the whole song: chords, shapes and melody.</p>` },
      { t: 'h', text: 'The tone recipe' },
      { t: 'p', html: ul(
        '<b>Guitar:</b> neck or middle pickup, tone knob rolled back a little.',
        '<b>Amp:</b> clean, or straight into the interface with an amp sim. Barely any gain.',
        '<b>Chorus or vibrato:</b> slow rate, medium depth. This is the wobble.',
        '<b>Compression:</b> light, to even out the strums.',
        '<b>Reverb:</b> spring or plate, not too long.',
        '<b>Double-track</b> the rhythm part and pan the two takes left and right.',
        '<b>For the seasick tape feel:</b> tune a touch flat, or slow the recording down slightly.',
        '<b>Bass:</b> simple, round, a little muted. In this genre the bass line is half the song.',
      ) },
      { t: 'prompt' },
    ],
  },
];

export const styles = [
  {
    id: 'style-mac',
    title: 'Style study: Mac DeMarco',
    minutes: 15,
    summary: 'Sunny on the surface, a little seasick underneath.',
    blocks: [
      { t: 'p', html: `<p><b>The sound:</b> sunny on the surface, a little seasick underneath. Jangly clean guitar soaked in chorus and vibrato, lazy mid-tempo grooves, and lead lines you can whistle.</p>
        <dl class="recipe">
        <dt>Chords</dt><dd>Major 7ths and minor 7ths from the key; two- and four-chord loops; the IV → iv melt; now and then a secondary dominant or a chord slid in from a fret away.</dd>
        <dt>Rhythm</dt><dd>Relaxed straight 8ths with a light touch, around 80–110 bpm.</dd>
        <dt>Lead</dt><dd>Single-note lines high on the neck with lots of slides, often doubling or answering the vocal. Major scale and major pentatonic.</dd>
        <dt>Tone</dt><dd>Bright clean guitar, heavy chorus or vibrato, slightly detuned. Plain DI bass. Dry, simple drums.</dd>
        </dl>` },
      { t: 'callout', kind: 'tip', title: 'About these examples', html: `<p>The progressions in the style studies are <b>original examples written in the style</b>, not transcriptions of the artists' songs. Use them as starting points, then go and work out the real songs by ear — that is the best lesson of all.</p>` },
      { t: 'prog', key: 'A', prog: 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7 iv6', pattern: 'classic', groove: 'bedroom', bpm: 96, title: 'Seesaw with a sigh', caption: 'A two-chord verse with the minor iv squeezed into the last two beats.' },
      { t: 'prog', key: 'E', prog: 'Imaj7 | iii7 | IVmaj7 | iv6', pattern: 'lazy', groove: 'bedroom', bpm: 88, title: 'Sunny, then a cloud' },
      { t: 'prog', key: 'D', prog: 'ii7 | V7 | Imaj7 | V7/ii', pattern: 'classic', groove: 'jangle', bpm: 108, title: 'Round and round', caption: 'The last chord is a secondary dominant that throws you back to the start.' },
      {
        t: 'starter', label: 'Start a song in this style',
        song: {
          title: 'Wobbly Sunday', key: 'A', bpm: 96, groove: 'bedroom', pattern: 'classic', scale: 'majorPent',
          sections: [
            { name: 'Verse', prog: 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7 iv6', melody: '3:2 5:1 6:3 r:2 | 6:1 5:1 3:2 2:2 r:2 | 3:2 5:1 6:3 r:2 | 1\':2 6:2 b6:4' },
            { name: 'Chorus', prog: 'ii7 | V7 | Imaj7 | V7/ii' },
          ],
        },
      },
      {
        t: 'listen', items: [
          ['Salad Days', 'major-key jangle and a hook you can whistle'],
          ['My Kind of Woman', 'slow, woozy chords under a crooned melody'],
          ['Ode to Viceroy', 'a lazy groove, and lead guitar that sings'],
          ['Freaking Out the Neighborhood', 'a guitar riff as the main hook'],
          ['Still Together', 'simple chords; the falsetto melody does the work'],
          ['Chamber of Reflection', 'keys rather than guitar — listen to how much he gets from one short loop'],
        ],
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Write a verse on two major 7th chords and put a iv chord in the last half-bar.',
        'Write a lead line on one string that copies your vocal melody, then add slides between every pair of notes.',
        'Turn the wobble up (speaker icon, top bar) and play everything a little lazier than feels natural.',
      ) },
    ],
  },

  {
    id: 'style-lacy',
    title: 'Style study: Steve Lacy',
    minutes: 15,
    summary: 'Neo-soul harmony with a garage-band attitude.',
    blocks: [
      { t: 'p', html: `<p><b>The sound:</b> neo-soul harmony played with a garage-band attitude. Rich chords — but small voicings, clipped rhythms and lots of air. Much of his early music was famously made on a phone, which tells you that the parts matter more than the gear.</p>
        <dl class="recipe">
        <dt>Chords</dt><dd>Minor 7ths and 9ths, major 7ths and 9ths, dominant 9ths and 13ths; ii–V movement; half-step slides into chords; parallel shapes; the borrowed iv and ♭VII.</dd>
        <dt>Voicings</dt><dd>Small. Top four strings, or a root on the 6th string with the 5th string muted.</dd>
        <dt>Rhythm</dt><dd>Syncopated stabs and muted scratches, often swung; guitar and bass locked tightly together; roughly 70–100 bpm.</dd>
        <dt>Melody</dt><dd>Bluesy and pentatonic, with call-and-response between voice and guitar, and plenty of falsetto.</dd>
        <dt>Tone</dt><dd>Fairly dry, a little gritty and compressed. Not much reverb.</dd>
        </dl>` },
      { t: 'prog', key: 'E', prog: 'ii9 | V13 | Imaj9:3 bIImaj7:1 | Imaj9', pattern: 'soul', groove: 'soul', bpm: 80, prefer: 'movable', title: 'Slide into home', caption: 'A ii–V–I with extensions, and a one-beat side-step a fret above the I chord.' },
      { t: 'prog', key: 'F#', mode: 'minor', prog: 'i9 | IV9', pattern: 'funk', groove: 'soul', bpm: 84, prefer: 'movable', title: 'Dorian two-chord groove' },
      { t: 'prog', key: 'G', prog: 'IVmaj7 | iii7 biii7 | ii7 | V7#9', pattern: 'soul', groove: 'boom', bpm: 86, prefer: 'movable', title: 'Chromatic walk-down', caption: 'IV, then iii → ♭iii → ii sliding down a fret at a time, and a gritty V7♯9 to turn it around.' },
      {
        t: 'starter', label: 'Start a song in this style',
        song: {
          title: 'Late-night neo-soul', key: 'E', bpm: 80, groove: 'soul', pattern: 'soul',
          sections: [
            { name: 'Verse', prog: 'ii9 | V13 | Imaj9:3 bIImaj7:1 | Imaj9' },
            { name: 'Hook', prog: 'IVmaj7 | iii7 biii7 | ii7 | V7#9' },
          ],
        },
      },
      {
        t: 'listen', items: [
          ['Dark Red', 'a few chords, a tight rhythm part, and a melody that does all the work'],
          ['Bad Habit', 'how one simple, repeated vocal hook can carry a whole song'],
          ['C U Girl', 'lo-fi warmth: jazzy chords under a casual vocal'],
          ['Some', 'clipped rhythm guitar and falsetto'],
          ['Infrunami', 'slow, sweet chord colours'],
          ['N Side', 'a sparse groove — listen to the space between the stabs'],
        ],
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Take any ii–V–I and play it with 9th and 13th shapes as short stabs with the swung band.',
        'Approach one chord per bar from a fret above or below.',
        'Write a two-bar guitar reply and leave room for it after every vocal line.',
      ) },
    ],
  },

  {
    id: 'style-mit',
    title: 'Style study: Men I Trust',
    minutes: 15,
    summary: 'Soft-focus grooves where the bass leads and the guitar glints.',
    blocks: [
      { t: 'p', html: `<p><b>The sound:</b> soft-focus and unhurried. A dry, steady drum groove, a melodic bass line right up front, hushed vocals — and guitar parts so small you could miss them, which is exactly why they work.</p>
        <dl class="recipe">
        <dt>Chords</dt><dd>Minor and Dorian centres; minor 7ths, minor 9ths and major 7ths; smooth stepwise movement (IVmaj7 – iii7 – ii7); long loops; hardly any dominant chords.</dd>
        <dt>Rhythm section</dt><dd>The bass carries the hook. Drums are tight and even. Around 85–115 bpm.</dd>
        <dt>Guitar</dt><dd>Clean, chorused, compressed. Muted single-note lines, two- or three-note chord fragments, small arpeggios. Often it simply outlines the chord tones.</dd>
        <dt>Melody</dt><dd>Narrow range, stepwise, breathy; long notes that sit on 3rds, 7ths and 9ths.</dd>
        </dl>` },
      { t: 'prog', key: 'D', mode: 'minor', prog: 'i7 | bVImaj7 | bIIImaj7 | bVII', pattern: 'arp', groove: 'dream', bpm: 100, title: 'Moody but warm' },
      { t: 'prog', key: 'G', prog: 'IVmaj7 | iii7 | ii7 | iii7', pattern: 'backbeat', groove: 'dream', bpm: 104, title: 'Floating', caption: 'It never touches the I chord, so it never lands.' },
      { t: 'prog', key: 'E', mode: 'minor', prog: 'i9 | IV9 | i9 | ii7', pattern: 'lazy', groove: 'dream', bpm: 96, prefer: 'movable', title: 'Dorian glide' },
      {
        t: 'melody', key: 'D', mode: 'minor', prog: 'i7 | bVImaj7 | bIIImaj7 | bVII', scale: 'minor', pattern: 'arp', groove: 'dream', bpm: 100, title: 'A narrow, stepwise melody',
        melody: 'b3:3 2:1 1:4 | 1:3 b7,:1 5,:4 | b7,:3 5,:1 b7,:4 | 2:3 1:1 b7,:4',
        caption: 'Just five different notes, mostly steps, and every long note is a chord tone: the root of Dm7, the 7th of B♭maj7, the 5th of Fmaj7, the root of C.',
      },
      {
        t: 'starter', label: 'Start a song in this style',
        song: {
          title: 'Soft focus', key: 'D', mode: 'minor', bpm: 100, groove: 'dream', pattern: 'arp', scale: 'minor',
          sections: [
            { name: 'Verse', prog: 'i7 | bVImaj7 | bIIImaj7 | bVII', melody: 'b3:3 2:1 1:4 | 1:3 b7,:1 5,:4 | b7,:3 5,:1 b7,:4 | 2:3 1:1 b7,:4' },
            { name: 'Chorus', prog: 'iv7 | bVII7 | bIIImaj7 | bVImaj7' },
          ],
        },
      },
      {
        t: 'listen', items: [
          ['Show Me How', 'bass and voice carry it; the guitar just glints'],
          ['Tailwhip', 'an upbeat groove with a tiny, catchy guitar figure'],
          ['Lauren', 'a bass-led, hypnotic loop'],
          ['Numb', 'slow, hazy minor chords'],
          ['I Hope to Be Around', 'bouncy bass and light chord stabs'],
          ['Seven', 'a long loop that never gets boring'],
        ],
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Mute the guitar in your head and write a bass line first. Then add the smallest guitar part that still helps.',
        'Play only two notes of each chord — the 3rd and the 7th — as a palm-muted line.',
        'Write a melody that stays within five notes and holds its last note for a full bar.',
      ) },
    ],
  },

  {
    id: 'style-krule',
    title: 'Style study: King Krule',
    minutes: 15,
    summary: 'Jazz chords with dirt under their fingernails.',
    blocks: [
      { t: 'p', html: `<p><b>The sound:</b> jazz chords with dirt under their fingernails. Beautiful major 7ths and minor 9ths lurch into chords that do not belong, the rhythm drags and snaps, and a gravel-deep voice half-sings over the top. Less pretty, more <i>bruised</i>.</p>
        <dl class="recipe">
        <dt>Chords</dt><dd>Major 7ths, minor 7ths and 9ths — plus the sour ones: minor-major 7th, diminished, augmented, 7♯9, maj7♯11.</dd>
        <dt>Movement</dt><dd>Parallel shapes (planing), side-slips a fret away and back, sudden lurches into unrelated keys, the minor iv.</dd>
        <dt>Rhythm</dt><dd>Loose and behind the beat, with swung, hip-hop-leaning drums and big dynamics — near-silent verses, slashing chords.</dd>
        <dt>Guitar</dt><dd>Clean-ish with reverb and a little grit. Jazzy chord stabs, and riffs built from the chords' own arpeggios.</dd>
        <dt>Melody</dt><dd>Speech-like and bluesy; leans on ♭3, ♭5 and ♭7 even over major-sounding chords.</dd>
        </dl>` },
      { t: 'prog', key: 'D', prog: 'Imaj7 | bIIImaj7 | bVImaj7 | bIImaj7', pattern: 'lazy', groove: 'boom', bpm: 84, prefer: 'movable', title: 'Planing major 7ths', caption: 'One shape, four unrelated keys.' },
      { t: 'prog', key: 'E', mode: 'minor', prog: 'i9 | bVImaj7 | iv7 | V7#9', pattern: 'lazy', groove: 'boom', bpm: 80, title: 'Minor, with a sour dominant' },
      { t: 'prog', key: 'A', prog: 'Imaj7 | Imaj7:3 bIImaj7:1 | iv(maj7) | iv6', pattern: 'arp', groove: 'boom', bpm: 76, title: 'Side-slip and a bruised iv', caption: 'The I chord slips up a fret for one beat, then the borrowed iv arrives with a major 7th grinding on top.' },
      {
        t: 'starter', label: 'Start a song in this style',
        song: {
          title: 'Bruised jazz', key: 'E', mode: 'minor', bpm: 80, groove: 'boom', pattern: 'lazy', scale: 'blues',
          sections: [
            { name: 'Verse', prog: 'i9 | bVImaj7 | iv7 | V7#9' },
            { name: 'Bridge', prog: 'bVImaj7 | bVIImaj7 | bVImaj7 | V7#9' },
          ],
        },
      },
      {
        t: 'listen', items: [
          ['Baby Blue', 'tender major 7th chords, slow and spacious'],
          ['Easy Easy', 'a voice and one raw electric guitar'],
          ['Out Getting Ribs', 'a picked jazz-chord figure as the spine of the song'],
          ['Border Line', 'listen to how the rhythm guitar chops against the beat'],
          ['Czech One', 'a woozy, late-night mood built from very little'],
          ['Dum Surfer', 'darker and heavier — the riff carries everything'],
        ],
      },
      { t: 'callout', kind: 'guitar', html: ul(
        'Take one maj7 shape and write a four-bar loop by moving it wherever sounds interesting. Ignore the key.',
        'Play a pretty progression, then replace one chord with its neighbour a fret away for a single beat.',
        'Sing (or speak) a blues-scale melody over major 7th chords and enjoy the friction.',
      ) },
    ],
  },

  {
    id: 'capstone',
    title: 'Capstone: write your first song',
    minutes: 60,
    summary: 'Everything so far was practice for this. Not a good song — a finished one.',
    blocks: [
      { t: 'p', html: `<p>Everything so far was practice for this: <b>write one complete song.</b> Not a good one — a <i>finished</i> one. Finishing is its own skill, and it is the one that turns people who know theory into people who have songs.</p>` },
      {
        t: 'checklist', id: 'capstone', title: 'The checklist',
        items: [
          'Pick a key, tempo and groove in the Studio.',
          '<b>Verse:</b> a loop of two to four chords you can play without thinking.',
          '<b>Chorus</b> (or B section) that contrasts — a different starting chord or harmonic rhythm.',
          'One <b>special chord</b>: borrowed, a secondary dominant, or a half-step slide.',
          'A verse melody built from <b>one motif</b>.',
          'A chorus melody whose highest note is higher than the verse\'s.',
          'A <b>guitar hook</b>: an intro riff, a reply line, or the vocal melody doubled.',
          'Words for at least one verse and the chorus.',
          'Play it start to finish — with the Studio\'s “Play song”, or better, just you and your guitar.',
          'Record a one-take demo on your phone. Done is the goal.',
        ],
      },
      { t: 'starter', label: 'Open a blank song in the Studio', song: { title: 'My first song', key: 'A', bpm: 88, groove: 'bedroom', pattern: 'lazy', sections: [{ name: 'Verse', prog: 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7' }] } },
      { t: 'h', text: 'What next' },
      { t: 'p', html: ul(
        '<b>Write the next one faster.</b> Use the prompt generator in the workflow lesson and give yourself an hour.',
        '<b>Transcribe.</b> Work out the chords of songs you love and enter them in the Studio <i>as numbers</i>. You will start to see the same moves everywhere.',
        '<b>Steal structures, not notes.</b> Take the form and harmonic rhythm of a favourite song and fill it with your own chords and melody.',
        '<b>Record everything.</b> Voice memos of half-ideas are the raw material for every song you will write next year.',
      ) },
    ],
  },
];
