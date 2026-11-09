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
| `js/audio.js` | Web Audio playback and scheduling |
| `js/fretboard.js` | SVG fretboard |
| `js/storage.js` | localStorage, persistence request, answer log |
| `js/ui.js` | State, screens, input |
| `js/main.js` | Boot, service worker registration, update toast |
| `sw.js` | Offline cache. The block between the STAMP markers is generated. |
| `tools/stamp_version.py` | Hashes the app files into the cache name and precache list |
| `tools/make_icons.py` | Regenerates `icons/*.png` (pure Python) |
| `tools/serve.py` | Local static server with correct MIME types |

## Updating

Edit files, then restart `./serve.sh` (or run `python3 tools/stamp_version.py`).
Open copies of the app show "A new version is ready" and update when you tap Reload.
If you add a new kind of file, also add its glob to `PATTERNS` in `tools/stamp_version.py`.

## Stored data (localStorage)

- `fe-settings`: `{labels: "solfege"|"letters"|"hidden", ref: "cadence"|"do"|"none"}`
- `fe-progress`: `{best: {"<chapter>-<level>": 0..10}, unlockAll}`. Chapter ids are `one`, `pA`, `pB` and `pC`. Levels are numbered from 0.
- `fe-log`: the last 5000 answers as `{t, ch, lvl, heard, answered, ref, labels}`. Degrees run 0 = Do to 7 = Do'.
