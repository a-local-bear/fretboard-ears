// The Studio: build a song section by section — chords from a palette that
// knows the key, a melody on the grid, words underneath — with a coach that
// reads what you wrote and points at what the lessons would say about it.

import { auditionChord } from '../audio/audio.js';
import { compile, player } from '../audio/engine.js';
import { LESSONS } from '../content/curriculum.js';
import { h, icon, select, uid } from '../dom.js';
import { analyzeMelody, tonicMidi } from '../music/melody.js';
import {
  FUNCTION_NAMES, MAJOR_KEYS, MINOR_KEYS, QUALITIES, QUALITY_GROUPS, makeKey, mod12, noteName, notePc, palette,
  romanOf,
} from '../music/theory.js';
import { fretsToString, voicingMidi, voicingsFor } from '../music/voicings.js';
import { chordSpans, createAndOpen, newSection, newSong, resolveChords, sectionSteps, songToText } from '../songs.js';
import { deleteSong, saveSong, songList, store } from '../store.js';
import { melodyEditor } from '../ui/melody-editor.js';
import { beatsLabel, chordCard, fnClass, grooveOptions, keyOptions, patternOptions, tempoControl } from '../ui/progression.js';

const STARTERS = LESSONS.flatMap((lesson) => lesson.blocks.filter((b) => b.t === 'starter' && lesson.id.startsWith('style-')).map((b) => ({ lesson, song: b.song })));
const SECTION_NAMES = ['Verse', 'Chorus', 'Bridge', 'Intro', 'Outro', 'Pre-chorus', 'Solo'];
const LENGTHS = [1, 2, 4, 8];

const when = (ts) => {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(ts).toLocaleDateString();
};

// -------------------------------------------------------------- song list ----

export function studioListView() {
  const songs = songList();
  const list = songs.length
    ? h('div', { class: 'song-grid' }, songs.map((song) => {
      const chords = song.sections.flatMap((sec) => resolveChords(song.key, song.mode, sec.chords.slice(0, 4)).map((c) => c.symbol)).slice(0, 6);
      return h('a', { class: 'song-card', href: `#/studio/${song.id}` },
        h('h3', {}, song.title),
        h('p', { class: 'song-meta' }, `${song.key} ${song.mode} · ${song.bpm} bpm · ${song.sections.length} section${song.sections.length === 1 ? '' : 's'}`),
        h('p', { class: 'song-chords' }, chords.join('  ') || 'No chords yet'),
        h('p', { class: 'song-when' }, `Edited ${when(song.updatedAt)}`));
    }))
    : h('p', { class: 'empty' }, 'No songs yet. Start a blank one, or begin from a style below.');

  return h('div', { class: 'page studio-list' },
    h('header', { class: 'lesson-head' },
      h('p', { class: 'eyebrow' }, 'Studio'),
      h('h1', {}, 'Your songs'),
      h('p', { class: 'lesson-summary' }, store.standalone
        ? 'Songs are saved in this browser on this device. Use “Chord chart” to keep a copy elsewhere.'
        : store.online
        ? 'Saved on this computer and shared with every device that opens this app on your network.'
        : 'The server is not reachable right now, so songs are being kept in this browser and will sync when it is back.')),
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn btn-play', type: 'button', onClick: () => createAndOpen({ title: 'Untitled song', key: 'A' }) }, icon('plus', 16), 'New blank song')),
    list,
    h('h2', {}, 'Start from a style'),
    h('div', { class: 'song-grid' }, STARTERS.map(({ lesson, song }) => h('button', {
      class: 'song-card starter-card', type: 'button',
      onClick: () => createAndOpen({ ...song, sections: song.sections.map((sec) => newSection(sec.name, sec.prog, sec.melody || '')) }),
    },
    h('h3', {}, song.title),
    h('p', { class: 'song-meta' }, `${lesson.title.replace('Style study: ', '')} style · ${song.key} ${song.mode || 'major'} · ${song.bpm} bpm`),
    h('p', { class: 'song-chords' }, song.sections.map((sec) => sec.name).join(' + '))))));
}

