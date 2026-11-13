#!/usr/bin/env python3
"""Download the clean electric guitar samples (FatBoy soundfont, CC BY-SA 3.0) into samples/eg-clean/.

Files are named by MIDI number (40.mp3 … 76.mp3). Run from anywhere: python3 tools/fetch_samples.py
The note naming mirrors midiToName() in public/js/samples.js.
"""
import sys
import urllib.request
from pathlib import Path

SOURCE = 'https://gleitz.github.io/midi-js-soundfonts/FatBoy/electric_guitar_clean-mp3/'
RANGE = (40, 76)  # E2 … E5, keep in sync with SAMPLE_RANGE in public/js/samples.js
NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
OUT = Path(__file__).resolve().parent.parent / 'public' / 'samples' / 'eg-clean'

ATTRIBUTION = """# Clean electric guitar samples

The files in this folder are individual notes (MIDI 40–76, E2–E5) of the
"Electric Guitar (clean)" instrument from the **FatBoy** soundfont, as rendered to MP3 by
[gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts).

- Source: {source}
- Licence: [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- Changes: renamed to `<midi>.mp3`. Leading silence is trimmed at load time in the app; the files are unmodified.

This licence applies to these sample files only, not to the rest of Fretboard Ears.
Re-download with `python3 tools/fetch_samples.py`.
"""


def midi_to_name(midi):
    return f'{NAMES[midi % 12]}{midi // 12 - 1}'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for midi in range(RANGE[0], RANGE[1] + 1):
        url = SOURCE + midi_to_name(midi) + '.mp3'
        with urllib.request.urlopen(url, timeout=30) as r:
            if r.status != 200:
                sys.exit(f'{url}: HTTP {r.status}')
            data = r.read()
        if not (data[:3] == b'ID3' or (data[0] == 0xFF and data[1] & 0xE0 == 0xE0)):
            sys.exit(f'{url}: not an MP3')
        (OUT / f'{midi}.mp3').write_bytes(data)
        total += len(data)
        print(f'{midi:3} {midi_to_name(midi):4} {len(data):6} bytes')
    (OUT / 'ATTRIBUTION.md').write_text(ATTRIBUTION.format(source=SOURCE))
    print(f'{RANGE[1] - RANGE[0] + 1} files, {total / 1024:.0f} KB total')


if __name__ == '__main__':
    main()
