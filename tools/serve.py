#!/usr/bin/env python3
"""Static server for local use: correct MIME types, no HTTP caching (the service worker does caching)."""
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.webmanifest': 'application/manifest+json',
        '.woff2': 'font/woff2',
        '.svg': 'image/svg+xml',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    host = sys.argv[1] if len(sys.argv) > 1 else '127.0.0.1'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8080
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer((host, port), handler) as httpd:
        print(f"Serving Fretboard Ears on http://localhost:{port}/" + ("" if host == "127.0.0.1" else " and on the network"), flush=True)
        httpd.serve_forever()


if __name__ == '__main__':
    main()
