// Sequencer: turns "these chords, this strum pattern, this groove, this melody"
// into timed events and plays them with a look-ahead scheduler.
//
// Time is counted in steps of a 16th note; a bar is 16 steps.

import { QUALITIES } from '../music/theory.js';
import { voicingMidi } from '../music/voicings.js';
import { chuck, dampStrings, getCtx, playBass, playDrum, playLead, pluckString, stopAll, strum, unlock } from './audio.js';

// Strum grids are one bar of sixteen 16ths:
//   D / d  down-strum (loud / soft)     U / u  up-strum (loud / soft)
//   x      muted "chk"                  N      down-strum of the NEXT chord, an 8th early (the push)
//   .      let it ring
// stab: chords are cut short.  sparse: don't add a strum where a chord arrives.
export const PATTERNS = {
  ring: { name: 'Let ring', grid: 'D...............', hint: 'One strum per chord. Maximum space.' },
  halves: { name: 'Half notes', grid: 'D.......d.......', hint: 'Strum on 1 and 3.' },
  quarters: { name: 'Quarter notes', grid: 'D...d...D...d...', hint: 'Four even down-strums.' },
  eighths: { name: 'Driving 8ths', grid: 'D.d.D.d.D.d.D.d.', hint: 'All down-strums, slightly accented on the beat.' },
  classic: { name: 'D–DU–UDU', grid: 'D...D.U...U.D.U.', hint: 'The campfire strum. Skip the down-strum on beat 3.' },
  lazy: { name: 'Lazy & syncopated', grid: 'D.....U...U.D...', hint: 'Hits on 1, the “and” of 2, the “and” of 3, and 4.' },
  push: { name: 'The push', grid: 'D...D.U...U.D.N.', hint: 'The next chord arrives an 8th note early and is held over the barline.' },
  skank: { name: 'Offbeat stabs', grid: '..U...U...U...U.', stab: true, sparse: true, hint: 'Short chops on every “and”.' },
  backbeat: { name: 'Backbeat chops', grid: '....D.......D...', stab: true, sparse: true, hint: 'Short chords on beats 2 and 4 only, with the snare.' },
  soul: { name: 'Soul stabs', grid: 'D..D..D...D.D...', stab: true, hint: 'Clipped 16th-note stabs in a 3-3-4-2 grouping.' },
  funk: { name: '16th scratch', grid: 'D.xUxDxU.UxDxUD.', stab: true, hint: 'Constant 16th motion, most of it muted.' },
  arp: { name: 'Arpeggio', arp: ['b', '3', '2', '1', '2', '3', '2', '3'], every: 2, hint: 'Pick through the chord in 8th notes: bass, then the top strings.' },
  arpSlow: { name: 'Slow arpeggio', arp: ['b', '3', '2', '1'], every: 4, hint: 'One note per beat. Dreamy.' },
};

// Drum grids: x = hit, o = accent / open hat, - = ghost.
// Bass: [step, tone, length] with tone R (root), 5 (fifth) or 8 (octave).
export const GROOVES = {
  none: { name: 'Guitar only', bpm: 84 },
  bedroom: {
    name: 'Bedroom (laid back)', bpm: 84,
    kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: [[0, 'R', 6], [8, 'R', 2], [10, 'R', 4], [14, '5', 2]],
  },
  jangle: {
    name: 'Indie jangle', bpm: 112,
    kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: [[0, 'R', 2], [2, 'R', 2], [4, 'R', 2], [6, 'R', 2], [8, 'R', 2], [10, 'R', 2], [12, 'R', 2], [14, 'R', 2]],
  },
  dream: {
    name: 'Dream-pop bounce', bpm: 100,
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.',
    bass: [[0, 'R', 3], [4, '8', 2], [6, 'R', 2], [8, 'R', 3], [12, '5', 2], [14, '8', 2]],
  },
  soul: {
    name: 'Neo-soul (swung)', bpm: 76, swing: 0.3,
    kick: 'x..x......x.....', snare: '....x.......x..-', hat: 'x.xxx.x.x.xxx.x.',
    bass: [[0, 'R', 3], [3, 'R', 2], [6, '8', 2], [10, 'R', 2], [12, '5', 3]],
  },
  boom: {
    name: 'Boom-bap', bpm: 88, swing: 0.22,
    kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx',
    bass: [[0, 'R', 5], [6, 'R', 3], [10, 'R', 4]],
  },
};

function bassNote(span, tone) {
  // Root between G1 and F#2 — low, but with enough harmonics for small speakers.
  const root = 31 + ((span.rootPc - 7 + 120) % 12);
  if (tone === '8') return root + 12;
  if (tone === '5') {
    const semis = span.q != null && QUALITIES[span.q] ? QUALITIES[span.q].semis : [0, 4, 7];
    const fifth = semis.includes(7) ? 7 : semis.includes(6) ? 6 : semis.includes(8) ? 8 : 7;
    return root + fifth > 43 ? root + fifth - 12 : root + fifth;
  }
  return root;
}

