# Woozy

One of the apps of the Fretboard Ears repository. It is also published, without its server, at
https://a-local-bear.github.io/fretboard-ears/woozy/, where songs and progress stay in the browser.

An interactive course for writing bedroom-pop / indie chord progressions and
melodies on guitar — in the neighbourhood of Mac DeMarco, Steve Lacy, Men I
Trust and King Krule. It assumes you already know open chords, barre chords and
the notes on the fretboard, and takes you from there to finished songs.

Everything is playable: the app synthesises guitar, bass and drums in the
browser, so every chord, progression, strum pattern and melody can be heard,
transposed and edited before you try it on a real guitar.

## Run it

```bash
node server.js
```

Then open the address it prints:

- on this machine: <http://localhost:3210>
- on any other device on the same network: `http://<this-machine's-IP>:3210`

No install step and no dependencies — it only needs Node 18 or newer.

| Setting | Default | Example |
| --- | --- | --- |
| `PORT` | `3210` | `PORT=4000 node server.js` |
| `HOST` | `0.0.0.0` (whole network) | `HOST=127.0.0.1 node server.js` (this machine only) |
| `WOOZY_DATA` | `./data` | `WOOZY_DATA=~/woozy-data node server.js` |

### Can't reach it from another device?

This machine's firewall probably blocks the port. With `ufw`:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3210 proto tcp
```

(Adjust the subnet to match your network.)

### Keep it running

```bash
scripts/install-service.sh          # run in the background, restart on login
scripts/install-service.sh remove   # undo
```

This installs a systemd *user* service; no root needed. To start it at boot
before anyone logs in, also run `sudo loginctl enable-linger $USER` once.

## What's in it

- **Course** — 27 lessons in 8 modules: keys and the number system, seventh
  chords and movable shapes, two-chord vamps, ii–V–I, minor and Dorian,
  borrowed chords, secondary dominants and chromatic moves, extensions, voice
  leading, embellishment, strumming and feel, chord-tone melody, pentatonics,
  motifs, guitar hooks, song form, a writing workflow, four artist style
  studies, and a capstone. Each lesson has playable examples, guitar tasks and
  a self-check quiz (including ear training and find-it-on-the-fretboard).
- **Studio** — write songs section by section: pick chords from a palette that
  knows the key (in-key, borrowed, secondary, anything), choose voicings, write
  a melody on a grid that shows each chord's tones, see it as tab, add words,
  play it back with a band, export a chord chart. A coach reads what you wrote
  and points out what the lessons would say about it.
- **Cookbook** — 45 progressions in the style, by mood, playable in any key.
- **Chord library** and **Scales & keys** — reference tools.

## Your data

Lesson progress and songs are saved by the server in `data/state.json`, so
every device that opens the app sees the same thing. Changes made on one
device appear on the others within about ten seconds. If two devices edit the
same song at the same moment, the second one's edits are kept as
“<title> (copy)” rather than overwriting anything.

If the server is unreachable, the app keeps working from the browser's own
storage and syncs when the server is back.

Back up by copying the `data/` folder. There is no login — anyone on your
network who can reach the port can read and change the songs, so don't expose
it to the internet.

## Sound

Use the speaker icon in the top bar for volume, wobble (chorus/vibrato), reverb
and tone. On a phone: tap any play button once (browsers keep audio off until
you do), and check the ring/silent switch.

## Development

```
server.js              zero-dependency static server + JSON API
public/
  index.html, css/app.css
  js/main.js           shell, router, settings
  js/store.js          progress + songs, server sync, offline queue
  js/songs.js          song model, chord resolution, text charts
  js/music/            theory (keys, chords, Roman numerals), voicings, melody tools
  js/audio/            plucked-string synthesis, instruments, sequencer
  js/ui/               chord diagrams, fretboard, tab, progression player,
                       melody editor, quizzes, other lesson widgets
  js/content/          the lessons and the cookbook (plain data)
  js/views/            home, lesson, studio, reference tools
tests/                 node --test
```

No build step: the browser loads the ES modules directly, and the server sends
`Cache-Control: no-cache`, so a refresh always picks up edits.

```bash
node --test      # theory, voicings, tuning of the synth, sequencer,
                 # every lesson example, and the server API
```

The tests check, among other things, that every movable chord shape contains
only notes of its chord in all twelve keys, that synthesised notes are in tune
to within a few cents, and that every progression, melody and tab written into
a lesson parses and fits its bars.

### Adding a lesson

Lessons are lists of blocks in `public/js/content/`. Progressions are written
as Roman numerals (`'Imaj7 | vi7 | ii7 V7 | Imaj7'`), melodies as scale degrees
with lengths in 8th notes (`'3:2 5 6 5:4'`), tab as `string/fret`
(`'2/5:2 2/7s:2'`). Add the lesson to a module in `curriculum.js` and run the
tests — they validate every block.
