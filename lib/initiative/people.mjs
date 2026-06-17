/**
 * Initiative enums + people view — pure (SPEC §8, RUBRIC E4/E5/E6).
 *
 * Single source of truth for the initiative/target enums and the outreach
 * lifecycle. peopleView unions the targeted (prospect list) and the engaged
 * (people we've actually talked to) into one flagged roster, so a person who is
 * both shows up once with both flags.
 */

/** Outreach lifecycle for a targeted person on an initiative. */
export const TARGET_STATUSES = ["to_contact", "contacted", "responded", "engaged", "passed"];

/** Initiative classification. */
export const INITIATIVE_TYPES = ["market", "use_case", "persona", "workflow", "org"];

/** Initiative lifecycle. */
export const INITIATIVE_STATUSES = ["active", "paused", "done"];

/**
 * Advance a target to a new outreach status. Throws on a status outside the set.
 * @param {{personId:string,status:string}} target
 * @param {string} status
 */
export function advanceTarget(target, status) {
  if (!TARGET_STATUSES.includes(status)) {
    throw new Error(`invalid target status: ${status}`);
  }
  return { ...target, status };
}

/**
 * Union of targeted + engaged people, each flagged.
 * @param {{targets?:Array<{personId:string}>, engaged?:Array<{personId:string}>}} args
 * @returns {Array<{personId:string, targeted:boolean, engaged:boolean}>}
 */
export function peopleView({ targets = [], engaged = [] } = {}) {
  const targetedIds = new Set(targets.map((t) => t.personId));
  const engagedIds = new Set(engaged.map((e) => e.personId));
  const all = new Set([...targetedIds, ...engagedIds]);
  return [...all].map((personId) => ({
    personId,
    targeted: targetedIds.has(personId),
    engaged: engagedIds.has(personId),
  }));
}
