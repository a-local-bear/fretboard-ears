# Fretboard Ears

Ear training for guitarists, following Alain Benbassat's functional method. A cadence sets the key,
you hear a note, and you find it on the fretboard by tapping or by playing it on your guitar.
The goal is to learn intervals by ear and play what you can sing, then hear the key, chords and melody of a song and play it.

**Open the app:** https://a-local-bear.github.io/fretboard-ears/ (installable, works offline)

The site opens on a main menu with two apps: **Ear training** (below) and **Songcraft**, which teaches
writing chord progressions and riffs (see [Songcraft](#songcraft)).

## What's in it

- **A progression path** in eleven stages, from your first four notes to learning whole songs by ear; random keys begin in stage 2 and each stage moves to a new part of the neck. Each stage explains what it trains, every step has a tip, and each stage ends with an in-depth guide of exercises over a backing loop, with tunes and progressions from the songbook to work out. The home screen always shows the next step.
- **Ear drills** beyond single notes: major or minor chords, chord functions (I IV V, all of major, minor), progression dictation, naming famous progressions, major or minor tunes, finding the key of a melody, and phrases of real songs.
- **A songbook** of public-domain tunes in solfège with their chords, and ten common progressions with songs that use them. Any key, melody and chords on their own or together, notes hidden until you've worked them out.
- **Levels** that grow one note at a time, across one string, three patterns and the whole neck.
  Major, minor and chromatic notes, in C or any key.
- **Degree pairs, melodic dictation and sing-and-find**, to move from single notes to playing back phrases.
- **Each answer resolves to Do**, so you feel every note's pull to the tonic.
- **References:** cadence, Do, drone, or nothing. Optionally the note sounds over a chord.
- **Listen hands-free**: a level plays itself, with the note, a pause to play it, then the answer spoken and resolved. Nothing is scored.
- **Backing track** with a few looping chords of your choice to play over.
- **Daily practice session, adaptive practice and stats**: streaks, accuracy per note, mix-ups and progress graphs.

## Songcraft

A second app in `songcraft/`, sharing the fonts, styles and guitar samples: https://a-local-bear.github.io/fretboard-ears/songcraft/

- **Lessons on chord progressions**: the seven chords of a key, home/away/tension, four-chord loops, harmonic rhythm,
  sevenths/add9/sus, borrowed chords, secondary dominants, ii–V–I, minor keys. Every example plays in the key you choose.
- **Lessons on riffs and melodies**: chord tones, the pentatonic, rhythm, motifs, passing notes and rubs, then indie
  (drones), pop (hooks) and jazzy (guide tones, approach notes) styles.
- **Chord builder**: up to eight chords with real guitar shapes, colours, lengths, strum patterns, suggestions for the
  next chord and a plain-language explanation of why the loop sounds the way it does.
- **Riff lab**: a step grid over your chords that marks which notes fit each chord, idea generators in three styles,
  a checklist of the rules the lessons teach, and the riff as tab and on the neck.
- Each lesson ends with a **challenge** checked live in the builder or the lab.

## Run locally

```sh
./serve.sh      # http://localhost:8080
node --test     # tests
```

Vanilla JS with no build step and no dependencies.

## Credits

Guitar samples: the FatBoy soundfont via [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts),
licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). See `samples/eg-clean/ATTRIBUTION.md`.
