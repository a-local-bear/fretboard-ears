// The song model used by the Studio, plus helpers to create songs from lesson
// examples and to turn a song into a plain-text chord chart.
//
// song = { id, title, key, mode, bpm, groove, pattern, scale, sections: [
//   { id, name, chords: [{ deg, q, beats, frets? }], melody: [{ s, d, p }], lyrics }
// ] }
// Chords are stored as scale degrees and melodies relative to the tonic, so
// changing `key` transposes the whole song.

import { GROOVES, PATTERNS } from './audio/engine.js';
import { uid } from './dom.js';
import { asciiTab, assignFrets, bestPosition, parseMelody, tonicMidi } from './music/melody.js';
import { analyzeChord, chordIn, makeKey, parseProgression } from './music/theory.js';
import { voiceProgression } from './music/voicings.js';
import { saveSong } from './store.js';

export function newSection(name = 'Verse', prog = 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7', melody = '') {
  return {
    id: uid(),
    name,
    chords: typeof prog === 'string' ? parseProgression(prog) : prog.map((c) => ({ ...c })),
    melody: typeof melody === 'string' ? (melody ? parseMelody(melody) : []) : melody.map((n) => ({ ...n })),
    lyrics: '',
  };
}

export function newSong(init = {}) {
  const now = Date.now();
  return {
    id: uid(),
    title: init.title || 'Untitled song',
    key: init.key || 'C',
    mode: init.mode || 'major',
    bpm: init.bpm || 84,
    groove: init.groove || 'bedroom',
    pattern: init.pattern || 'lazy',
    scale: init.scale || null,
    sections: init.sections || [newSection('Verse', init.prog, init.melody)],
    createdAt: now,
    updatedAt: now,
  };
}

// Used by "Open in Studio" buttons all over the lessons.
export function createAndOpen(init) {
  const song = newSong(init);
  saveSong(song);
  location.hash = `#/studio/${song.id}`;
  return song;
}

// Degrees → real chords with voicings and analysis, ready to draw or play.
export function resolveChords(keyName, mode, chords, { voicings = null, prefer } = {}) {
  const key = makeKey(keyName, mode);
  const real = chords.map((c, i) => ({
    ...chordIn(key, c),
    frets: c.frets || voicings?.[i] || null,
    info: analyzeChord(mode, c),
  }));
  const picked = voiceProgression(real, prefer);
  return real.map((c, i) => ({ ...c, frets: picked[i].frets, form: picked[i].form }));
}

export const sectionSteps = (section) => section.chords.reduce((sum, c) => sum + Math.round(c.beats * 4), 0);

// Spans in steps with each chord's pitch classes — what the melody tools need.
export function chordSpans(resolved) {
  let at = 0;
  return resolved.map((c) => {
    const span = { start: at, len: Math.round(c.beats * 4), pcs: c.pcs, rootPc: c.rootPc, q: c.q, symbol: c.symbol, roman: c.roman };
    at += span.len;
    return span;
  });
}

export const melodyToMidi = (melody, keyPc) => melody.map((n) => ({ ...n, midi: tonicMidi(keyPc) + n.p }));

function chartLine(resolved) {
  const bars = [];
  let bar = [];
  let room = 4;
  for (const c of resolved) {
    let left = c.beats;
    let first = true;
    while (left > 0.001) {
      const take = Math.min(left, room);
      bar.push(first ? c.symbol : '%');
      first = false;
      left -= take;
      room -= take;
      if (room <= 0.001) {
        bars.push(bar.join('  '));
        bar = [];
        room = 4;
      }
    }
  }
  if (bar.length) bars.push(bar.join('  '));
  const lines = [];
  for (let i = 0; i < bars.length; i += 4) lines.push(`| ${bars.slice(i, i + 4).join(' | ')} |`);
  return lines.join('\n');
}

export function songToText(song) {
  const key = makeKey(song.key, song.mode);
  const out = [
    song.title,
    `Key of ${song.key} ${song.mode} · ${song.bpm} bpm · ${GROOVES[song.groove]?.name || 'Guitar only'} · strum: ${PATTERNS[song.pattern]?.name || ''}`,
    '',
  ];
  for (const section of song.sections) {
    out.push(`[${section.name}]`);
    if (section.chords.length) {
      const resolved = resolveChords(song.key, song.mode, section.chords);
      out.push(chartLine(resolved));
      out.push(`  ${resolved.map((c) => c.roman).join(' – ')}`);
      out.push(`  shapes: ${resolved.map((c) => `${c.symbol} ${c.frets.map((f) => (f == null ? 'x' : f)).join(c.frets.some((f) => f > 9) ? '-' : '')}`).join(' · ')}`);
    }
    if (section.melody.length) {
      const notes = melodyToMidi(section.melody, key.pc);
      out.push('', asciiTab(assignFrets(notes, bestPosition(notes)), sectionSteps(section)));
    }
    if (section.lyrics?.trim()) out.push('', section.lyrics.trim());
    out.push('');
  }
  return out.join('\n').trimEnd() + '\n';
}
