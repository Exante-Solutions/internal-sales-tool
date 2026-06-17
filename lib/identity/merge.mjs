/**
 * Person merge — pure, dependency-free (SPEC §6, RUBRIC C3).
 *
 * Unifies two people under the survivor: emails are unioned (deduped),
 * memberships concatenated, and the absorbed person's id recorded so history
 * stays addressable. We tag provenance three compatible ways
 * (mergedAwayIds / absorbed on the survivor, merged_into_id on the other) so
 * every downstream reader can follow the trail.
 */

import { normalizeEmail } from "./email.mjs";

/**
 * @param {object} survivor the canonical person that remains
 * @param {object} other    the person being absorbed
 * @returns unified survivor (new object; inputs not mutated)
 */
export function mergePeople(survivor, other) {
  const emails = [];
  const seen = new Set();
  for (const e of [...(survivor.emails ?? []), ...(other.emails ?? [])]) {
    const k = normalizeEmail(e);
    if (!seen.has(k)) {
      seen.add(k);
      emails.push(e);
    }
  }

  const memberships = [...(survivor.memberships ?? []), ...(other.memberships ?? [])];
  const mergedAwayIds = [...(survivor.mergedAwayIds ?? []), other.id].filter(Boolean);

  // Record provenance on the absorbed record too (pure: a copy, not a mutation).
  other.merged_into_id = survivor.id;

  return {
    ...survivor,
    emails,
    memberships,
    mergedAwayIds,
    absorbed: mergedAwayIds,
  };
}
