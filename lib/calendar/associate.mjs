/**
 * Calendar→initiative association — pure (SPEC §10, RUBRIC F4).
 *
 * A calendar event carries a linkId (e.g. a tagged invite/room). If it matches a
 * known initiative link, the event is auto-associated; otherwise it returns null
 * and the conversation lands in the unassigned inbox for manual triage.
 */

/**
 * @param {{linkId?:string}} event
 * @param {Array<{linkId:string, initiativeId:string}>} links
 * @returns {string|null} initiativeId or null
 */
export function associateInitiative(event, links) {
  if (!event || event.linkId == null) return null;
  const match = (links ?? []).find((l) => l.linkId === event.linkId);
  return match ? match.initiativeId : null;
}
