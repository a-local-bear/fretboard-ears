// Which reference (cadence / do / none) to play before a round's note.

/** Only the first round gets the reference when the player chose "once per level". */
export function referenceFor(settings, round) {
  return settings.refWhen === 'level' && round > 0 ? 'none' : settings.ref;
}
