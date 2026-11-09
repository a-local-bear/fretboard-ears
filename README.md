# Fretboard Ears

Ear training for guitarists. You hear a note in C major and tap where it is on the fretboard.
It's an installable PWA that works offline, written in vanilla JS with no build step and no dependencies.

## Run

```sh
./serve.sh          # stamps the service-worker version, serves http://localhost:8080
./serve.sh 9000     # other port
```

`http://localhost` counts as a secure context, so the service worker and "Install app" work without HTTPS.
From another computer, tunnel the port so the browser still sees `localhost`:

```sh
ssh -L 8080:localhost:8080 localbear@<server>
```

Then open http://localhost:8080 in Chrome or Edge and use the install icon in the address bar.

### On a phone (home network)

```sh
./serve.sh --lan    # prints the address to open, e.g. http://192.168.1.64:8080/
```

Over plain HTTP the app works as a normal web page, and progress is saved on the phone.
Chrome blocks the service worker on non-HTTPS addresses, so you can't install it or use it offline.
To get both without HTTPS on Android, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
add `http://192.168.1.64:8080`, enable it and relaunch Chrome. After that, use "Add to Home screen" or "Install app".

## Test

```sh
npm test            # or: node --test
```

Node is only used to run the tests. There are no npm packages.

## Layout

| Path | What |
|---|---|
| `index.html`, `style.css` | Shell and theme |
| `js/data.js` | Strings, chapters, note names and colours |
| `js/deck.js` | Question order per level (pure) |
| `js/progress.js` | Pass and unlock rules, best scores (pure) |
| `js/ks.js` | Karplus–Strong synthesis (pure) |
| `js/audio.js` | Web Audio playback and scheduling; switches between samples and synth |
| `js/samples.js` | Loads, trims and normalises the guitar samples |
| `js/fretboard.js` | SVG fretboard |
| `js/storage.js` | localStorage, persistence request, answer log |
| `js/ui.js` | State, screens, input |
| `js/main.js` | Boot, service worker registration, update toast |
| `sw.js` | Offline cache. The block between the STAMP markers is generated. |
| `tools/stamp_version.py` | Hashes the app files into the cache name and precache list |
| `tools/make_icons.py` | Regenerates `icons/*.png` (pure Python) |
| `tools/fetch_samples.py` | Downloads the guitar samples into `samples/eg-clean/` |
| `tools/serve.py` | Local static server with correct MIME types |

## Updating

Edit files, then restart `./serve.sh` (or run `python3 tools/stamp_version.py`).
Open copies of the app show "A new version is ready" and update when you tap Reload.
If you add a new kind of file, also add its glob to `PATTERNS` in `tools/stamp_version.py`.

## Sounds

By default notes play from recorded clean electric guitar samples: MIDI 40–76 (E2–E5) in `samples/eg-clean/`, about 660 KB, cached for offline use.
They come from the FatBoy soundfont via [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) and are licensed
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). See `samples/eg-clean/ATTRIBUTION.md`. That licence covers the sample files only.
Re-download them with `python3 tools/fetch_samples.py`.

Settings → Sound switches to **Synth**, the original Karplus–Strong plucked string (`js/ks.js`).
The synth also plays any note whose sample hasn't loaded yet.

## Stored data (localStorage)

- `fe-settings`: `{labels: "solfege"|"letters"|"hidden", ref: "cadence"|"do"|"none", sound: "guitar"|"synth"}`
- `fe-progress`: `{best: {"<chapter>-<level>": 0..10}, unlockAll}`. Chapter ids are `one`, `pA`, `pB` and `pC`. Levels are numbered from 0.
- `fe-log`: the last 5000 rounds as `{t, ch, lvl, heard, answered, tries, ref, labels}`. `answered` is the first tap, `tries` the taps needed to find the note. Degrees run 0 = Do to 7 = Do'.
