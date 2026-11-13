// Quiz runner + question generators.  Questions are generated fresh each time,
// so every retry is new practice rather than a memory test.

import { auditionChord } from '../audio/audio.js';
import { compile, player } from '../audio/engine.js';
import { h, icon } from '../dom.js';
import {
  QUALITIES, analyzeChord, chordIn, chordNotes, diatonicChords, makeKey, mod12, parseProgression, parseRoman,
  scaleFor, toneLabels,
} from '../music/theory.js';
import { OPEN_MIDI, bestVoicing, voicingMidi, voicingsFor } from '../music/voicings.js';
import { resolveChords } from '../songs.js';
import { chordDiagram } from './chord-diagram.js';
import { fretboard } from './fretboard.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Build a multiple-choice question from the right answer plus distractors.
function choices(correct, wrong, n = 4) {
  const opts = shuffle([correct, ...shuffle([...new Set(wrong.filter((w) => w !== correct))]).slice(0, n - 1)]);
  return { choices: opts, answer: opts.indexOf(correct) };
}

const EASY_KEYS = ['C', 'G', 'D', 'A', 'E', 'F'];
const MORE_KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'];

// ------------------------------------------------------------ generators ----

export const QUIZ = {
  // "In G major, what is the vi chord?"
  degree({ sevenths = false, keys = EASY_KEYS } = {}) {
    return () => {
      const key = makeKey(pick(keys));
      const chords = diatonicChords(scaleFor('major').iv, sevenths).slice(0, 6).map((c) => chordIn(key, c));
      const target = pick(chords);
      return {
        prompt: `In the key of <b>${key.tonic} major</b>, what is the <b>${target.roman}</b> chord?`,
        ...choices(target.symbol, chords.map((c) => c.symbol)),
        explain: `${key.tonic} major: ${chords.map((c) => `${c.roman} = ${c.symbol}`).join(', ')}.`,
      };
    };
  },

  // "Em is which chord in G major?"
  numeral({ sevenths = false, keys = EASY_KEYS } = {}) {
    return () => {
      const key = makeKey(pick(keys));
      const chords = diatonicChords(scaleFor('major').iv, sevenths).slice(0, 6).map((c) => chordIn(key, c));
      const target = pick(chords);
      return {
        prompt: `In the key of <b>${key.tonic} major</b>, <b>${target.symbol}</b> is which chord?`,
        ...choices(target.roman, chords.map((c) => c.roman)),
        explain: `${target.symbol} is built on scale degree ${chords.indexOf(target) + 1}, so it is ${target.roman}.`,
      };
    };
  },

  // Which job does this chord do?
  job() {
    const names = { T: 'Home (tonic)', S: 'Away (subdominant)', D: 'Tension (dominant)' };
    return () => {
      const key = makeKey(pick(EASY_KEYS));
      const c = pick(diatonicChords(scaleFor('major').iv, false).slice(0, 6));
      const chord = chordIn(key, c);
      const fn = analyzeChord('major', c).fn;
      const opts = Object.values(names);
      return {
        prompt: `In <b>${key.tonic} major</b>, what job does <b>${chord.symbol}</b> (${chord.roman}) do?`,
        choices: opts,
        answer: opts.indexOf(names[fn]),
        explain: 'Home: I, iii, vi. Away: ii, IV. Tension: V.',
      };
    };
  },

  // Hear a chord, name its quality.
  qualityEar({ qualities = ['maj7', 'm7', '7'] } = {}) {
    return () => {
      const q = pick(qualities);
      const rootPc = pick([0, 2, 4, 5, 7, 9, 10]);
      const frets = bestVoicing(rootPc, q, 'movable').frets;
      const play = () => auditionChord(voicingMidi(frets), { slow: true });
      const labels = qualities.map((id) => QUALITIES[id].label);
      return {
        prompt: 'Listen. Which kind of chord is this?',
        play,
        choices: labels,
        answer: qualities.indexOf(q),
        explain: {
          maj7: 'Major 7: bright but wistful — a major triad with a soft, close-by 7th on top.',
          m7: 'Minor 7: mellow and warm — sadness with the edges sanded off.',
          7: 'Dominant 7: bluesy and restless — it wants to move somewhere.',
          m9: 'Minor 9: minor 7 with an extra shimmer on top.',
          maj9: 'Major 9: major 7 plus the 9th — wide open and airy.',
          '': 'A plain major triad: stable, bright, no extra colour.',
          m: 'A plain minor triad: clearly sad, nothing softened.',
          m7b5: 'Half-diminished: dark and unstable, a minor 7 with a flattened 5th.',
        }[q] || '',
      };
    };
  },

  // Hear a loop, pick its numerals.
  progressionEar({ options, mode = 'major', bpm = 92 }) {
    return () => {
      const prog = pick(options);
      const keyName = pick(mode === 'minor' ? ['A', 'E', 'D', 'B'] : ['C', 'G', 'D', 'A', 'F']);
      const chords = resolveChords(keyName, mode, parseProgression(prog));
      const play = () => player.play(compile({ chords, pattern: 'quarters', groove: 'bedroom' }), { bpm, loop: false, owner: 'quiz' });
      const pretty = (p) => p.split('|').map((x) => x.trim()).join(' – ');
      return {
        prompt: 'Listen to the loop. Which progression is it?',
        play,
        choices: options.map(pretty),
        answer: options.indexOf(prog),
        explain: `That was ${pretty(prog)} in ${keyName} ${mode}: ${chords.map((c) => c.symbol).join(' – ')}.`,
      };
    };
  },

  // Two loops; which one has the borrowed / chromatic chord?
  spotTheOutsider({ pairs, mode = 'major', what = 'a borrowed chord' }) {
    return () => {
      const [plain, spiced] = pick(pairs);
      const keyName = pick(['C', 'G', 'D', 'A']);
      const order = Math.random() < 0.5 ? [plain, spiced] : [spiced, plain];
      const comps = order.map((p) => compile({ chords: resolveChords(keyName, mode, parseProgression(p)), pattern: 'quarters', groove: 'bedroom' }));
      const buttons = h('div', { class: 'quiz-players' }, ...comps.map((comp, i) => h('button', {
        class: 'btn btn-sm', type: 'button', onClick: () => player.play(comp, { bpm: 90, loop: false, owner: 'quiz' }),
      }, icon('play', 14), `Loop ${'AB'[i]}`)));
      const spicedChords = resolveChords(keyName, mode, parseProgression(spiced));
      const odd = spicedChords.find((c) => c.info.kind !== 'diatonic');
      return {
        prompt: `Play both loops. Which one contains ${what}?`,
        extra: buttons,
        choices: ['Loop A', 'Loop B'],
        answer: order.indexOf(spiced),
        explain: `${spiced.split('|').map((x) => x.trim()).join(' – ')} — the ${odd ? `${odd.roman} (${odd.symbol} in ${keyName})` : 'outside chord'} is the one that isn't in the key.`,
      };
    };
  },

  // Name a chord from its diagram.
  shape({ qualities = ['maj7', 'm7', '7'] } = {}) {
    return () => {
      const q = pick(qualities);
      const rootPc = pick([0, 2, 3, 5, 7, 8, 9, 10]);
      const list = voicingsFor(rootPc, q).filter((v) => (v.form === 'E' || v.form === 'A') && v.alt === 0 && v.min >= 1 && v.max <= 12);
      const v = pick(list);
      const root = chordIn(makeKey('C'), { deg: rootPc, q }).root;
      const name = (id) => root + QUALITIES[id].symbol;
      return {
        prompt: 'Which chord is this? Find the root first (the lowest note), then read the shape.',
        extra: h('div', { class: 'quiz-diagram' }, chordDiagram(v.frets), h('button', {
          class: 'btn btn-sm btn-ghost', type: 'button', onClick: () => auditionChord(voicingMidi(v.frets), { slow: true }),
        }, icon('sound', 14), 'Hear it')),
        ...choices(name(q), qualities.map(name), Math.min(4, qualities.length)),
        explain: `${name(q)} = ${chordNotes(root, q).join(' ')} (${QUALITIES[q].iv.join(' ')}).`,
      };
    };
  },

  // "What is V7 of ii in G?"
  secondary() {
    const targets = ['ii', 'iii', 'IV', 'V', 'vi'];
    return () => {
      const key = makeKey(pick(EASY_KEYS));
      const target = pick(targets);
      const dom = chordIn(key, parseRoman(`V7/${target}`));
      const goal = chordIn(key, parseRoman(target));
      const wrong = targets.map((t) => chordIn(key, parseRoman(`V7/${t}`)).symbol).concat(chordIn(key, parseRoman('V7')).symbol);
      return {
        prompt: `In <b>${key.tonic} major</b>, which dominant chord pulls towards <b>${goal.symbol}</b> (${target})?`,
        ...choices(dom.symbol, wrong),
        explain: `Count up a 5th from ${goal.root} (or down a 4th): ${dom.root}. Make it a dominant 7th: ${dom.symbol} → ${goal.symbol}.`,
      };
    };
  },

  // Which chord in this loop isn't from the key?
  outsider({ progs }) {
    return () => {
      const key = pick(MORE_KEYS.slice(0, 6));
      const chords = resolveChords(key, 'major', parseProgression(pick(progs)));
      const odd = chords.find((c) => c.info.kind !== 'diatonic');
      const names = [...new Set(chords.map((c) => c.symbol))];
      return {
        prompt: `Key of <b>${key} major</b>: ${chords.map((c) => `<span class="chip">${c.symbol}</span>`).join(' ')}<br>Which chord is <b>not</b> in the key?`,
        choices: names,
        answer: names.indexOf(odd.symbol),
        explain: `${odd.symbol} is ${odd.roman} — ${odd.info.why}.`,
      };
    };
  },

  // Find a chord tone on the neck.
  chordTone({ qualities = ['maj7', 'm7', '7'], tones = ['R', '3', 'b3', '5', '7', 'b7'], from = 0, to = 12 } = {}) {
    return () => {
      const q = pick(qualities);
      const root = pick(['C', 'D', 'E', 'F', 'G', 'A', 'Bb']);
      const rootPc = makeKey(root).pc;
      const labels = toneLabels(q);
      const available = Object.entries(labels).filter(([, label]) => tones.includes(label));
      const [semis, label] = pick(available);
      const targetPc = mod12(rootPc + Number(semis));
      const noteNames = chordNotes(root, q);
      const name = noteNames[QUALITIES[q].semis.map(mod12).indexOf(Number(semis))];
      const word = label === 'R' ? 'root' : `${label.replace('b', '♭')}`;
      return {
        prompt: `Tap any <b>${word}</b> of <b>${root}${QUALITIES[q].symbol}</b> on the fretboard.`,
        fret: {
          from, to,
          accept: (string, fret) => (OPEN_MIDI[string] + fret) % 12 === targetPc,
          answerText: name,
          targetPc,
        },
        explain: `${root}${QUALITIES[q].symbol} = ${noteNames.join(' ')}. Its ${word} is ${name}.`,
      };
    };
  },

  // Hand-written multiple choice: [{ q, choices, answer, explain }]
  fixed(questions) {
    let bag = [];
    return () => {
      if (!bag.length) bag = shuffle(questions);
      const item = bag.pop();
      const correct = item.choices[item.answer];
      const opts = shuffle(item.choices);
      return { prompt: item.q, choices: opts, answer: opts.indexOf(correct), explain: item.explain || '' };
    };
  },

  // Mix several generators.
  mix(...gens) {
    return () => pick(gens)();
  },
};

