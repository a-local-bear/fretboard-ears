# Fretboard Ears

Ear training for guitarists, following Alain Benbassat's functional method. A cadence sets the key,
you hear a note, and you find it on the guitar you are holding, by playing it or by tapping the fretboard.
The goal is to hear each note as its interval from the root, so you can play what you hear.

**Open the app:** https://a-local-bear.github.io/fretboard-ears/ (installable, works offline)

The site opens on a main menu with three apps: **Ear training** (below), **Songcraft**, which teaches
writing chord progressions and riffs (see [Songcraft](#songcraft)), and **Woozy**, a bedroom-pop songwriting
course and studio (see [Woozy](#woozy)).

## What's in it

- **One path in five stages**: the major scale, major with chromatic notes, the minor scale, minor with chromatic
  notes, and a last level with any note in any octave. The major scale grows from the triad, a note at a time, in a
  fixed key; from the whole octave on, every level picks a new key each time you start it. Each stage explains what
  it trains, every level has a tip, and the home screen always shows the next level. Nothing is locked.
- **Notes are named by number**: 1, ♭3, 5 on the dots, and root, flat third, fifth in the text and in speech.
  Letter names or plain dots are a setting.
- **Pick your position**: root on the E, A or D string, or the whole neck. It changes the shape under your fingers,
  not what you hear, so there is one score per level. Levels of more than one octave use the whole neck.
- **Dictation** at the end of each stage: two- and four-note phrases to play back. In the chromatic stages one note
  of the phrase comes from outside the scale.
- **Play it on your guitar**: with the microphone on, the app hears the note you play.
- **Each answer resolves to the root**, so you feel every note's pull home.
- **References:** cadence, the root alone, a drone, or nothing.
- **Listen hands-free**: a level plays itself, with the note, a pause to play it, then the answer spoken and resolved.
  Nothing is scored.
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

## Woozy

A third app in `woozy/`: https://a-local-bear.github.io/fretboard-ears/woozy/

- **A course** of 27 lessons in 8 modules on bedroom-pop and indie writing: keys and numbers, seventh chords and movable
  shapes, vamps, ii–V–I, Dorian, borrowed and chromatic chords, extensions and voice leading, strumming and feel,
  melody, song form, and style studies, each with playable examples, guitar tasks and a quiz.
- **Studio**: write songs section by section, with chords, voicings, a melody grid, tab, lyrics, band playback and a
  coach. Songs and progress are saved in the browser.
- **Cookbook** of 45 progressions by mood, a chord library and scales & keys.

It synthesises its own guitar, bass and drums, so it shares nothing but the site. It also runs on its own with a small
sync server, from its original project; here it is the static part only, and its tests are in `tests/woozy/`.

## Run locally

```sh
./serve.sh      # http://localhost:8080
node --test     # tests
```

Vanilla JS with no build step and no dependencies.

## Credits

Guitar samples: the FatBoy soundfont via [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts),
licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). See `samples/eg-clean/ATTRIBUTION.md`.