// ------------------------------------------------------------------ coach ----

function coach(song, sec, resolved) {
  const tips = [];
  const good = (text) => tips.push({ kind: 'good', text });
  const idea = (text) => tips.push({ kind: 'idea', text });

  if (!resolved.length) {
    idea('Add a few chords from the palette to get started. Two is enough.');
    return tips;
  }
  const total = sectionSteps(sec);
  const bars = total / 16;
  const outside = resolved.filter((c) => c.info.kind !== 'diatonic');
  const distinct = new Set(resolved.map((c) => c.symbol)).size;
  const first = resolved[0];

  if (first.info.kind === 'diatonic' && first.info.fn) {
    const mood = { T: first.deg === 0 ? 'settled' : 'wistful', S: 'floating and open', D: 'restless' }[first.info.fn];
    good(`Starts on <b>${first.roman}</b> (${FUNCTION_NAMES[first.info.fn]}) — a ${mood} opening.`);
  }
  if (!resolved.some((c) => c.deg === 0)) idea('This section never plays the <b>I</b> chord, so it will not feel resolved. Often that is exactly right for a verse — just make sure another section lands.');

  for (let i = 0; i + 2 < resolved.length; i++) {
    const [a, b, c] = [resolved[i], resolved[i + 1], resolved[i + 2]];
    if (a.deg === 2 && b.deg === 7 && c.deg === 0 && QUALITIES[b.q].fam === 'dom') {
      good(`<b>${a.roman} – ${b.roman} – ${c.roman}</b>: a ii–V–I. The strongest pull home there is.`);
      break;
    }
  }
  resolved.forEach((c, i) => {
    const next = resolved[(i + 1) % resolved.length];
    if (c.info.kind === 'borrowed') good(`<b>${c.roman}</b> (${c.symbol}) is ${c.info.why}. In the melody, try singing the note that changed.`);
    if (c.info.kind === 'secondary' && /pulls to/.test(c.info.why)) {
      if (mod12(c.deg + 5) === next.deg) good(`<b>${c.symbol}</b> is a ${c.info.why} — and it resolves there. `);
      else idea(`<b>${c.symbol}</b> is a ${c.info.why}, but your next chord is ${next.symbol}. A surprise can be great; check it is the one you meant.`);
    }
  });
  if (!outside.length && resolved.length >= 3) {
    const four = resolved.find((c) => c.deg === 5 && QUALITIES[c.q].fam === 'maj');
    const six = resolved.find((c) => c.deg === 9 && QUALITIES[c.q].fam === 'min');
    if (song.mode !== 'minor' && four) idea(`Every chord is from the key. For one moment of colour, follow <b>${four.symbol}</b> with the minor iv (in the “Borrowed” tab).`);
    else if (song.mode !== 'minor' && six) idea(`Every chord is from the key. Try a <b>V7/vi</b> just before <b>${six.symbol}</b> (in the “Secondary” tab) for a jolt.`);
    else if (song.mode === 'minor') idea('Every chord is from the key. Try the major <b>IV7</b> for a Dorian lift, or the major <b>V7</b> for a stronger pull home.');
  }
  if (outside.length > 2) idea(`${outside.length} chords from outside the key. That can sound adventurous or lost — if it is the second, keep your favourite and make the rest diatonic.`);
  if (distinct > 5) idea(`${distinct} different chords in one section. Two to four is typical for this style; fewer chords leave more room for the melody.`);
  if (resolved.length >= 3 && new Set(resolved.map((c) => c.beats)).size === 1) idea('Every chord lasts the same length. Try holding one for two bars, or squeezing two into one bar, to give the loop a shape.');
  if (!Number.isInteger(bars)) idea(`This section is ${Math.floor(bars)} bars and ${(total % 16) / 4} beats long — an odd length. Great if deliberate, wobbly if not.`);
  else if (bars % 2 === 1 && bars > 1) idea(`${bars} bars is an unusual phrase length. Lovely if you mean it; if not, even numbers loop more comfortably.`);

  // ---- melody
  const spans = chordSpans(resolved);
  const key = makeKey(song.key, song.mode);
  const stats = analyzeMelody(sec.melody.filter((n) => n.s < total), spans, key.pc, total);
  if (!stats) {
    idea('No melody yet. Tap the grid — or press <b>Idea</b> and then change the notes you like least.');
    return tips;
  }
  const pct = (x) => `${Math.round(x * 100)}%`;
  tips.push({ kind: 'info', text: `Melody: ${stats.count} notes over a range of ${stats.range} semitones; ${pct(stats.tonePct)} of them are chord tones.` });
  if (stats.strongPct != null) {
    if (stats.strongPct >= 0.7) good(`${pct(stats.strongPct)} of your strong-beat and long notes are chord tones — the melody will sound like it knows the chords.`);
    else if (stats.strongPct < 0.45) idea(`Only ${pct(stats.strongPct)} of your strong-beat and long notes land on chord tones. Nudge a few onto the tinted cells and hear it settle.`);
  }
  if (stats.range > 14) idea(`The melody spans ${stats.range} semitones — more than an octave. Hard to sing softly; consider bringing the extremes in.`);
  else if (stats.range <= 4 && stats.count > 4) idea('A very narrow melody — intimate. One higher note somewhere would give it a peak.');
  if (stats.biggestLeap >= 9) idea(`There is a leap of ${stats.biggestLeap} semitones. Big leaps are memorable; follow them with a step back in the other direction.`);
  if (stats.density > 0.85) idea('The melody fills almost every beat. Leave a gap — rests are part of the tune, and a singer has to breathe.');
  if (stats.bars >= 3 && stats.distinctRhythms === stats.bars) idea('Every bar has a different rhythm. Copy one bar\'s rhythm into another and you have a motif.');
  else if (stats.bars >= 2 && stats.distinctRhythms <= Math.ceil(stats.bars / 2)) good('The rhythm repeats from bar to bar — that is what makes a motif stick.');
  if (!stats.lastIsTone) idea('The last note is not a chord tone, so the phrase ends in the air. Good for a question; move it onto a tint for an answer.');
  return tips;
}

