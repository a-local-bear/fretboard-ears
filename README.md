# Fretboard Ears

Ear training for guitarists, following Alain Benbassat's functional method. A cadence sets the key,
you hear a note, and you find it on the fretboard by tapping or by playing it on your guitar.
The goal is to learn intervals by ear and play what you can sing.

**Open the app:** https://a-local-bear.github.io/fretboard-ears/ (installable, works offline)

## What's in it

- **A progression path** through the levels in eight stages. After each stage, a guide gives exercises over a backing loop so you put the new notes to use. The home screen always shows the next step.
- **Levels** that grow one note at a time, across one string, three patterns and the whole neck.
  Major, minor and chromatic notes, in C or any key.
- **Degree pairs, melodic dictation and sing-and-find**, to move from single notes to playing back phrases.
- **Each answer resolves to Do**, so you feel every note's pull to the tonic.
- **References:** cadence, Do, drone, or nothing. Optionally the note sounds over a chord.
- **Listen hands-free**: a level plays itself, with the note, a pause to play it, then the answer spoken and resolved. Nothing is scored.
- **Backing track** with a few looping chords of your choice to play over.
- **Daily practice session, adaptive practice and stats**: streaks, accuracy per note, mix-ups and progress graphs.

## Run locally

```sh
./serve.sh      # http://localhost:8080
node --test     # tests
```

Vanilla JS with no build step and no dependencies.

## Credits

Guitar samples: the FatBoy soundfont via [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts),
licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). See `samples/eg-clean/ATTRIBUTION.md`.
