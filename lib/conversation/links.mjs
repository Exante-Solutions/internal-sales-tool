/**
 * Conversation↔initiative links — pure, immutable, many-to-many (RUBRIC E1/E2).
 *
 * A conversation can serve several initiatives and an initiative spans many
 * conversations. Links are flat {convId, initId} pairs; every mutator returns a
 * NEW array. Linking is idempotent (no duplicate pair); unlinking one pair
 * leaves the rest intact.
 */

/** @param {Array<{convId:string,initId:string}>} links */
export function linkInitiative(links, convId, initId) {
  const exists = (links ?? []).some((l) => l.convId === convId && l.initId === initId);
  return exists ? [...links] : [...(links ?? []), { convId, initId }];
}

/** @param {Array<{convId:string,initId:string}>} links */
export function unlinkInitiative(links, convId, initId) {
  return (links ?? []).filter((l) => !(l.convId === convId && l.initId === initId));
}

/** @returns {string[]} initiative ids linked to `convId` */
export function initiativesFor(links, convId) {
  return (links ?? []).filter((l) => l.convId === convId).map((l) => l.initId);
}