// ---------------------------------------------------------------- runner ----

// opts: { title, gen, count, onPass }
export function quizWidget(opts) {
  const count = opts.count || 5;
  const root = h('section', { class: 'widget quiz' });
  const body = h('div', { class: 'quiz-body' });
  const score = h('span', { class: 'quiz-score' });
  root.append(h('div', { class: 'quiz-head' }, h('h4', { class: 'widget-title' }, opts.title || 'Check yourself'), score), body);

  let index = 0;
  let right = 0;

  function start() {
    index = 0;
    right = 0;
    next();
  }

  function finish() {
    const passed = right / count >= 0.8;
    score.textContent = `${right} / ${count}`;
    body.replaceChildren(
      h('p', { class: `quiz-result ${passed ? 'good' : ''}` }, passed
        ? `${right} out of ${count} — that's solid. On to the guitar.`
        : `${right} out of ${count}. Another round will make it stick — the questions change every time.`),
      h('button', { class: 'btn', type: 'button', onClick: start }, passed ? 'Go again' : 'Try again'),
    );
    if (passed) opts.onPass?.();
  }

  function next() {
    if (index >= count) {
      finish();
      return;
    }
    const q = opts.gen();
    index++;
    score.textContent = `${index} / ${count}`;
    const feedback = h('p', { class: 'quiz-feedback', hidden: true });
    const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onClick: next }, index >= count ? 'See result' : 'Next question');
    let answered = false;
    const settle = (ok) => {
      answered = true;
      if (ok) right++;
      feedback.hidden = false;
      feedback.className = `quiz-feedback ${ok ? 'good' : 'bad'}`;
      feedback.innerHTML = `<b>${ok ? 'Yes.' : 'Not quite.'}</b> ${q.explain || ''}`;
      nextBtn.hidden = false;
    };

    const parts = [h('p', { class: 'quiz-prompt', html: q.prompt })];
    if (q.play) {
      parts.push(h('button', { class: 'btn btn-sm', type: 'button', onClick: q.play }, icon('sound', 15), 'Play it'));
    }
    if (q.extra) parts.push(q.extra);

    if (q.fret) {
      const board = fretboard({
        from: q.fret.from, to: q.fret.to,
        onPick: (string, fret) => {
          if (answered) return;
          const ok = q.fret.accept(string, fret);
          const marks = [{ s: string, f: fret, text: ok ? '✓' : '×', cls: ok ? 'good' : 'bad' }];
          if (!ok) {
            for (let st = 0; st < 6; st++) {
              for (let f = q.fret.from; f <= q.fret.to; f++) {
                if ((OPEN_MIDI[st] + f) % 12 === q.fret.targetPc) marks.push({ s: st, f, text: q.fret.answerText, cls: 'tone' });
              }
            }
          }
          board.setMarkers(marks);
          settle(ok);
        },
      });
      parts.push(board.el);
    } else {
      const buttons = q.choices.map((label, i) => h('button', {
        class: 'quiz-choice', type: 'button',
        onClick: () => {
          if (answered) return;
          buttons.forEach((b, k) => {
            b.disabled = true;
            if (k === q.answer) b.classList.add('good');
          });
          if (i !== q.answer) buttons[i].classList.add('bad');
          settle(i === q.answer);
        },
      }, label));
      parts.push(h('div', { class: 'quiz-choices' }, buttons));
    }
    parts.push(feedback, nextBtn);
    body.replaceChildren(...parts);
    if (q.play && index > 1) q.play(); // after the first tap, audio is unlocked: auto-play
  }

  start();
  return root;
}
