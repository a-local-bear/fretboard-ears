// The progression path: a suggested order through the app, in stages. Each stage is a few levels and
// drills followed by a guide that shows how to use what was just learned on the guitar, usually over
// a backing loop. By the end the player can hear the key of a song, follow its chords, take down its
// melody in solfège, and play all of it.
//
// Steps: { kind: 'level', id (a level id from data.js), tip } | { kind: 'drill', id (drills.js), tip }
// | { kind: 'guide', id, title, intro (paragraphs), tries[], loop? ({ key, mode, slots, tempo, bars },
// see harmony.js normalizeBacking), examples? ({ tunes: [tune ids], progs: [progression ids] }) }.
// A level or drill step is done once passed (PASS_SCORE); a guide once the player marks it done.
// Stages: { name, desc (one line), about (a paragraph on what the stage is for), steps }.
// Pure data and functions only.

import { CHAPTERS, PASS_SCORE, levelsFor } from './data.js';
import { drillById } from './drills.js';

const L = (id, tip) => ({ kind: 'level', id, tip });
const D = (id, tip) => ({ kind: 'drill', id, tip });
const G = (spec) => ({ kind: 'guide', ...spec });

export const STAGES = [
  {
    name: 'First notes',
    desc: 'Do, Re, Mi and Sol on one string, then use them over a two-chord loop.',
    about: 'Everything in this method is heard relative to Do, the home note of the key. Before each note the app plays a cadence, a short chord sequence that tells your ear where home is, so you learn what each note feels like in a key rather than its absolute pitch. We start with the tonic triad, Do, Mi and Sol, plus Re, on a single string, so the fretboard never gets in the way of the ear. Fa arrives in the next stage.',
    steps: [
      L('one-t0', 'Do and Sol only. Do is home; Sol, the fifth, is open and solid, a second place the ear could rest. Decide by feel before you think about pitch.'),
      L('one-t1', 'Mi joins between them. It is bright and sweet, the third that completes the Do chord. Do, Mi and Sol together are the tonic triad.'),
      L('one-t2', 'Re is the first restless note: it sits between Do and Mi and wants to fall down to Do. Listen for that lean towards home.'),
      G({
        id: 'g-first', title: 'Do, Re, Mi, Sol over a loop',
        intro: [
          'You can now tell Do, Re, Mi and Sol apart when they come one at a time after a cadence. Real music never sounds like that: notes come over chords that keep changing, and the same note takes on a different character depending on the chord underneath it.',
          'In this guide you play your four notes over a loop of two chords, I and IV. Take your time with every exercise and listen more than you play. The aim is not to play fast or clever lines, but to notice how each note feels as the harmony moves under it, because that feeling is what your ear will later use to recognise notes in songs.',
        ],
        tries: [
          'Find Do and play it once at the start of every chord, letting it ring. Over I it sounds like home, perfectly at rest; over IV it becomes the fifth of the chord and seems to float, as if it is waiting for the music to come back.',
          'Hold Mi through both chords. Over I it is the bright third and sounds sweet; over IV it is the major seventh, a soft and slightly dreamy colour that jazz players love. Same note, two completely different moods.',
          'Play Sol over I, where it is the solid fifth, then keep it over IV, where it becomes a gentle ninth that leans a little away from home. Compare how settled it feels with how restless Re feels over the same chord.',
          'Make up three-note melodies using only Do, Re, Mi and Sol. End some on Do or Mi and hear them settle; end others on Re and hear them hang in the air like a question. A melody that asks and then answers is the smallest unit of music.',
          'Sing each note before you play it, even quietly. If the guitar surprises you, stop, sing again and match it. This habit of singing first is what connects the sound in your head with your hands, and it is the most important thing in this whole method.',
        ],
        loop: { key: 0, mode: 'major', slots: ['I', 'IV'], tempo: 70, bars: 2 },
        examples: { tunes: ['mary'] },
      }),
    ],
  },
  {
    name: 'The whole octave',
    desc: 'Fa to Do\', then every key and melodies over common progressions.',
    about: 'The rest of the scale brings Fa, which leans down onto Mi, La, which leans down onto Sol, and Si, the leading note that pulls up into Do\'. With all seven notes you can play any melody in a major key and start using the scale to follow the chords of a progression. Once the octave is complete, the key starts to change from round to round, because staying in one key trains absolute pitch instead of function.',
    steps: [
      L('one-3', 'Fa fills the gap between Mi and Sol. It is the first note that really pulls: it leans down onto Mi, a half step below. Fixed-key levels play in the key chosen on the Levels screen; change it now and then.'),
      L('one-4', 'La is gentle and a little wistful; it likes to fall back to Sol.'),
      G({
        id: 'g-five', title: 'Melodies over I – V',
        intro: [
          'With Fa and La added, you know six of the seven notes, and with them most of the two most important chords in a major key: all of I (Do, Mi, Sol) and two notes of V (Sol and Re; its third note, Si, comes next). Most simple songs move back and forth between these two chords, and their melodies mostly land on notes that belong to the chord of the moment.',
          'That is the secret of melodies that sound intentional: on the strong beats, at the moment the chord changes, the melody sits on a chord tone, and in between it is free to move by step through other notes. In this guide you practise aiming for chord tones as the harmony changes.',
        ],
        tries: [
          'Over I, land on Do, Mi or Sol on the first beat. Over V, land on Sol or Re. Play slowly and only on the first beat of each chord at first, then fill in the gaps with steps.',
          'Sol is in both chords. Play it all the way through the loop and hear it stay calm while the harmony changes underneath: it is the fifth of I and the root of V. A note that two chords share is how melodies stay smooth across a change.',
          'Call and response: play a short phrase that ends on Re over V (the question), then answer it with a phrase that ends on Do over I. Most folk songs and nursery rhymes are built from exactly this pair of phrases; Ode to Joy is a famous example.',
          'Hum a phrase over the loop first, then find it on the string. Hearing a melody in your head before your fingers play it is the whole point of ear training, so keep this order even when it feels slow.',
        ],
        loop: { key: 0, mode: 'major', slots: ['I', 'V'], tempo: 80, bars: 1 },
        examples: { tunes: ['ode'] },
      }),
      L('one-5', 'Si, the leading note, is the most restless note of the scale. It sits a half step below Do\' and almost forces the music upward.'),
      L('one-6', 'The whole octave at once. If two notes still get mixed up, stop and sing from Do up to each of them.'),
      L('one-rk-major', 'The whole octave in a new major key each round. Let the cadence reset your ear each time; the names do not change.'),
      G({
        id: 'g-octave', title: 'The full scale over I – vi – IV – V',
        intro: [
          'You now know all seven notes of the major scale by ear, in any key. That means you have everything you need to work out simple melodies you already know, and to follow a four-chord progression with your own lines.',
          'The loop in this guide, I – vi – IV – V, is the "fifties progression" from countless doo-wop and pop songs. Each chord has three notes, and all of them come from the scale you just learned. Playing the roots, then the thirds, of each chord teaches you to hear how a progression moves, which is the foundation for the harmony stages later on.',
        ],
        tries: [
          'Si leans hard into Do. Play Si over V and resolve it to Do just as the loop comes back to I. Then try delaying it: hold Si into the I chord for a beat before you resolve, and feel how much tension a single note can carry.',
          'Play the root of each chord as it arrives: Do (I), La (vi), Fa (IV), Sol (V). This is the bass line of the progression. Sing it along with the loop until you could sing it without the guitar.',
          'Now play the third of each chord instead: Mi, Do, La, Si. Thirds sound more melodic than roots because they carry the chord\'s colour (major or minor). Notice how close the thirds are to each other; the line hardly moves.',
          'Work out a tune you know by singing it in solfège first. Happy Birthday starts Sol Sol La Sol Do\' Si; Twinkle, Twinkle starts Do Do Sol Sol La La Sol. Find the first note relative to Do, then follow each step up or down. Open the songbook to check yourself after you have tried.',
        ],
        loop: { key: 7, mode: 'major', slots: ['I', 'vi', 'IV', 'V'], tempo: 80, bars: 1 },
        examples: { tunes: ['twinkle', 'birthday'], progs: ['fifties'] },
      }),
    ],
  },
  {
    name: 'Across the neck',
    desc: 'The same octave in three box patterns, in a new key every round.',
    about: 'A single string makes the steps of the scale easy to see, but real playing happens across the strings in compact positions. The three box patterns cover the octave in different places on the neck. Here the key changes every round, so the box slides to a new place each time; the names stay the same in every pattern and every key, so your ear does the same work while your hands learn new shapes.',
    steps: [
      L('pA-6', 'Pattern I, the whole octave in the fixed key. Look for Do first, then let the shape grow around it. You learn the shape once here; the next steps move it.'),
      L('pA-rk-major', 'Pattern I in a new key every round. The box slides to a new place; find Do, then the note relative to it.'),
      L('pB-rk-major', 'Pattern II in random keys. Same notes, lower and wider, with the root on the low E string.'),
      L('pC-rk-major', 'Pattern III in random keys, higher up. This is where many solos live.'),
      G({
        id: 'g-patterns', title: 'One melody, three patterns',
        intro: [
          'The patterns change the shapes under your fingers but not the names of the notes. Do is still home and Si still pulls up to it, whichever pattern you are in and wherever the key puts it. Moving freely between patterns is how the whole neck becomes one familiar place instead of a set of separate boxes.',
          'The loop here is ii – V – I, the most common way to approach home in jazz and much pop music. It also gives each pattern a clear target: the line moves through the chords and resolves on Do when I arrives.',
        ],
        tries: [
          'Play the scale up and down in Pattern I, one note per beat, and keep going when the chord changes. Do not stop at the end of the pattern; turn around and come back. Say the note names out loud as you go so the names stay attached to the sounds.',
          'Do the same in Pattern II, then switch pattern each time the loop starts again. The first few switches will feel clumsy; slow the tempo down on the backing track rather than skipping notes.',
          'Over ii land on Re, over V on Si, over I on Do. That three-note line is the heart of ii – V – I. Find it in each pattern and notice that it is the same sound everywhere.',
          'Play your tune from the last guide in each pattern. Start by finding Do in the pattern, then let your ear lead: sing the next note, guess where it is, and correct yourself if you are wrong.',
        ],
        loop: { key: 2, mode: 'major', slots: ['ii', 'V', 'I'], tempo: 80, bars: 1 },
        examples: { progs: ['two-five'] },
      }),
    ],
  },
  {
    name: 'Chords and harmony',
    desc: 'Major or minor, then I, IV and V by ear.',
    about: 'So far you have heard single notes against a key. Songs are also made of chords, and the chords are what you play when you accompany yourself or others. This stage teaches you to hear the colour of a chord (major or minor) and its job in the key: home, away or tension. Those three jobs, played by I, IV and V, harmonise thousands of songs.',
    steps: [
      D('d-quality', 'Major or minor, from a single chord on any root. Listen to the middle note of the arpeggio, the third.'),
      D('d-func-145', 'After the cadence, one chord: is it I (home), IV (away) or V (tension)? Hear how much it wants to move.'),
      G({
        id: 'g-chords', title: 'Three chords and the truth',
        intro: [
          'Every chord in a key has a job. I is home: it sounds finished and lets a song end. IV moves away from home and sounds open, like a step into a bigger room, but it is happy to return without any drama. V carries tension, because it contains Si, the leading note, which wants to rise to Do. A song that goes I – IV – V – I tells a tiny story: home, journey, conflict, resolution.',
          'The chords of the loop are shown above it, with their numerals. Strum them along with the loop and listen for the jobs, not just the shapes. Then use your melody skills: the notes of each chord are the safe notes to sing or play over it.',
        ],
        tries: [
          'Strum the chords shown above the loop (barre or open, whatever you know). Say the numeral out loud as each chord arrives: one, four, five, one. Close your eyes after a few rounds and keep naming them by sound.',
          'Sing the bass line Do – Fa – Sol – Do with the loop. This is the most reliable way to identify chords by ear: the bass note is usually the root, and you already know how to name single notes.',
          'Over each chord, play its three notes one by one (Do Mi Sol, Fa La Do, Sol Si Re). Then sing them. You are learning what each chord is made of, which is what lets you hear it later.',
          'Play Twinkle, Twinkle or Mary Had a Little Lamb from the songbook with the chords shown, strumming each chord when it changes. Notice that the melody almost always has a chord tone on the strong beats.',
          'Hold a single chord (V) and stop the loop. Feel how badly it wants to go to I. Then play IV and stop. IV can stand alone for a while; V cannot. That difference is the harmony of the major key in a nutshell.',
        ],
        loop: { key: 9, mode: 'major', slots: ['I', 'IV', 'V', 'I'], tempo: 80, bars: 1 },
        examples: { tunes: ['twinkle', 'mary'], progs: ['three', 'vamp'] },
      }),
    ],
  },
  {
    name: 'Intervals and phrases',
    desc: 'Two notes, then short melodies, then singing them first.',
    about: 'Melodies are sequences of notes, and the distance between two notes is an interval. Instead of learning intervals as abstract sizes, here you hear them as movements between degrees of the key: Do to Sol, Mi to Fa, Si to Do\'. You learn them in Pattern I, which you already know from the Across the neck stage. Then the sequences get longer, and finally you sing the notes before you find them, which is the core skill of playing by ear.',
    steps: [
      L('pA-pairs-oct', 'Pairs from the whole octave in Pattern I. Name both: the first against the cadence, the second against the first. Wide leaps are easier if you hear the target note\'s character rather than measuring the distance.'),
      L('pA-pairs-rk', 'Pairs in random keys. The key changes, the movement between degrees does not.'),
      L('pA-dict-2', 'Two-note dictation over a short melody. Keep the cadence in your head; every note is still heard against Do.'),
      L('pA-dict-3', 'Three notes. Sing the phrase back before you answer, so you hold it in memory instead of chasing the sound.'),
      L('pA-dict-rk', 'Four-note dictation in a new key every round.'),
      G({
        id: 'g-phrases', title: 'Take dictation from real music',
        intro: [
          'The phrases you just took down are made of the same moves as real melodies: steps up and down, small leaps between chord tones, and an ending on a stable note. The next step is to hear those moves in music you already know, and to make up your own over a loop.',
          'Dictation from real music works like the levels, with one difference: nobody plays you a cadence first. You have to find Do yourself, and the easiest place to find it is at the end of a song, because nearly every song ends on its home note.',
        ],
        tries: [
          'Play a two-note phrase over the loop, then echo it in another pattern or an octave higher. Notice how the same two degrees sound the same in any place, even though your fingers move differently.',
          'Pick a song you know well. Its last note is usually Do: hum it, find it on the neck, then work out the first three notes of the song from there by singing each one and comparing. Write them down in solfège.',
          'Write three short phrases in solfège, for example Mi Re Do, Sol La Sol and Do Mi Sol. Play each over the loop and notice which chords they fit: Mi Re Do settles best over I, while Sol La Sol sounds good over I and IV.',
          'Open Mary Had a Little Lamb in the songbook. Before revealing the notes, play it once, find Do on your guitar, and work out the first phrase by ear. Then reveal and check.',
          'Real music gives you no cadence, so make one yourself: strum the chords shown above the loop for a round, then play a phrase that starts on Do. Your ear needs that anchor before it can trust the notes that follow.',
        ],
        loop: { key: 5, mode: 'major', slots: ['I', 'vi', 'IV', 'V'], tempo: 70, bars: 2 },
        examples: { tunes: ['mary', 'frere'] },
      }),
      L('pA-sing-1', 'Sing Do, Re or Mi when you see its name, then play it. Turn the mic on and answer on the guitar rather than tapping: the point is ear to hands.'),
      L('pA-sing-oct', 'Sing any note of the octave from its name, then play it with the mic on. If you get lost, sing up from Do until you reach it.'),
      L('pA-sing-p3', 'Three-note phrases to sing, then play. Answer on the guitar with the mic on; this is playing by ear in miniature.'),
      L('pA-sing-rk', 'The same in a new key each round. Sing first, then play it with the mic on, so your hands learn to follow your voice anywhere.'),
      G({
        id: 'g-sing', title: 'Sing it, then play it',
        intro: [
          'This is the goal of the whole method: to play what you hear in your head. Your voice is the bridge between the idea and the fretboard, because you can always sing a melody before you know where it lies on the guitar. Once you can sing a phrase and name its notes, finding them on the neck is just a matter of knowing where the names are.',
          'Do not worry about having a good voice. Singing quietly and roughly in tune is enough; what matters is that you hear the note clearly in your head before your fingers move.',
        ],
        tries: [
          'Sing a short phrase over the loop without the guitar. Then find it on the neck, one note at a time, singing each note again just before you play it.',
          'Start with two notes. Add a note only when it feels easy, up to four or five. If a phrase falls apart, shorten it again; it is better to play three notes right than five notes nearly right.',
          'Lost a note? Sing from it down (or up) to Do and count the steps. That walk back home names any note in the scale, and the app\'s "resolve to Do" feature is designed to train exactly this.',
          'Improvise by singing and playing at the same time, the guitar doubling your voice. Jazz guitarists like George Benson made this famous; it forces your hands to follow your ear rather than your habits.',
        ],
        loop: { key: 4, mode: 'major', slots: ['I', 'IV'], tempo: 70, bars: 2 },
        examples: { tunes: ['row'] },
      }),
    ],
  },
  {
    name: 'Progressions',
    desc: 'All the chords of a major key, moving.',
    about: 'Songs rarely stay on one chord. A progression is a sequence of chords, and a small number of progressions are used over and over in popular music. In this stage you learn the minor chords of a major key (ii, iii and vi), follow progressions chord by chord, and then learn to recognise the most famous ones as whole shapes, the way you recognise a word without spelling it.',
    steps: [
      D('d-func-dia', 'All six common chords of a major key. Decide major or minor first, then find the root by singing down to Do.'),
      D('d-prog-145', 'Four chords starting on I, then three to name in order. Sing the bass line along to follow it.'),
      D('d-prog-dia', 'Progressions with ii and vi as well. The minor chords darken the sound for a moment; the bass tells you which one.'),
      D('d-named-major', 'Six famous progressions to recognise as a whole. Learn each one in the songbook before you start.'),
      G({
        id: 'g-progressions', title: 'Hear the loop, play the song',
        intro: [
          'The pop progression I – V – vi – IV, the fifties progression I – vi – IV – V and the jazz ii – V – I are behind a huge share of the songs you know. Once you can recognise them by ear, working out a song\'s chords stops being guesswork: you listen to one cycle, recognise the shape, and then only have to find home on your guitar to play along.',
          'The method is always the same. First, find Do: the note (and chord) the song wants to rest on. Second, follow the bass line and name each bass note in solfège. Third, decide for each bass note whether the chord above it is major or minor. In a major key, Do, Fa and Sol in the bass usually carry major chords (I, IV, V); Re, Mi and La usually carry minor ones (ii, iii, vi).',
        ],
        tries: [
          'Play along with this loop (I – V – vi – IV) using the chords shown above it. Then open the pop progression in the songbook and change the key: the numerals stay the same; only the chord shapes move.',
          'Put on a recording of one of the songs listed under the pop or fifties progression in the songbook. Find the home chord on your guitar first, then strum the progression along with the recording. You don\'t need the original key; any key where it matches is right.',
          'Pick a song you like and try the method above: home note, bass line in solfège, major or minor above each bass note. Write down the numerals, then play them in two different keys.',
          'Start the pop loop on vi instead of I (vi – IV – I – V) and notice how the same chords suddenly sound sad. The key has not changed, only where the loop starts. That is why the bass and your sense of home matter more than the chord names.',
          'Improvise a melody over the loop using chord tones on the first beat of each chord: Mi or Sol over I, Re or Si over V, Do or Mi over vi, La or Do over IV. You are now composing over a real song structure.',
        ],
        loop: { key: 10, mode: 'major', slots: ['I', 'V', 'vi', 'IV'], tempo: 90, bars: 1 },
        examples: { progs: ['pop', 'fifties', 'sad', 'two-five'], tunes: ['jingle'] },
      }),
    ],
  },
  {
    name: 'Minor',
    desc: 'The minor scale in Pattern II, its chords and its darker colours.',
    about: 'Minor keys have their own home: a minor chord, with Me instead of Mi. The minor scale lowers three notes of the major scale (Me, Le and Te), and each lowered note brings its own shade. Its chords are different too: i, iv and v are minor, while III, VI and VII are major, and most songs borrow a major V for a stronger pull home. You learn it in Pattern II, a new place on the neck, so the minor sound is not tied to the shapes of major.',
    steps: [
      L('pB-minor-oct', 'The natural minor scale in Pattern II, Do to Do\'. Me, Le and Te are the notes that make it minor; listen for their weight.'),
      L('pB-rk-minor', 'Pattern II in a new minor key every round. The names do not change.'),
      L('pB-pairs-minor', 'Pairs in minor. Many feel like their major cousins, just shadowed.'),
      L('pB-dict-minor', 'Four-note melodies in minor. Sing Do, Me, Sol before each round to keep the minor chord in your ear.'),
      D('d-func-minor', 'The chords of a minor key, one at a time after the minor cadence.'),
      D('d-prog-minor', 'Minor progressions: i first, then three chords to name. Follow the bass as it walks down.'),
      G({
        id: 'g-minor', title: 'Minor colours over i – VII – VI – V',
        intro: [
          'Same Do, different scale. In minor, three notes are lowered: Me, Le and Te. Together they carry most of the minor sound, and each has its own role. Me makes the home chord minor, Le sighs down onto Sol, and Te gives a modal, folk-like colour that you hear in rock and Celtic music.',
          'The loop here is the Andalusian cadence: i – VII – VI – V. Its bass walks down Do, Te, Le, Sol, and the last chord is a major V that borrows the raised Si from harmonic minor, so it pulls back to i with real force. It is one of the oldest and most recognisable progressions in Western music.',
        ],
        tries: [
          'Hold Me over i and listen to how that minor third darkens the whole chord. Then play Mi over the same chord and hear it clash: in a minor key, Me is home and Mi is the stranger.',
          'Over VI, play Le and let it fall to Sol when V arrives. That half-step sigh is the most expressive move in minor; you hear it in everything from Bach to film scores.',
          'Over V (a major chord here), play Si, the raised seventh, and resolve it up to Do as i comes back. Then try Te over V and hear how it fights the chord. That fight is why minor songs borrow Si for their V.',
          'Play one of your major phrases in minor: same steps, but with Me, Le and Te where Mi, La and Si were. Then open Greensleeves or Drunken Sailor in the songbook and work out the first phrase by ear before revealing it.',
          'Strum the chords shown above the loop, singing the bass line Do – Te – Le – Sol. If you can sing it, you will recognise it in songs like Hit the Road Jack.',
        ],
        loop: { key: 9, mode: 'minor', slots: ['i', 'VII', 'VI', 'V'], tempo: 80, bars: 1 },
        examples: { tunes: ['greensleeves', 'sailor'], progs: ['andalusian', 'minor-cadence', 'epic'] },
      }),
    ],
  },
  {
    name: 'Keys of melodies',
    desc: 'Finding the key of a tune by ear.',
    about: 'Solfège names are relative to Do, so a tune you know in one key is the same tune in any key. The real world, though, never tells you the key: a song on the radio is just sound, with no cadence before it. Your note skills already work in random keys; this stage trains the step that comes before everything else when you play by ear: hearing whether a tune is major or minor and finding its home note on the guitar.',
    steps: [
      D('d-mode', 'A short tune with no cadence: major or minor? Find home, then listen to the third above it.'),
      D('d-tonic-major', 'Find the home note of a major tune. Audition notes freely; commit when one sounds like the end.'),
      D('d-tonic-any', 'The same with minor tunes mixed in. Home is where the tune comes to rest.'),
      G({
        id: 'g-keys', title: 'Find the key, then everything follows',
        intro: [
          'You can now name notes and chords in any key, and you can hear where home is in a melody you have never heard before. Put together, that is how you find the key of a song: listen to where it comes to rest, sing that note, find it on the neck, and decide whether the home chord is major or minor. Once you know Do, every note and chord has a name.',
          'This guide moves your melodies between keys. Moving a tune is called transposing, and with solfège it costs nothing: you only need to find the new Do, and the shapes of the patterns carry everything else along with it.',
        ],
        tries: [
          'Before playing anything, find Do by humming the first chord\'s root and matching it on the neck. Then play the scale in a pattern that starts from that note.',
          'Play a tune you know over this loop, then change the key of the backing track a few times and play it again in each. Find Do first every time; the rest of the tune follows the same steps.',
          'Change key without looking at the chord names. Find Do by ear first, then check. If you get it wrong, notice which note you chose: people often pick Sol, the fifth, which is also stable.',
          'Put on a song and find its key: hum the note it ends on (or the note the chorus keeps returning to), find it on your guitar, and try both the major and the minor chord on that note. The one that sounds right is the key.',
          'Open any tune in the songbook, pick a random key, press Play, and find Do on your guitar before you look at the key name.',
        ],
        loop: { key: 7, mode: 'major', slots: ['I', 'vi', 'IV', 'V'], tempo: 90, bars: 1 },
        examples: { tunes: ['grace', 'godrest'] },
      }),
    ],
  },
  {
    name: 'Songs by ear',
    desc: 'Real melodies and progressions, from hearing to playing.',
    about: 'This is where the skills come together. You take down phrases of real tunes in solfège, recognise progressions of both modes, and then follow a complete method for learning a song by ear: find the key, map the chords, take down the melody, and play it all on the guitar, in any key.',
    steps: [
      D('d-tune-major', 'Phrases of well-known major tunes, answered note by note. If you know the tune, sing it in your head as you answer.'),
      D('d-tune-minor', 'Phrases of minor tunes, including the raised La and Si some of them use.'),
      D('d-named-all', 'All ten progressions, major and minor, including the twelve-bar blues. Decide the mode first.'),
      G({
        id: 'g-songs', title: 'Learn a song by ear',
        intro: [
          'Here is a complete method for learning a song from a recording, using everything on the path. It works for any style, and it gets faster every time you use it. Start with simple songs, folk songs and pop songs with a clear melody, and work up to harder ones.',
          'One: find home. Listen to the end of the song or the end of the chorus, hum the note it rests on, find it on the guitar, and try the major and minor chord on it. Two: map the chords. Listen to one cycle of the verse, follow the bass in solfège, decide major or minor above each bass note, and check whether it is a progression you already know. Three: take down the melody, one phrase at a time, singing each phrase before you look for it on the neck. Four: play it, first the chords while you sing, then the melody, then both in a second key.',
        ],
        tries: [
          'Use the songbook as a practice ground. Choose a tune, set a random key, press Play without revealing the notes, and go through all four steps: home note, chords, melody, playing. Reveal only to check.',
          'Choose one real song a week. Write its chords as numerals and its melody in solfège in a notebook, then play it in two keys and two positions on the neck. After a few months you will have a repertoire you truly understand.',
          'Sing a song you know well and play its chords along, without any recording. If you get stuck on a chord, sing the bass note under the melody at that point and name it.',
          'Over this loop (the pop progression), improvise a new melody of your own, singing it first. Then write it down in solfège. Composing is ear training in reverse: hearing something that does not exist yet and finding it.',
          'Come back to the drills from time to time in a new key and at a faster tempo. Ear skills fade slowly but they do fade, and the daily practice session keeps the note skills sharp.',
        ],
        loop: { key: 2, mode: 'major', slots: ['I', 'V', 'vi', 'IV'], tempo: 90, bars: 1 },
        examples: { tunes: ['twinkle', 'ode', 'grace', 'greensleeves', 'sailor'], progs: ['pop', 'epic', 'blues'] },
      }),
    ],
  },
  {
    name: 'Chromatic colour',
    desc: 'The notes between the notes, in Pattern III.',
    about: 'Between the seven notes of the scale there are five more, and good melodies use them for colour and tension: blue notes, passing notes, and notes borrowed from the other mode. Each chromatic note has its own name (Ra, Me, Se, Le, Te) and almost always leads by a half step to a scale note next to it. You hear them in Pattern III, the highest of the boxes, so the new sounds come with a new place on the neck.',
    steps: [
      L('pC-majorChrom-oct', 'Every note of the octave over a major key, in Pattern III. A chromatic note almost always wants to move a half step; listen for where.'),
      L('pC-minorChrom-oct', 'The same over a minor key, where La and Si are the outsiders.'),
      G({
        id: 'g-chrom', title: 'Blue notes and approach notes',
        intro: [
          'Chromatic notes add tension. On their own they sound wrong, but as a short stop on the way to a scale note they make a melody sound expressive and sophisticated. The rule of thumb is simple: a chromatic note sounds good when it leads somewhere by a half step and gets there quickly.',
          'Blues is built on this. Its "blue notes" are Me, Se and Te played over major chords, bending between the minor and the major sound. The twelve-bar blues in the songbook gives you the classic form to try them over.',
        ],
        tries: [
          'Over I, play Me and slide or hammer it up to Mi. That rub between minor and major third is the blues in two notes. Try it in different patterns and octaves.',
          'Play Te over I and let it fall to La. It gives the rock and folk colour of the mixolydian mode, the sound of many sixties songs.',
          'Before each chord arrives, play the note a half step below its root, then the root on the downbeat. This chromatic approach note is used by bass players and jazz guitarists everywhere.',
          'Play the twelve-bar blues from the songbook and improvise with Do, Me, Fa, Sol and Te (the minor pentatonic), adding Mi over I and La over IV. Listen to which notes feel tense over which chord.',
          'Drunken Sailor raises La in a minor key, the dorian sixth. Learn its third line by ear and hear how that one bright note changes the mood.',
        ],
        loop: { key: 4, mode: 'major', slots: ['I', 'IV'], tempo: 80, bars: 2 },
        examples: { progs: ['blues'], tunes: ['sailor'] },
      }),
    ],
  },
  {
    name: 'The whole neck',
    desc: 'Any octave, any position, any key.',
    about: 'The last stage removes the remaining boundaries: notes come from any octave, you answer anywhere on the neck, and the key changes every round. When you can do this, the fretboard is no longer a map you have to read but an instrument you hear with.',
    steps: [
      L('neck-major-oct', 'One octave, but answer anywhere on the neck. Find the nearest Do, then the note relative to it.'),
      L('neck-major-2oct', 'Two octaves. The octave matters now: listen for whether the note is above or below the last Do you heard.'),
      L('neck-rk-all', 'Any note, any octave, major or minor, new key every time.'),
      L('neck-dict-5', 'Five-note melodies across the neck. This is close to taking down a real solo.'),
      G({
        id: 'g-free', title: 'Play what you hear',
        intro: [
          'You can hear a note in any key and find it anywhere on the neck, take down melodies, recognise chords and progressions, and find the key of a song by ear. That is the full toolkit for playing by ear. From here on it is practice and music: the more songs you learn this way, the faster and more natural it becomes.',
          'Keep three habits. Sing before you play, so your hands follow your ear. Name what you hear in solfège and numerals, so you understand it and can move it to any key. And play real music every day, because the drills are only the warm-up for that.',
        ],
        tries: [
          'Build your own loops on the Backing track screen and improvise over them, singing first. Try a minor loop like this one (i – VI – III – VII) and use what you learned about Me, Le and Te.',
          'Learn one new tune a week by ear, using the method from the Songs by ear guide, then play it in two keys and two positions.',
          'Take down a short guitar solo or vocal line from a recording. Slow it down if you need to; the method is the same as the dictation levels, just without a cadence.',
          'Use Daily practice every day: it picks warm-ups, weak notes and phrases from your stats. Ten minutes a day does more than an hour once a week.',
        ],
        loop: { key: 9, mode: 'minor', slots: ['i', 'VI', 'III', 'VII'], tempo: 90, bars: 1 },
        examples: { progs: ['epic'], tunes: ['greensleeves'] },
      }),
    ],
  },
];