// ----------------------------------------------------------------- editor ----

export function studioEditorView(songId) {
  const song = store.songs[songId];
  if (!song) {
    return h('div', { class: 'page' }, h('h1', {}, 'Song not found'), h('p', {}, 'It may have been deleted on another device. ', h('a', { href: '#/studio' }, 'Back to your songs')));
  }
  if (!song.sections.length) song.sections.push(newSection('Verse'));

  const owner = uid();
  const ui = { section: song.sections[0].id, selected: null, tab: 'diatonic', sevenths: true, mode: null };
  let resolved = [];
  let cards = [];
  let editor = null;

  const sec = () => song.sections.find((x) => x.id === ui.section) || song.sections[0];
  const key = () => makeKey(song.key, song.mode);
  const touch = () => saveSong(song);

  const tabsEl = h('nav', { class: 'section-tabs' });
  const sectionHead = h('div', { class: 'section-head' });
  const strip = h('div', { class: 'chord-row studio-strip' });
  const inspector = h('div', { class: 'inspector' });
  const paletteEl = h('div', { class: 'palette' });
  const melodyHost = h('div', { class: 'melody-host' });
  const coachEl = h('ul', { class: 'coach-list' });
  const lyrics = h('textarea', {
    class: 'lyrics', rows: 6, placeholder: 'Words, mumbles, ideas for this section…',
    onInput: (e) => {
      sec().lyrics = e.target.value;
      touch();
    },
  });
  const playSectionBtn = h('button', { class: 'btn btn-play', type: 'button', onClick: () => togglePlay('section') });
  const playSongBtn = h('button', { class: 'btn', type: 'button', onClick: () => togglePlay('song') });

  // ---- playback
  function sectionArrangement() {
    const s = sec();
    const total = sectionSteps(s);
    const tonic = tonicMidi(key().pc);
    const melody = s.melody.filter((n) => n.s < total).map((n) => ({ s: n.s, d: Math.min(n.d, total - n.s), midi: tonic + n.p }));
    return compile({ chords: resolved, pattern: song.pattern, groove: song.groove, melody });
  }

  function songArrangement() {
    const chords = [];
    const melody = [];
    const marks = [];
    const tonic = tonicMidi(key().pc);
    let at = 0;
    for (const s of song.sections) {
      if (!s.chords.length) continue;
      const res = resolveChords(song.key, song.mode, s.chords);
      const len = sectionSteps(s);
      for (let r = 0; r < (s.repeat || 1); r++) {
        marks.push({ id: s.id, start: at, len });
        chords.push(...res);
        for (const n of s.melody) if (n.s < len) melody.push({ s: at + n.s, d: Math.min(n.d, len - n.s), midi: tonic + n.p });
        at += len;
      }
    }
    return { comp: compile({ chords, pattern: song.pattern, groove: song.groove, melody }), marks };
  }

  function paintTransport() {
    const playing = player.owner === owner ? ui.mode : null;
    playSectionBtn.replaceChildren(icon(playing === 'section' ? 'stop' : 'play'), playing === 'section' ? 'Stop' : 'Play section');
    playSectionBtn.classList.toggle('on', playing === 'section');
    playSongBtn.replaceChildren(icon(playing === 'song' ? 'stop' : 'play'), playing === 'song' ? 'Stop' : 'Play song');
    playSongBtn.classList.toggle('on', playing === 'song');
  }

  function clearPlayMarks() {
    cards.forEach((el) => el.classList.remove('active'));
    [...tabsEl.children].forEach((el) => el.classList.remove('playing'));
    editor?.setPlayhead(null);
  }

  function markChordAt(step) {
    let at = 0;
    let index = -1;
    sec().chords.forEach((c, i) => {
      const len = Math.round(c.beats * 4);
      if (step >= at && step < at + len) index = i;
      at += len;
    });
    cards.forEach((el, i) => el.classList.toggle('active', i === index));
  }

  function startPlay(mode) {
    ui.mode = mode;
    const onStop = () => {
      ui.mode = null;
      clearPlayMarks();
      paintTransport();
    };
    if (mode === 'section') {
      const comp = sectionArrangement();
      if (!comp.total) return;
      player.play(comp, {
        bpm: song.bpm, owner, onStop,
        onStep: (step) => {
          editor?.setPlayhead(step);
          markChordAt(step);
        },
      });
    } else {
      const { comp, marks } = songArrangement();
      if (!comp.total) return;
      player.play(comp, {
        bpm: song.bpm, owner, loop: false, onStop,
        onStep: (step) => {
          const mark = marks.find((m) => step >= m.start && step < m.start + m.len);
          [...tabsEl.children].forEach((el) => el.classList.toggle('playing', !!mark && el.dataset.id === mark.id));
          if (mark && mark.id === ui.section) {
            editor?.setPlayhead(step - mark.start);
            markChordAt(step - mark.start);
          } else {
            editor?.setPlayhead(null);
            cards.forEach((el) => el.classList.remove('active'));
          }
        },
      });
    }
    paintTransport();
  }

  function togglePlay(mode) {
    const same = player.owner === owner && ui.mode === mode;
    player.stop();
    if (!same) startPlay(mode);
  }

  // Keep a playing section loop in step with edits.
  function refreshPlayback() {
    if (player.owner !== owner) return;
    if (ui.mode === 'section') {
      const comp = sectionArrangement();
      if (comp.total) player.update(comp);
      else player.stop();
    }
  }

  // ---- drawing
  function drawTabs() {
    tabsEl.replaceChildren(
      ...song.sections.map((s) => h('button', {
        type: 'button', class: `section-tab${s.id === ui.section ? ' on' : ''}`, data: { id: s.id },
        onClick: () => {
          if (ui.section === s.id) return;
          if (player.owner === owner && ui.mode === 'section') player.stop();
          ui.section = s.id;
          ui.selected = null;
          drawAll();
        },
      }, s.name, s.repeat > 1 ? h('small', {}, `×${s.repeat}`) : null)),
      h('button', {
        type: 'button', class: 'section-tab add', title: 'Add a section',
        onClick: () => {
          const used = new Set(song.sections.map((s) => s.name));
          const name = SECTION_NAMES.find((n) => !used.has(n)) || `Section ${song.sections.length + 1}`;
          const fresh = newSection(name, song.mode === 'minor' ? 'i7 | iv7 | i7 | iv7' : 'Imaj7 | IVmaj7 | Imaj7 | IVmaj7');
          song.sections.push(fresh);
          ui.section = fresh.id;
          ui.selected = null;
          touch();
          drawAll();
        },
      }, icon('plus', 15), 'Section'),
    );
  }

  function drawSectionHead() {
    const s = sec();
    const index = song.sections.indexOf(s);
    const move = (delta) => {
      const to = index + delta;
      if (to < 0 || to >= song.sections.length) return;
      song.sections.splice(index, 1);
      song.sections.splice(to, 0, s);
      touch();
      drawTabs();
      drawSectionHead();
    };
    sectionHead.replaceChildren(
      h('input', {
        class: 'section-name', value: s.name, 'aria-label': 'Section name', maxlength: 24,
        onInput: (e) => {
          s.name = e.target.value || 'Section';
          touch();
          drawTabs();
        },
      }),
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'in the song, play'), select([1, 2, 3, 4].map((n) => ({ value: String(n), label: `×${n}` })), String(s.repeat || 1), (v) => {
        s.repeat = Number(v);
        touch();
        drawTabs();
      })),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Move earlier', disabled: index === 0, onClick: () => move(-1) }, icon('left', 14)),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Move later', disabled: index === song.sections.length - 1, onClick: () => move(1) }, icon('right', 14)),
      h('button', {
        class: 'btn btn-ghost btn-sm', type: 'button',
        onClick: () => {
          const copy = newSection(`${s.name} 2`, s.chords, s.melody);
          copy.lyrics = s.lyrics;
          song.sections.splice(index + 1, 0, copy);
          ui.section = copy.id;
          ui.selected = null;
          touch();
          drawAll();
        },
      }, icon('copy', 14), 'Duplicate'),
      h('button', {
        class: 'btn btn-ghost btn-sm danger', type: 'button', disabled: song.sections.length < 2,
        onClick: () => {
          if (!window.confirm(`Delete the section “${s.name}”?`)) return;
          if (player.owner === owner) player.stop();
          song.sections.splice(index, 1);
          ui.section = song.sections[Math.max(0, index - 1)].id;
          ui.selected = null;
          touch();
          drawAll();
        },
      }, icon('trash', 14), 'Delete'),
    );
  }

  function drawStrip() {
    const s = sec();
    resolved = resolveChords(song.key, song.mode, s.chords);
    if (ui.selected != null && ui.selected >= resolved.length) ui.selected = null;
    if (!resolved.length) {
      cards = [];
      strip.replaceChildren(h('p', { class: 'hint' }, 'No chords yet — tap some in the palette below.'));
      return;
    }
    cards = resolved.map((c, i) => {
      const card = chordCard(c, {
        onTap: () => {
          ui.selected = ui.selected === i ? null : i;
          auditionChord(voicingMidi(c.frets));
          cards.forEach((el, k) => el.classList.toggle('selected', k === ui.selected));
          drawInspector();
        },
      });
      card.classList.toggle('selected', i === ui.selected);
      card.style.flexGrow = String(Math.max(1, c.beats / 2));
      return card;
    });
    strip.replaceChildren(...cards);
  }

  function chordsChanged() {
    drawStrip();
    drawInspector();
    drawMelody();
    drawCoach();
    touch();
    refreshPlayback();
  }

  function drawInspector() {
    const s = sec();
    const i = ui.selected;
    if (i == null || !resolved[i]) {
      const bars = sectionSteps(s) / 16;
      inspector.replaceChildren(h('p', { class: 'hint' }, resolved.length
        ? `${resolved.length} chord${resolved.length === 1 ? '' : 's'} · ${Number.isInteger(bars) ? `${bars} bar${bars === 1 ? '' : 's'}` : `${(sectionSteps(s) / 4)} beats`} · tap a chord to edit it; new chords are added at the end.`
        : ''));
      return;
    }
    const chord = s.chords[i];
    const c = resolved[i];
    const move = (delta) => {
      const to = i + delta;
      if (to < 0 || to >= s.chords.length) return;
      s.chords.splice(i, 1);
      s.chords.splice(to, 0, chord);
      ui.selected = to;
      chordsChanged();
    };
    const shapes = voicingsFor(c.rootPc, c.q).filter((v) => v.max <= 15);
    const qualityOptions = QUALITY_GROUPS.map((g) => ({ group: g.name, options: g.ids.map((id) => ({ value: id, label: `${c.root}${QUALITIES[id].symbol}` })) }));
    const lengths = [...new Set([...LENGTHS, chord.beats])].sort((a, b) => a - b);
    const job = c.info.kind === 'diatonic' && c.info.fn ? `${FUNCTION_NAMES[c.info.fn]} · in the key` : c.info.why;

    inspector.replaceChildren(
      h('div', { class: 'inspector-title' }, h('b', {}, `${c.roman}  ${c.symbol}`), h('span', {}, job)),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Move earlier', disabled: i === 0, onClick: () => move(-1) }, icon('left', 14)),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Move later', disabled: i === s.chords.length - 1, onClick: () => move(1) }, icon('right', 14)),
        h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'lasts'), select(lengths.map((b) => ({ value: String(b), label: beatsLabel(b) })), String(chord.beats), (v) => {
          chord.beats = Number(v);
          chordsChanged();
        })),
        h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'colour'), select(qualityOptions, chord.q, (v) => {
          chord.q = v;
          delete chord.label;
          delete chord.frets;
          chordsChanged();
        })),
        h('button', {
          class: 'btn btn-ghost btn-sm', type: 'button', title: 'Try the next way to play this chord', disabled: shapes.length < 2,
          onClick: () => {
            const now = fretsToString(c.frets);
            const at = shapes.findIndex((v) => fretsToString(v.frets) === now);
            const next = shapes[(at + 1) % shapes.length];
            chord.frets = fretsToString(next.frets);
            chordsChanged();
            auditionChord(voicingMidi(next.frets));
          },
        }, icon('swap', 14), 'Next shape'),
        chord.frets ? h('button', {
          class: 'btn btn-ghost btn-sm', type: 'button', title: 'Let the app pick the smoothest shape',
          onClick: () => {
            delete chord.frets;
            chordsChanged();
          },
        }, 'Auto shape') : null,
        h('span', { class: 'spacer' }),
        h('button', {
          class: 'btn btn-ghost btn-sm danger', type: 'button',
          onClick: () => {
            s.chords.splice(i, 1);
            ui.selected = null;
            chordsChanged();
          },
        }, icon('trash', 14), 'Remove')),
    );
  }

  function addChord(c) {
    const s = sec();
    const fresh = { deg: c.deg, q: c.q, beats: 4, ...(c.label ? { label: c.label } : {}) };
    const at = ui.selected == null ? s.chords.length : ui.selected + 1;
    s.chords.splice(at, 0, fresh);
    if (ui.selected != null) ui.selected = at;
    chordsChanged();
    auditionChord(voicingMidi(resolved[at].frets));
  }

  function drawPalette() {
    const k = key();
    const pal = palette(song.mode, ui.sevenths);
    const tabs = [['diatonic', 'In the key'], ['borrowed', 'Borrowed'], ['secondary', 'Secondary & passing'], ['any', 'Any chord']];
    const head = h('div', { class: 'palette-head' },
      h('div', { class: 'segmented' }, tabs.map(([id, label]) => h('button', {
        type: 'button', class: ui.tab === id ? 'on' : '',
        onClick: () => {
          ui.tab = id;
          drawPalette();
        },
      }, label))),
      ui.tab === 'diatonic' || ui.tab === 'borrowed' ? h('label', { class: 'check' }, h('input', {
        type: 'checkbox', checked: ui.sevenths,
        onChange: (e) => {
          ui.sevenths = e.target.checked;
          drawPalette();
        },
      }), '7th chords') : null);

    let body;
    if (ui.tab === 'any') {
      const pickState = { deg: 0, q: 'maj7' };
      body = h('div', { class: 'toolbar' },
        h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'root'), select(Array.from({ length: 12 }, (_, d) => ({ value: String(d), label: noteName(k, d) })), '0', (v) => {
          pickState.deg = Number(v);
        })),
        h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'chord'), select(QUALITY_GROUPS.map((g) => ({ group: g.name, options: g.ids.map((id) => ({ value: id, label: `${QUALITIES[id].symbol || 'major'} — ${QUALITIES[id].label}` })) })), 'maj7', (v) => {
          pickState.q = v;
        })),
        h('button', { class: 'btn', type: 'button', onClick: () => addChord(pickState) }, icon('plus', 15), 'Add'));
    } else {
      const list = pal[ui.tab];
      const shown = resolveChords(song.key, song.mode, list.map((c) => ({ ...c, beats: 4 })));
      body = h('div', { class: 'chip-row' }, shown.map((c, i) => h('button', {
        type: 'button', class: `chip-btn ${fnClass(c.info)}`, title: c.info.why,
        onClick: () => addChord(list[i]),
      }, h('small', {}, c.roman), c.symbol)));
    }
    const blurb = {
      diatonic: 'The seven chords of the key. Teal = home, gold = away, coral = tension.',
      borrowed: song.mode === 'minor' ? 'Chords from Dorian, harmonic minor and the parallel major.' : 'Chords from the parallel minor. One per section is plenty.',
      secondary: 'Chords that point at the chord after them. Put each one just before its target.',
      any: `Anything at all. The Roman numeral is worked out for you (${romanOf(0, 'maj7')}, ${romanOf(3, 'maj7')}, …).`,
    }[ui.tab];
    paletteEl.replaceChildren(head, body, h('p', { class: 'hint' }, blurb));
  }

  function drawMelody() {
    const s = sec();
    if (!s.chords.length) {
      editor = null;
      melodyHost.replaceChildren(h('p', { class: 'hint' }, 'Add chords first — the grid shows each chord\'s tones so you can aim for them.'));
      return;
    }
    if (editor && editor.sectionId === s.id) {
      editor.refresh();
      return;
    }
    editor = melodyEditor({
      ctx: () => ({ key: key(), spans: chordSpans(resolved), total: sectionSteps(sec()) }),
      notes: s.melody,
      scale: song.scale || (song.mode === 'minor' ? 'minor' : 'major'),
      onScale: (id) => {
        song.scale = id;
        touch();
      },
      onChange: () => {
        touch();
        drawCoach();
        refreshPlayback();
      },
    });
    editor.sectionId = s.id;
    melodyHost.replaceChildren(editor.el);
  }

  function drawCoach() {
    const tips = coach(song, sec(), resolved);
    coachEl.replaceChildren(...tips.map((t) => h('li', { class: `coach-${t.kind}`, html: t.text })));
  }

  function drawAll() {
    drawTabs();
    drawSectionHead();
    drawStrip();
    drawInspector();
    drawPalette();
    drawMelody();
    drawCoach();
    lyrics.value = sec().lyrics || '';
    paintTransport();
  }

  // ---- song-level controls
  const settings = h('div', { class: 'toolbar-controls' });
  function drawSettings() {
    settings.replaceChildren(
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'key'), select(keyOptions(song.mode), song.key, (v) => {
        song.key = v;
        for (const s of song.sections) for (const c of s.chords) delete c.frets; // shapes were for the old key
        touch();
        drawAll();
        refreshPlayback();
      })),
      h('div', { class: 'segmented' }, ['major', 'minor'].map((m) => h('button', {
        type: 'button', class: song.mode === m ? 'on' : '',
        onClick: () => {
          if (song.mode === m) return;
          const pc = notePc(song.key);
          song.mode = m;
          song.key = (m === 'minor' ? MINOR_KEYS : MAJOR_KEYS).find((name) => notePc(name) === pc);
          if (!song.scale || song.scale === 'major' || song.scale === 'minor') song.scale = m;
          touch();
          drawSettings();
          editor = null;
          drawAll();
          refreshPlayback();
        },
      }, m))),
      tempoControl(song.bpm, (v) => {
        song.bpm = v;
        touch();
        if (player.owner === owner) player.setBpm(v);
      }),
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'strum'), select(patternOptions(), song.pattern, (v) => {
        song.pattern = v;
        touch();
        refreshPlayback();
      })),
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, 'band'), select(grooveOptions(), song.groove, (v) => {
        song.groove = v;
        touch();
        refreshPlayback();
      })),
    );
  }

  function showChart() {
    const text = songToText(song);
    const area = h('textarea', { class: 'chart-text', readonly: true, rows: 18 }, text);
    const status = h('span', { class: 'hint' });
    const dialog = h('dialog', { class: 'dialog' },
      h('h3', {}, 'Chord chart'),
      h('p', { class: 'hint' }, 'Plain text: paste it into your notes, or print it and prop it on the amp.'),
      area,
      h('div', { class: 'toolbar' },
        h('button', {
          class: 'btn', type: 'button',
          onClick: async () => {
            area.select();
            try {
              if (navigator.clipboard) await navigator.clipboard.writeText(text);
              else document.execCommand('copy');
              status.textContent = 'Copied.';
            } catch {
              status.textContent = 'Select the text and copy it by hand.';
            }
          },
        }, icon('copy', 15), 'Copy'),
        h('a', {
          class: 'btn', download: `${song.title.replace(/[^\w\- ]+/g, '').trim() || 'song'}.txt`,
          href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })),
        }, 'Download .txt'),
        status,
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dialog.close() }, 'Close')));
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  const page = h('div', { class: 'page studio' },
    h('header', { class: 'studio-head' },
      h('a', { class: 'back-link', href: '#/studio' }, icon('left', 15), 'Songs'),
      h('input', {
        class: 'title-input', value: song.title, 'aria-label': 'Song title', maxlength: 80,
        onInput: (e) => {
          song.title = e.target.value || 'Untitled song';
          touch();
        },
      }),
      h('div', { class: 'studio-actions' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: showChart }, icon('copy', 14), 'Chord chart'),
        h('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          onClick: () => {
            player.stop();
            const copy = newSong({ ...song, title: `${song.title} (copy)`, sections: song.sections.map((s) => ({ ...newSection(s.name, s.chords, s.melody), lyrics: s.lyrics, repeat: s.repeat })) });
            saveSong(copy);
            location.hash = `#/studio/${copy.id}`;
          },
        }, 'Duplicate'),
        h('button', {
          class: 'btn btn-ghost btn-sm danger', type: 'button',
          onClick: () => {
            if (!window.confirm(`Delete “${song.title}”? This cannot be undone.`)) return;
            player.stop();
            deleteSong(song.id);
            location.hash = '#/studio';
          },
        }, icon('trash', 14), 'Delete'))),
    h('div', { class: 'toolbar studio-transport' }, playSectionBtn, playSongBtn),
    h('div', { class: 'toolbar studio-settings' }, settings),
    tabsEl,
    h('div', { class: 'studio-grid' },
      h('div', { class: 'studio-main' },
        h('section', { class: 'widget' }, sectionHead, h('h4', { class: 'widget-title' }, 'Chords'), strip, inspector, paletteEl),
        h('section', { class: 'widget' }, h('h4', { class: 'widget-title' }, 'Melody'), melodyHost),
        h('section', { class: 'widget' }, h('h4', { class: 'widget-title' }, 'Words & notes'), lyrics)),
      h('aside', { class: 'coach' }, h('h4', {}, 'Coach'), coachEl,
        h('p', { class: 'hint' }, 'Observations, not rules. The lessons explain each idea: ',
          h('a', { href: '#/lesson/borrowed' }, 'borrowed chords'), ', ', h('a', { href: '#/lesson/chord-tones' }, 'chord tones'), ', ', h('a', { href: '#/lesson/motifs' }, 'motifs'), '.'))));

  drawSettings();
  drawAll();
  return page;
}
