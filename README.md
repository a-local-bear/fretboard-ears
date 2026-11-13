# Fretboard Ears

Three apps for guitarists in one repository, published together at https://a-local-bear.github.io/fretboard-ears/
(installable, works offline).

| App | What it is | Folder |
|---|---|---|
| [Ear training](https://a-local-bear.github.io/fretboard-ears/ear-training/) | Hear a note in a key and play it on your guitar | [`apps/ear-training`](apps/ear-training) |
| [Fretwise](https://a-local-bear.github.io/fretboard-ears/fretwise/) | Bite-sized lessons in sight-reading on guitar | [`apps/fretwise`](apps/fretwise) |
| [Woozy](https://a-local-bear.github.io/fretboard-ears/woozy/) | A bedroom-pop songwriting course and studio | [`apps/woozy`](apps/woozy) |

## Layout

```
apps/<name>/
  public/        the app as the browser loads it; served at /<name>/ on the site
  tests/         node --test
  package.json   name, "type": "module"
  server.js      optional: the app's own server (Fretwise, Woozy), which shares progress between devices
site/            the main menu, the web-app manifest and icons, and the service worker for the whole site
tools/site.py    builds or serves the site: site/ plus every apps/*/public
.github/         CI and deploy workflow, issue forms
```

Everything is vanilla JS with native ES modules: no build step and no dependencies. Node is used only for
`node --test`, and for the two optional servers.

## Run

```sh
./serve.sh          # the whole site on http://localhost:8080 (--lan to reach it from a phone)
node --test         # every app's tests
(cd apps/woozy && node --test)   # one app's tests
```

On the site the apps keep everything in the browser. Fretwise and Woozy can also run from their own servers on
your network, which keep progress on that computer so it follows you between devices:
see [`apps/fretwise`](apps/fretwise/README.md) and [`apps/woozy`](apps/woozy/README.md).

## How work is tracked

Every change starts as an [issue](https://github.com/a-local-bear/fretboard-ears/issues) on the
[project board](https://github.com/users/a-local-bear/projects/1) (Todo, In Progress, Done), labelled with its app
(`ear-training`, `fretwise`, `woozy` or `site`) and its kind (`logic`, `audio`, `ui`, `pwa`, `verify`, `setup`, `idea`, `bug`).

```sh
tools/issue.sh new "Title" woozy,ui "What and why"   # open an issue on the board
tools/issue.sh start 61                              # move it to In Progress
```

A commit that says `Fixes #61` closes the issue when it reaches `main`. Every push runs each app's tests; a push
to `main` also builds the site and publishes it to GitHub Pages.

## Adding an app

Create `apps/<name>/` with a `public/` folder (relative addresses only, so it works from a subfolder), a `tests/`
folder and a `package.json` with `"type": "module"`. Add it to the menu in `site/index.html`, to the
matrix in `.github/workflows/ci.yml` and to the App list in `.github/ISSUE_TEMPLATE/`, and give it a label.