/** Every step in order, each with its position: { ...step, stage (index), n (index in STEPS) }. */
export const STEPS = STAGES.flatMap((s, stage) => s.steps.map((step) => ({ ...step, stage }))).map((s, n) => ({ ...s, n }));

const LEVELS = new Map(CHAPTERS.flatMap((c) => levelsFor(c.id)).map((l) => [l.id, l]));
/** The level spec of a level step (null for anything else). */
export const levelOf = (step) => (step.kind === 'level' ? LEVELS.get(step.id) ?? null : null);
/** The drill spec of a drill step (null for anything else). */
export const drillOf = (step) => (step.kind === 'drill' ? drillById(step.id) : null);

/** Done: a level or drill passed, or a guide marked done. `guides` is an array or Set of guide ids. */
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
/** The path step of a level or drill id, or null when it is not on the path. */
export const stepOf = (id) => STEPS.find((s) => s.kind !== 'guide' && s.id === id) ?? null;

/** The step's display name: the level's title ("Major scale · Do – Mi", with its chapter), the drill's or the guide's. */
export function stepTitle(step) {
  if (step.kind === 'guide') return step.title;
  if (step.kind === 'drill') return `Ear drill · ${drillOf(step).name}`;
  const l = levelOf(step);
  const ch = CHAPTERS.find((c) => c.id === l.chapterId);
  return `${ch.name} · ${l.title}`;
}

/** A guide's intro as paragraphs. */
export const guideParagraphs = (g) => [].concat(g.intro);

/** Keep only known guide ids, once each. */
export const normalizeGuides = (raw) => (Array.isArray(raw) ? [...new Set(raw.filter((id) => guideById(id)))] : []);
