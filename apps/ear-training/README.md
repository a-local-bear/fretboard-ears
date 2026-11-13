# Ear training

Ear training for guitarists, following Alain Benbassat's functional method. A cadence sets the key,
you hear a note, and you find it on the guitar you are holding, by playing it or by tapping the fretboard.
The goal is to hear each note as its interval from the root, so you can play what you hear.

**Open the app:** https://a-local-bear.github.io/fretboard-ears/ear-training/ (installable, works offline)

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

## Develop

```sh
../../serve.sh   # the whole site on http://localhost:8080; this app is at /ear-training/
node --test
```

`public/` is the app: plain ES modules, no build step. It has no server of its own; scores are kept in the browser.
`tools/fetch_samples.py` downloads the guitar samples again.

## Credits

Guitar samples: the FatBoy soundfont via [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts),
licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). See `public/samples/eg-clean/ATTRIBUTION.md`.
