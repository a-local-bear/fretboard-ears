#!/usr/bin/env python3
"""Write the precache list and a content-hash cache name into sw.js.

Any change to a precached file changes the hash, so browsers see a new service worker
and the app shows "A new version is ready". Run from anywhere: python3 tools/stamp_version.py
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = ['index.html', 'style.css', 'manifest.webmanifest', 'js/*.js', 'fonts/*.woff2', 'icons/*.png', 'samples/*/*.mp3',
            'songcraft/index.html', 'songcraft/style.css', 'songcraft/js/*.js']


def main():
    files = sorted({p for pat in PATTERNS for p in ROOT.glob(pat)})
    h = hashlib.sha256()
    for p in files:
        h.update(p.relative_to(ROOT).as_posix().encode() + b'\0' + p.read_bytes())
    version = 'fe-' + h.hexdigest()[:10]
    urls = ['./'] + [p.relative_to(ROOT).as_posix() for p in files]
    block = (f"// STAMP:BEGIN\nconst CACHE = '{version}';\n"
             f"const PRECACHE = {json.dumps(urls, indent=2)};\n// STAMP:END")
    sw = ROOT / 'sw.js'
    text = sw.read_text()
    new = re.sub(r'// STAMP:BEGIN.*?// STAMP:END', lambda _: block, text, flags=re.S)
    if new != text:
        sw.write_text(new)
    print(f'{version}  ({len(urls)} precached URLs)')


if __name__ == '__main__':
    main()
