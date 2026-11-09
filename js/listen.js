// Passive listening: a level that plays itself, hands-free. Nothing is scored or logged.

/** Seconds the player gets to play the note(s) before the answer, counted from the last note. */
export const GAP_OPTIONS = ['3', '5', '8'];

/** How the speech engine should say each solfège syllable (as English text it reads reliably). */
const SAY_SOLFEGE = {
  Do: 'Doe', Ra: 'Rah', Re: 'Ray', Me: 'May', Mi: 'Me', Fa: 'Fah',
  Se: 'Say', Sol: 'Sole', Le: 'Lay', La: 'Lah', Te: 'Tay', Si: 'See',
};

/** A note name as words to speak: "Mi'" → "Me", "C♯" → "C sharp", "A" → "Ay" (not the article). */
export function spoken(name) {
  const base = name.replace(/'/g, '');
  if (SAY_SOLFEGE[base]) return SAY_SOLFEGE[base];
  return base.replace(/^A/, 'Ay').replace(/♯/g, ' sharp').replace(/♭/g, ' flat');
}

/**
 * The answer of a round, in seconds from its start: the phrase again, `phraseStep` apart, then
 * the steps of the last note's resolution (`resolution`, the note itself first), `resolveStep` apart.
 * Returns { notes: [{ note, t }], end } where `end` is when the last note sounds.
 */
export function revealTimeline(seq, resolution, phraseStep, resolveStep) {
  const notes = seq.map((note, i) => ({ note, t: i * phraseStep }));
  let t = (seq.length - 1) * phraseStep;
  for (const note of resolution.slice(1)) {
    t += resolveStep;
    notes.push({ note, t });
  }
  return { notes, end: t };
}
