#!/usr/bin/env python3
"""Build or serve the whole site: the menu in site/ plus every app's public/ folder.

    python3 tools/site.py build [out]         copy everything to out (default _site) for GitHub Pages
    python3 tools/site.py serve [host] [port] serve the working tree as it is (default 127.0.0.1 8080)

site/ is the root of the site; apps/<name>/public is served at /<name>/. The service worker is
stamped with the file list and a hash of every file, in the build and on each request when serving,
so a change to any app reaches browsers as a new version. Nothing is written to the working tree.
"""
import functools
import hashlib
import http.server
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SW = 'sw.js'


def mounts():
    """URL prefix -> folder, longest prefix first."""
    apps = {f'{p.parent.name}/': p for p in sorted(ROOT.glob('apps/*/public')) if p.is_dir()}
    return {**apps, '': ROOT / 'site'}


def site_files():
    """URL path -> file, for every file of the site."""
    out = {}
    for prefix, folder in mounts().items():
        for p in sorted(folder.rglob('*')):
            if p.is_file() and not any(part.startswith('.') for part in p.relative_to(folder).parts):
                out[prefix + p.relative_to(folder).as_posix()] = p
    return out


def stamped_sw(files):
    """sw.js with the precache list and a cache name derived from the files' contents."""
    text = files[SW].read_text()
    h = hashlib.sha256(re.sub(r'// STAMP:BEGIN.*?// STAMP:END', '', text, flags=re.S).encode())
    urls = sorted(u for u in files if u != SW)
    for u in urls:
        h.update(u.encode() + b'\0' + files[u].read_bytes())
    block = (f"// STAMP:BEGIN\nconst CACHE = 'fe-{h.hexdigest()[:10]}';\n"
             f"const PRECACHE = {json.dumps(urls, indent=2)};\n// STAMP:END")
    return re.sub(r'// STAMP:BEGIN.*?// STAMP:END', lambda _: block, text, flags=re.S)


def build(out):
    files = site_files()
    if out.exists():
        shutil.rmtree(out)
    for url, src in files.items():
        dest = out / url
        dest.parent.mkdir(parents=True, exist_ok=True)
        if url == SW:
            dest.write_text(stamped_sw(files))
        else:
            shutil.copyfile(src, dest)
    print(f'{out}: {len(files)} files from {", ".join(p or "site" for p in sorted(mounts()))}')


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.webmanifest': 'application/manifest+json',
        '.woff2': 'font/woff2',
        '.svg': 'image/svg+xml',
        '.mp3': 'audio/mpeg',
    }

    def translate_path(self, path):
        # let the base class clean the path (no "..", no query), then move it under the right folder
        rel = Path(super().translate_path(path)).relative_to(ROOT).as_posix()
        rel = '' if rel == '.' else rel
        for prefix, folder in mounts().items():
            if rel.startswith(prefix) or rel + '/' == prefix:
                return str(folder / rel[len(prefix):])
        return str(ROOT / 'site' / rel)

    def do_GET(self):
        if self.path.split('?')[0] == '/' + SW:
            body = stamped_sw(site_files()).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')  # the service worker does the caching
        super().end_headers()


def serve(host, port):
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer((host, port), handler) as httpd:
        print(f'Serving the site on http://localhost:{port}/' + ('' if host == '127.0.0.1' else ' and on the network'), flush=True)
        httpd.serve_forever()


def main():
    cmd, args = (sys.argv[1] if len(sys.argv) > 1 else ''), sys.argv[2:]
    if cmd == 'build':
        build(Path(args[0]).resolve() if args else ROOT / '_site')
    elif cmd == 'serve':
        serve(args[0] if args else '127.0.0.1', int(args[1]) if len(args) > 1 else 8080)
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
