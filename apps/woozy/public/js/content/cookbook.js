// Progression cookbook: a browsable reference of loops in the style, by mood.
// Every entry is playable, transposable, and can be opened in the Studio.

const P = (name, prog, note, extra = {}) => ({ name, prog, note, ...extra });

export const COOKBOOK = [
  {
    title: 'Two-chord vamps',
    blurb: 'When in doubt, start here.',
    items: [
      P('Dreamy seesaw', 'Imaj7 | IVmaj7', 'Two major 7ths. Neither pulls anywhere.'),
      P('Permanent anticipation', 'ii7 | V7', 'Never lands on home.'),
      P('Gentle rock', 'Imaj7 | ii7', 'Home and one step away.'),
      P('Wistful', 'IVmaj7 | iii7', 'Home is only implied.'),
      P('Nostalgic', 'Imaj7 | vi7', 'Bright, shaded, bright.'),
      P('Floating', 'Imaj7 | bVIImaj7', 'A whole step down and back.'),
      P('Home and the cloud', 'Imaj7 | iv6', 'The borrowed minor iv on its own.'),
      P('Dorian vamp', 'i7 | IV7', 'Minor that grooves.', { mode: 'minor', key: 'A', groove: 'dream', pattern: 'soul' }),
      P('Dorian with 9ths', 'i9 | IV9', 'The neo-soul two-chord groove.', { mode: 'minor', key: 'E', groove: 'soul', pattern: 'soul', bpm: 84 }),
    ],
  },
  {
    title: 'Four-chord loops from the key',
    blurb: 'All diatonic. The order and the starting point set the mood.',
    items: [
      P('Turnaround', 'Imaj7 | vi7 | ii7 | V7', 'Falling fifths that loop forever.'),
      P('3-6-2-5', 'iii7 | vi7 | ii7 | V7', 'The I chord is never played.'),
      P('The royal road', 'IVmaj7 | V7 | iii7 | vi7', 'IV – V – iii – vi. City pop to bedroom pop.'),
      P('Walk down', 'IVmaj7 | iii7 | ii7 | Imaj7', 'Stepwise and smooth.'),
      P('Climb', 'ii7 | iii7 | IVmaj7 | V7', 'A staircase ending on tension.'),
      P('Pop loop, softened', 'Imaj7 | V7sus4 | vi7 | IVmaj7', 'I – V – vi – IV with sevenths and a gentle V.'),
      P('Starts sad', 'vi7 | IVmaj7 | Imaj7 | V7sus4', 'The same chords from the minor side.'),
      P('Starts floating', 'IVmaj7 | Imaj7 | V7sus4 | vi7', 'Opens on “away”.'),
    ],
  },
  {
    title: 'Minor-key loops',
    blurb: 'Moody, warm, or dark.',
    items: [
      P('The big one', 'i7 | bVImaj7 | bIIImaj7 | bVII', 'Moody but warm.', { mode: 'minor', key: 'A' }),
      P('Minor seesaw', 'i7 | iv7', 'Two minor 7ths.', { mode: 'minor', key: 'E' }),
      P('Down and back', 'i7 | bVII | bVImaj7 | bVII', 'A slow descent and return.', { mode: 'minor', key: 'D' }),
      P('Clouds part', 'i7 | iv7 | bVII7 | bIIImaj7', 'Ends with a ii–V–I into the relative major.', { mode: 'minor', key: 'A' }),
      P('Minor ii–V–i', 'iiø7 | V7 | i7 | %', 'Dark and jazzy.', { mode: 'minor', key: 'D' }),
      P('Dorian steps', 'i7 | ii7 | bIIImaj7 | ii7', 'Up the Dorian scale and back.', { mode: 'minor', key: 'E', groove: 'dream' }),
      P('Sour dominant', 'i9 | bVImaj7 | iv7 | V7#9', 'A gritty V7♯9 turns it around.', { mode: 'minor', key: 'E', groove: 'boom' }),
    ],
  },
  {
    title: 'Borrowed chords',
    blurb: 'One chord from the parallel minor changes the weather.',
    items: [
      P('IV → iv → I', 'Imaj7 | IVmaj7 | iv6 | Imaj7', 'The bittersweet sigh.'),
      P('iv as turnaround', 'Imaj7 | iii7 | IVmaj7 | iv6', 'Melts back into I.'),
      P('Seesaw with a sigh', 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7 iv6', 'iv squeezed into the last half-bar.'),
      P('Unbothered', 'I | bVII | IV | I', 'The Mixolydian stroll.', { pattern: 'classic' }),
      P('Level complete', 'bVI | bVII | I | %', 'Two whole steps up into home.', { pattern: 'classic' }),
      P('Sky change', 'Imaj7 | bVImaj7', 'Colour shifts and shifts back.'),
      P('Lift, brighten, sigh', 'Imaj7 | bIIImaj7 | IVmaj7 | iv6', '♭III, IV, then the minor iv.'),
      P('Minor v into IV', 'Imaj7 | v7 I7 | IVmaj7 | iv6', 'v7 – I7 is a ii–V aimed at IV.'),
    ],
  },
  {
    title: 'Secondary dominants and chromatic moves',
    blurb: 'Chords that exist to point at the next chord.',
    items: [
      P('I – VI7 – ii – V', 'Imaj7 | V7/ii | ii7 | V7', 'A7 pushes up into Dm7 (in C).'),
      P('The III7 gut-punch', 'Imaj7 | V7/vi | vi7 | IVmaj7', 'Brightens, then drops into minor.'),
      P('Dominant chain', 'IVmaj7 | V7/vi | vi7 | V7/IV', 'Every dominant aims at the next chord.'),
      P('Passing diminished', 'Imaj7 | #i°7 | ii7 | V7', 'The bass climbs by half-steps.'),
      P('Chromatic walk-down', 'Imaj7 | iii7 biii7 | ii7 | V7', 'iii – ♭iii – ii, a fret at a time.', { groove: 'soul', pattern: 'soul', prefer: 'movable' }),
      P('Tritone sub', 'ii7 | bII7 | Imaj7 | %', 'Slide into home from a fret above.', { prefer: 'movable' }),
      P('Slide into home', 'ii9 | V13 | Imaj9:3 bIImaj7:1 | Imaj9', 'Extensions plus a one-beat side-step.', { groove: 'soul', pattern: 'soul', bpm: 80, prefer: 'movable' }),
      P('Major line cliché', 'I | Imaj7 | I7 | IVmaj7', 'One note falls through the chord.'),
    ],
  },
  {
    title: 'Planing and other strangeness',
    blurb: 'Stop asking what key it is.',
    items: [
      P('Major 7ths in thirds', 'Imaj7 | bIIImaj7 | bVImaj7 | bIImaj7', 'One shape, four keys.', { groove: 'boom', prefer: 'movable' }),
      P('Down in steps', 'Imaj7 | bVIImaj7 | bVImaj7 | bVIImaj7', 'Down, down, back up.', { groove: 'boom', prefer: 'movable' }),
      P('Side-slip', 'Imaj7 | Imaj7:3 bIImaj7:1 | iv(maj7) | iv6', 'Up a fret for a beat, then a bruised iv.', { groove: 'boom', pattern: 'arp', bpm: 76 }),
      P('Lydian shimmer', 'Imaj7 | IVmaj7#11', 'The ♯11 on IV.', { pattern: 'arp' }),
      P('Augmented climb', 'I | I+ | I6 | I7', 'The 5th rises a fret at a time.', { pattern: 'arp' }),
    ],
  },
];