// arrangement → events.
//   chords: [{ rootPc, q, beats, frets: [6] }]
//   melody: [{ s, d, midi }]  (start step, duration in steps)
export function compile({ chords, pattern = 'ring', groove = 'none', melody = [], guitar = true }) {
  const spans = [];
  let at = 0;
  for (const c of chords) {
    const len = Math.max(1, Math.round(c.beats * 4));
    spans.push({ start: at, len, notes: voicingMidi(c.frets), rootPc: c.rootPc, q: c.q });
    at += len;
  }
  const total = at;
  const chordAt = new Int16Array(total);
  spans.forEach((sp, i) => chordAt.fill(i, sp.start, sp.start + sp.len));
  const steps = Array.from({ length: total }, () => []);
  const add = (step, ev) => {
    if (step >= 0 && step < total) steps[step].push(ev);
  };
  if (!total) return { total: 0, spans, chordAt, steps };

  // ---- guitar
  const pat = PATTERNS[pattern] || PATTERNS.ring;
  if (guitar && pat.arp) {
    const every = pat.every || 2;
    spans.forEach((sp, ci) => {
      for (let k = 0, s = sp.start; s < sp.start + sp.len; s += every, k++) {
        add(s, { kind: 'pick', ci, token: pat.arp[k % pat.arp.length], first: k === 0 });
      }
    });
  } else if (guitar) {
    const pushed = new Set(); // chords that were struck early and are tied over their downbeat
    const hits = [];
    for (let s = 0; s < total; s++) {
      const ch = pat.grid[s % 16];
      if (ch === '.') continue;
      const ci = chordAt[s];
      if (ch === 'N') {
        const left = spans[ci].start + spans[ci].len - s;
        if (left <= 2 && spans.length > 1) {
          const next = (ci + 1) % spans.length;
          pushed.add(next);
          hits.push({ s, ci: next, ch: 'D', early: true });
          continue;
        }
        hits.push({ s, ci, ch: 'U' });
        continue;
      }
      hits.push({ s, ci, ch });
    }
    // Every chord has to sound when it arrives, whatever the pattern says —
    // unless the pattern is deliberately sparse (chops that skip the downbeat).
    if (!pat.sparse) {
      const taken = new Set(hits.map((h) => h.s));
      spans.forEach((sp, ci) => {
        if (!taken.has(sp.start)) hits.push({ s: sp.start, ci, ch: 'D' });
      });
    }
    for (const h of hits) {
      const onArrival = !h.early && h.s === spans[h.ci].start;
      const tied = onArrival && pushed.has(h.ci);
      if (tied && h.s !== 0) continue;
      if (h.ch === 'x') {
        add(h.s, { kind: 'chuck', vel: 0.55 });
        continue;
      }
      const down = h.ch === 'D' || h.ch === 'd';
      const loud = h.ch === 'D' || h.ch === 'U';
      let vel = down ? (loud ? 0.88 : 0.6) : loud ? 0.62 : 0.42;
      if (h.s % 16 === 0 || onArrival) vel = Math.min(1, vel + 0.1);
      // A tied chord at step 0 only sounds the very first time round the loop.
      add(h.s, { kind: 'strum', ci: h.ci, dir: down ? 'D' : 'U', vel, stab: !!pat.stab, firstPassOnly: tied });
    }
  }

  // ---- band
  const gr = GROOVES[groove] || GROOVES.none;
  if (gr.bass) {
    const taken = new Set();
    for (let bar = 0; bar * 16 < total; bar++) {
      for (const [offset, tone, len] of gr.bass) {
        const s = bar * 16 + offset;
        if (s >= total) continue;
        const sp = spans[chordAt[s]];
        add(s, { kind: 'bass', midi: bassNote(sp, tone), len: Math.min(len, sp.start + sp.len - s) });
        taken.add(s);
      }
    }
    for (const sp of spans) {
      if (!taken.has(sp.start)) add(sp.start, { kind: 'bass', midi: bassNote(sp, 'R'), len: Math.min(4, sp.len) });
    }
  }
  if (gr.kick) {
    const VEL = { x: 0.8, o: 1, '-': 0.35 };
    for (let s = 0; s < total; s++) {
      const k = s % 16;
      if (gr.kick[k] !== '.') add(s, { kind: 'drum', drum: 'kick', vel: VEL[gr.kick[k]] });
      if (gr.snare[k] !== '.') add(s, { kind: 'drum', drum: 'snare', vel: VEL[gr.snare[k]] });
      if (gr.hat[k] !== '.') add(s, { kind: 'drum', drum: gr.hat[k] === 'o' ? 'ohat' : 'hat', vel: k % 4 === 0 ? 0.9 : 0.6 });
    }
  }

  // ---- melody
  const starts = new Map();
  for (const n of melody) starts.set(n.s, (starts.get(n.s) || 0) + 1);
  for (const n of melody) add(n.s, { kind: 'lead', midi: n.midi, len: n.d, poly: starts.get(n.s) > 1 });

  return { total, spans, chordAt, steps, swing: gr.swing || 0 };
}

