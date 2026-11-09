// Timing maths for the looping backing track. Pure, so the lookahead scheduler in audio.js stays thin.

export const BEATS_PER_BAR = 4;

export const beatSeconds = (bpm) => 60 / bpm;
export const chordSeconds = (bpm, bars) => beatSeconds(bpm) * BEATS_PER_BAR * bars;

/** Strums within one bar: beat, loudness, and direction (up-strums use only the top strings). */
export const BAR_PATTERN = [
  { beat: 0, gain: 0.3, dir: 'down' },
  { beat: 2, gain: 0.22, dir: 'down' },
  { beat: 3.5, gain: 0.15, dir: 'up' },
];

/**
 * Every strum of one pass through the progression, in time order:
 * { t (seconds from the loop start), chord (slot index), gain, dir, change (first strum of a chord) }.
 */
export function loopEvents(slotCount, bpm, bars) {
  const beat = beatSeconds(bpm);
  const events = [];
  for (let c = 0; c < slotCount; c++) {
    for (let b = 0; b < bars; b++) {
      BAR_PATTERN.forEach((s, i) => events.push({
        t: (c * bars + b) * BEATS_PER_BAR * beat + s.beat * beat,
        chord: c, gain: s.gain * (b === 0 && i === 0 ? 1.1 : 1), dir: s.dir, change: b === 0 && i === 0,
      }));
    }
  }
  return events;
}

/** Length of one pass in seconds. */
export const cycleSeconds = (slotCount, bpm, bars) => slotCount * chordSeconds(bpm, bars);

/**
 * The events to schedule now: those from the absolute counter `next` on whose time is before
 * `now + ahead`. Counter j is event j % events.length of pass floor(j / events.length), so the
 * loop never ends. Returns { due: [{ ...event, time }], next }.
 */
export function dueEvents(events, cycle, start, next, now, ahead) {
  const due = [];
  let j = next;
  for (;;) {
    const e = events[j % events.length];
    const time = start + Math.floor(j / events.length) * cycle + e.t;
    if (time >= now + ahead) break;
    due.push({ ...e, time });
    j++;
  }
  return { due, next: j };
}
