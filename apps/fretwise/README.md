# Fretwise

Bite-sized, game-like lessons that teach you to **sight-read on guitar**: see a note on the staff, know
its name, know where it lives on the neck — and read rhythms, accidentals, key signatures and real tunes.

It runs on this computer and is reachable from every phone, tablet and laptop on your home network.
Nothing leaves the network and there are no accounts: open it and play.

## Use it

| | Address |
|---|---|
| Everyday use | `http://<this-computer>:8420` |
| With microphone ("play my real guitar") | `https://<this-computer>:8421` |

```bash
./fretwise.sh start      # run in the background (keeps running after you log out)
./fretwise.sh status     # is it up, and at which addresses?
./fretwise.sh stop
./fretwise.sh restart
./fretwise.sh logs
```

`start` prints the exact addresses for this machine. To have it come back by itself after a reboot:

```bash
./fretwise.sh autostart-on     # installs a systemd *user* service (no root needed)
./fretwise.sh autostart-off    # removes it again
```

If the script says the service only runs while you are logged in, run the one command it suggests
(`sudo loginctl enable-linger <you>`).

Requirements: Node.js 18 or newer. There is nothing to install — no dependencies, no build step.
Browsers: anything from 2022 or later (Chrome, Edge, Firefox, Safari 15.4+).

Tip for phones: open the address once, then use the browser's "Add to Home Screen" for an app-like icon.

### Playing with a real guitar (microphone)

**My guitar (mic)** is the default way to answer (**Settings → Answer with** switches to the on-screen fretboard).
Lessons then need nothing but the guitar: the teaching cards turn when you play the note they show (or any note),
every note, phrase and rhythm is played, and each result moves on by itself after a moment — about a second when
you were right, a little longer when you were not. If the microphone is unavailable or refused, Fretwise says so
and uses the on-screen fretboard instead. There is also a tuner under Practice.

Browsers only allow microphone access on secure pages, so on any device other than this computer use the
`https://…:8421` address. The certificate is made by your own machine, so the first visit shows a
warning — choose *Advanced → Proceed* (Safari: *Show details → visit this website*). It is safe: the
connection goes to your own computer. Pitch detection is tested here against synthesised guitar notes;
real rooms vary, so put the device close to the guitar and play one clear note at a time.

iPhone/iPad: sound from web pages follows the ring/silent switch — unmute it to hear notes and the metronome.

## What is in it

* **63 lessons in 10 units** — the six strings of the open position one at a time, then sharps and flats,
  key signatures, fifth position, and the whole neck to the 12th fret. Rhythm is woven in: quarter/half/whole
  notes, rests, eighths, three-four time, dotted notes, ties, sixteenths and syncopation.
* **Lessons are played, not quizzed.** A short run of teaching cards (what the notes, rests, dots, ties, signs and key
  signatures mean) is followed by three kinds of exercise, all answered on the guitar: *play one note* read from the
  staff, *play a phrase* (plain notes, tunes with a rhythm, or a phrase of a real song), and *play a rhythm* after
  hearing it and a count-in. Two wrong notes on a single note show where it is on the neck; the note then comes back
  once at the end of the lesson. Accidental lessons are phrases that put the bar-line rule and the natural sign to
  work. The Practice sprint also has a "name the note" mode.
* **19 songs**, all public domain (Ode to Joy, Für Elise, Greensleeves, Minuet in G, Romanza …), learned
  phrase by phrase and kept in a songbook with playback.
* **The game layer** — XP, levels, a daily goal, streaks, stars, awards, and a second chance at
  every mistake at the end of the lesson.
* **Memory that adapts** — every note has its own strength that fades with time; lessons and the
  "review weak notes" round lean towards the notes you are shakiest on. The profile page shows the
  whole neck as a memory map.
* **Practice area** — review, a one-minute sprint, a rhythm gym (played on the guitar too), the songbook and a tuner.
* **Already know the basics?** Tap *Jump here* on a later unit and pass a short placement test.
* Left-handed and "low E on top" fretboard views, light/dark theme; no names or players, one progress that you can reset in Settings.

Progress is one anonymous document, stored on this computer (`data/profiles/*.json`), so it follows you from device to device. If a server holds several (older versions kept one per player), the one with the most XP is used.
If the server is unreachable for a moment, the browser keeps your progress and sends it later.

## Housekeeping

* **Back up** by copying the `data/profiles` folder.
* **Ports**: `PORT=9000 HTTPS_PORT=9443 ./fretwise.sh start` (`HTTPS_PORT=0` switches the secure port off).
* **Who can reach it**: anyone on your network, without a password — it is meant for a home LAN.
  Do not forward these ports to the internet.
* **Firewall**: if other devices cannot connect, allow TCP 8420 and 8421 (e.g. `sudo ufw allow 8420,8421/tcp`).
* **Certificate**: kept in `data/cert`; it is recreated automatically when this computer's address changes.

## For developers

Fretwise is one of the apps of the Fretboard Ears repository. It is also published, without this server, at
https://a-local-bear.github.io/fretboard-ears/fretwise/ — there the app notices that there is no `/api` and keeps
progress in the browser instead (`public/js/store.js`). All addresses in `public/` are relative so
the app works from a subfolder.

```
server.js            zero-dependency server: static files, profile API, HTTP + HTTPS
public/              the web app (plain ES modules, no build step)
  js/theory.js         pitches, staff positions, fretboard maths
  js/notation.js       staff renderer (SVG), glyph outlines in js/glyphs.js
  js/fretboard.js      interactive fretboard (SVG)
  js/synth.js audio.js plucked-string synthesis, sounds, metronome
  js/pitch.js mic.js   pitch detection (YIN) and microphone input
  js/curriculum.js songs.js   the course and the songbook
  js/generate.js       turns a lesson description into exercises
  js/exercises.js lesson.js   exercise screens and the lesson runner
  js/progress.js store.js     XP/streak/memory logic, saving and syncing
  js/views.js practice.js main.js   screens and routing
tests/               node --test: unit tests plus end-to-end runs of the real app
tools/               regenerate glyphs / icons from their sources
```

```bash
node --test
```

The end-to-end tests boot the real server and run the real app code inside a small stand-in browser
(`tests/support/fake-dom.mjs`) — playing lessons by "tapping" what is on screen, tapping
rhythms against a virtual clock, and playing whole lessons into a pretend microphone, without a click. `tests/support/raster.mjs`
is a small SVG rasteriser used to eyeball notation and to produce the app icons. Layout in a real browser
is the one thing these tests cannot see.

## Credits

* Music symbols: outlines from **Bravura** © Steinberg Media Technologies GmbH — SIL Open Font License 1.1
* Typeface: **Nunito** © The Nunito Project Authors — SIL Open Font License 1.1
* Icons: **Phosphor Icons** — MIT License
* Licence texts are in `public/licenses/`. All tunes are traditional or long out of copyright;
  "Sixth String Stomp" was written for this course.