class Player {
  constructor() {
    this.playing = false;
    this.owner = null;
  }

  // opts: { bpm, loop, owner, onStep(step), onChord(index), onStop() }
  play(comp, opts = {}) {
    this.stop();
    if (!comp.total) return;
    const ctx = unlock();
    this.comp = comp;
    this.bpm = opts.bpm || 90;
    this.loop = opts.loop !== false;
    this.owner = opts.owner ?? null;
    this.onStep = opts.onStep;
    this.onChord = opts.onChord;
    this.onStop = opts.onStop;
    this.step = 0;
    this.pass = 0;
    this.queue = [];
    this.lastChord = -1;
    this.endTime = null;
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.12;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    const frame = () => {
      if (!this.playing) return;
      this.flushUi();
      if (this.playing) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  // Swap in an edited arrangement without stopping (e.g. the melody changed).
  update(comp) {
    if (!this.playing || !comp.total) return;
    this.comp = comp;
    this.step %= comp.total;
  }

  setBpm(bpm) {
    this.bpm = bpm;
  }

  tick() {
    const ctx = getCtx();
    const stepDur = 60 / this.bpm / 4;
    while (this.playing && this.endTime == null && this.nextTime < ctx.currentTime + 0.16) {
      this.schedule(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
      if (this.step >= this.comp.total) {
        if (this.loop) {
          this.step = 0;
          this.pass++;
        } else {
          this.endTime = this.nextTime + stepDur * 2;
          clearInterval(this.timer);
        }
      }
    }
  }

  schedule(step, time, stepDur) {
    const { comp } = this;
    const t = time + (step % 2 === 1 ? comp.swing * stepDur : 0);
    for (const ev of comp.steps[step]) {
      switch (ev.kind) {
        case 'strum': {
          if (ev.firstPassOnly && this.pass > 0) break;
          const jitter = (Math.random() - 0.5) * 0.006;
          strum(comp.spans[ev.ci].notes, Math.max(t + jitter, 0), {
            dir: ev.dir,
            vel: ev.vel * (0.94 + Math.random() * 0.12),
            dur: ev.stab ? stepDur * 1.25 : null,
          });
          break;
        }
        case 'pick': {
          const notes = comp.spans[ev.ci].notes;
          const sounding = [];
          for (let s = 0; s < 6; s++) if (notes[s] != null) sounding.push(s);
          if (!sounding.length) break;
          if (ev.first) dampStrings(t, 0.04);
          const top = sounding.length - 1;
          const idx = ev.token === 'b' ? 0 : Math.max(sounding.length > 1 ? 1 : 0, top - (Number(ev.token) - 1));
          const s = sounding[idx];
          pluckString(s, notes[s], t, { vel: ev.token === 'b' ? 0.95 : 0.78 });
          break;
        }
        case 'chuck':
          chuck(t, ev.vel);
          break;
        case 'bass':
          playBass(ev.midi, t, ev.len * stepDur * 0.9, 0.85);
          break;
        case 'drum':
          playDrum(ev.drum, t, ev.vel);
          break;
        case 'lead':
          playLead(ev.midi, t, ev.len * stepDur * 0.97, 0.9, ev.poly);
          break;
        default:
      }
    }
    this.queue.push({ time: t, step });
    if (this.queue.length > 256) this.queue.splice(0, this.queue.length - 64);
  }

  flushUi() {
    const now = getCtx().currentTime;
    while (this.queue.length && this.queue[0].time <= now) {
      const { step } = this.queue.shift();
      const ci = this.comp.chordAt[step] ?? -1;
      if (ci !== this.lastChord) {
        this.lastChord = ci;
        this.onChord?.(ci);
      }
      this.onStep?.(step);
    }
    if (this.endTime != null && now >= this.endTime) this.finish(false);
  }

  stop() {
    if (this.playing) this.finish(true);
  }

  finish(cut) {
    this.playing = false;
    this.owner = null;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    if (cut) stopAll();
    const cb = this.onStop;
    this.onStop = null;
    cb?.();
  }
}

// One transport for the whole app: starting anything stops whatever was playing.
export const player = new Player();
