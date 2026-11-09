// Which reference (cadence / do / drone / none) to play before a round's note.

/**
 * Only the first round gets the reference when the player chose "once per level".
 * With "note over a chord" on, any reference but Nothing becomes the cadence.
 * A drone is a continuous sound, which the mic would hear as an answer (and which keeps the mic
 * waiting forever), so with the mic on it falls back to the single Do note.
 */
export function referenceFor(settings, round) {
  if (settings.refWhen === 'level' && round > 0) return 'none';
  if (settings.ref === 'none') return 'none';
  // With a chord under the note the cadence sets the key; a drone or lone Do would clash with it.
  if (settings.over && settings.over !== 'off') return 'cadence';
  if (settings.ref === 'drone') return settings.mic ? 'do' : 'drone';
  return settings.ref;
}
