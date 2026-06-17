/**
 * Company membership validity + point-in-time lookup — pure (SPEC §7, RUBRIC D2).
 *
 * A membership invariant: ended_on, when present, must be on/after started_on.
 * A null end (current/ongoing) is always valid. membershipAt answers "which
 * company employed this person on date D" by finding the membership whose range
 * brackets D — the basis for the affiliation snapshot frozen at call time.
 */

/**
 * @param {{startedOn?:string|null, endedOn?:string|null, isCurrent?:boolean}} m
 * @returns {boolean}
 */
export function validateMembership({ startedOn, endedOn } = {}) {
  if (endedOn == null) return true; // open-ended / current
  if (startedOn == null) return true; // no start constraint to violate
  return endedOn >= startedOn; // ISO date strings compare lexicographically
}

/**
 * The membership in effect for `person` on `dateISO`, or null.
 * @param {{memberships?:Array}} person
 * @param {string} dateISO
 */
export function membershipAt(person, dateISO) {
  const day = String(dateISO ?? "").slice(0, 10);
  const matches = (person?.memberships ?? []).filter((m) => {
    const start = m.startedOn ? String(m.startedOn).slice(0, 10) : null;
    const end = m.endedOn ? String(m.endedOn).slice(0, 10) : null;
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
  if (matches.length === 0) return null;
  // Prefer the most specific/latest-starting membership bracketing the date.
  return matches.reduce((best, m) =>
    (m.startedOn ?? "") > (best.startedOn ?? "") ? m : best,
  );
}
