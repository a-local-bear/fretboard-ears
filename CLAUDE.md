# Fretboard Ears: three guitar apps in one repository

`apps/ear-training`, `apps/fretwise` and `apps/woozy` are developed the same way. See README.md for the layout.

## Rules

- Vanilla JS, native ES modules, no build step, no npm packages. Node only for `node --test` and the two optional
  servers (`apps/fretwise/server.js`, `apps/woozy/server.js`). Tooling is small Python or shell scripts. npm is not installed.
- Each app is `apps/<name>/public` (what the browser loads) plus `apps/<name>/tests`. Apps do not import from each other.
- Addresses inside `public/` are relative: the same files are served at `/<name>/` on the site and, for Fretwise and
  Woozy, at `/` by their own servers. Those two must keep working without a server (browser storage only).
- `site/` is the main menu, manifest, icons and the one service worker. `tools/site.py` stamps the service worker
  from the files at build and serve time; never write a file list or version into `site/sw.js` by hand.

## Commands

- `node --test` at the root runs every app's tests; `cd apps/<name> && node --test` runs one app's.
- `./serve.sh` serves the whole site on http://localhost:8080. `python3 tools/site.py build` writes `_site/`.

## Workflow

1. Every piece of work has a GitHub issue on the project board: `tools/issue.sh new "Title" <app>,<kind> "Body"`.
   App labels: `ear-training`, `fretwise`, `woozy`, `site`. Kinds: `logic`, `audio`, `ui`, `pwa`, `verify`, `setup`, `idea`, `bug`.
2. `tools/issue.sh start <n>` when starting.
3. Add or update tests in the app's `tests/`; run the tests before committing.
4. Commit with `Fixes #n` in the message. Merge to `main` and push: CI tests every app, then deploys the site to
   https://a-local-bear.github.io/fretboard-ears/ and the issue closes.
