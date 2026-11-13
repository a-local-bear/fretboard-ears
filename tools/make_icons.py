#!/usr/bin/env python3
"""Generate the app icons as PNGs with no dependencies (zlib + struct, analytic anti-aliasing).

Run from the repo root:  python3 tools/make_icons.py
"""
import math
import struct
import zlib
from pathlib import Path

BG = (0x00, 0x00, 0x00)
FRET = (0x3D, 0x3D, 0x3D)
STRING = (0x8A, 0x8A, 0x8A)
ACCENT = (0xC8, 0xFF, 0x2E)
DOTS = [((0.26, 0.62), (0xFF, 0x5F, 0x57)),   # Do
        ((0.50, 0.50), (0xFF, 0xD9, 0x3A)),   # Mi
        ((0.74, 0.38), (0x35, 0xC9, 0xFF))]   # Sol
DOT_R = 0.085
RING_W = 0.024


def sd_round_rect(px, py, x0, y0, x1, y1, r):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    qx, qy = abs(px - cx) - hx, abs(py - cy) - hy
    outside = math.hypot(max(qx, 0), max(qy, 0))
    return outside + min(max(qx, qy), 0) - r


def sd_circle(px, py, cx, cy, r):
    return math.hypot(px - cx, py - cy) - r


def shapes(rounded_bg, scale):
    """Shapes in unit coordinates; content scaled about the centre by `scale`."""
    def s(v):
        return 0.5 + (v - 0.5) * scale

    out = []
    if rounded_bg:
        out.append((lambda x, y: sd_round_rect(x, y, 0, 0, 1, 1, 0.22), BG))
    else:
        out.append((lambda x, y: -1.0, BG))
    # Line drawing on black: a lime nut, hairline frets and strings, dots as black discs with a coloured ring.
    out.append((lambda x, y: sd_round_rect(x, y, s(0.12) - 0.012 * scale, s(0.30), s(0.12), s(0.70), 0.0), ACCENT))
    for fx in (0.38, 0.62):
        out.append((lambda x, y, fx=fx: sd_round_rect(x, y, s(fx) - 0.005 * scale, s(0.30), s(fx) + 0.005 * scale, s(0.70), 0.0), FRET))
    for sy in (0.38, 0.50, 0.62):
        out.append((lambda x, y, sy=sy: sd_round_rect(x, y, s(0.12), s(sy) - 0.006 * scale, s(0.88), s(sy) + 0.006 * scale, 0.0), STRING))
    for (cx, cy), col in DOTS:
        out.append((lambda x, y, cx=cx, cy=cy: sd_circle(x, y, s(cx), s(cy), DOT_R * scale), BG))
        out.append((lambda x, y, cx=cx, cy=cy: abs(sd_circle(x, y, s(cx), s(cy), (DOT_R - RING_W / 2) * scale)) - RING_W / 2 * scale, col))
    return out


def render(size, rounded_bg, scale):
    shp = shapes(rounded_bg, scale)
    rows = []
    for j in range(size):
        row = bytearray([0])  # filter type 0
        y = (j + 0.5) / size
        for i in range(size):
            x = (i + 0.5) / size
            r = g = b = 0.0
            a = 0.0
            for fn, col in shp:
                cov = min(1.0, max(0.0, 0.5 - fn(x, y) * size))
                if cov <= 0:
                    continue
                # "over" compositing, premultiplied
                r = col[0] * cov + r * (1 - cov)
                g = col[1] * cov + g * (1 - cov)
                b = col[2] * cov + b * (1 - cov)
                a = cov + a * (1 - cov)
            if a > 0:
                row += bytes((round(r / a), round(g / a), round(b / a), round(a * 255)))
            else:
                row += b'\0\0\0\0'
        rows.append(bytes(row))
    return png(size, size, b''.join(rows))


def png(w, h, raw):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))


def main():
    out = Path(__file__).resolve().parent.parent / 'site' / 'icons'
    out.mkdir(exist_ok=True)
    jobs = [
        ('icon-192.png', 192, True, 1.0),
        ('icon-512.png', 512, True, 1.0),
        ('icon-512-maskable.png', 512, False, 0.78),   # content inside the 80% safe zone
        ('apple-touch-icon.png', 180, False, 0.9),      # iOS adds its own rounding
    ]
    for name, size, rounded, scale in jobs:
        (out / name).write_bytes(render(size, rounded, scale))
        print('wrote', out / name)


if __name__ == '__main__':
    main()
