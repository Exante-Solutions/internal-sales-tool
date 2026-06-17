/**
 * Profile timeline — append-only + derived rollup — pure (SPEC §11, RUBRIC I1/I2).
 *
 * A person's timeline is an immutable, append-only log of entries (notes, emails,
 * calls). appendEntry returns a NEW array. The summary is *derived*, never
 * stored as truth: it records how many entries it summarized so a stale rollup
 * is detectable.
 */

/**
 * Append an entry, returning a new array. Original untouched (pure).
 * @param {Array} timeline
 * @param {object} entry
 */
export function appendEntry(timeline, entry) {
  return [...(timeline ?? []), entry];
}

/**
 * Provenance for a derived summary: the entry count it covered.
 * @param {Array} timeline
 * @returns {{sourceEntryCount:number}}
 */
export function summarySource(timeline) {
  return { sourceEntryCount: (timeline ?? []).length };
}
