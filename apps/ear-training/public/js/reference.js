// Which reference (cadence / do / drone / none) to play before a round's note. 'do' is the root alone.

/**
 * Only the first round gets the reference when the player chose "once per level".
 * A drone is a continuous sound, which the mic would hear as an answer (and which keeps the mic
 * waiting forever), so with the mic on it falls back to the root alone.
 */
export function referenceFor(settings, round) {
  if (settings.refWhen === 'level' && round > 0) return 'none';
  if (settings.ref === 'none') return 'none';
  if (settings.ref === 'drone') return settings.mic ? 'do' : 'drone';
  return settings.ref;
}
