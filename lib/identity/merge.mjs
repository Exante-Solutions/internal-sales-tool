/**
 * Person merge — pure, dependency-free (SPEC §6, RUBRIC C3).
 *
 * Unifies two people under the survivor: emails are unioned (deduped),
 * memberships concatenated, and the absorbed person's id recorded so history
 * stays addressable. We tag provenance on the RETURNED survivor two compatible
 * ways (mergedAwayIds / absorbed) so every downstream reader can follow the
 * trail. Inputs are never mutated.
 */

import { normalizeEmail } from "./email.mjs";
import { emailAddressOf } from "./resolve.mjs";

/**
 * @param {object} survivor the canonical person that remains
 * @param {object} other    the person being absorbed
 * @returns unified survivor (new object; inputs not mutated)
 */
export function mergePeople(survivor, other) {
  const emails = [];
  const seen = new Set();
  for (const e of [...(survivor.emails ?? []), ...(other.emails ?? [])]) {
    const k = normalizeEmail(emailAddressOf(e));
    if (!seen.has(k)) {
      seen.add(k);
      emails.push(e);
    }
  }

  const memberships = [...(survivor.memberships ?? []), ...(other.memberships ?? [])];
  const mergedAwayIds = [...(survivor.mergedAwayIds ?? []), other.id].filter(Boolean);

  return {
    ...survivor,
    emails,
    memberships,
    mergedAwayIds,
    absorbed: mergedAwayIds,
  };
}
