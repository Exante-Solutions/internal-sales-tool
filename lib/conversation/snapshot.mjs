/**
 * Affiliation snapshot at conversation time — pure (SPEC §7, RUBRIC D3/D4/D5).
 *
 * A conversation freezes WHO a participant was THEN: which email they used and
 * which company employed them at occurredAt. Later company moves never rewrite
 * history — filters read the frozen companyAtTime, and a manual override mints a
 * NEW participant object, leaving the original untouched.
 */

import { membershipAt } from "../company/membership.mjs";

/**
 * @param {object} person
 * @param {string} occurredAtISO
 * @returns {{emailUsed?:string, companyAtTime:string|null}}
 */
export function participantSnapshot(person, occurredAtISO) {
  const m = membershipAt(person, occurredAtISO);
  return {
    emailUsed: (person?.emails ?? [])[0],
    companyAtTime: m ? m.companyId : null,
  };
}

/**
 * Conversations whose participant snapshot puts them at `companyId`.
 * @param {Array} convs
 * @param {string} companyId
 */
export function filterConversationsByCompany(convs, companyId) {
  return (convs ?? []).filter((c) =>
    (c.participants ?? []).some((p) => p.companyAtTime === companyId),
  );
}

/**
 * Override a participant's frozen company, returning a NEW object.
 * The original participant is left untouched (pure).
 * @param {object} participant
 * @param {string} companyId
 */
export function overrideCompanyAtTime(participant, companyId) {
  return { ...participant, companyAtTime: companyId };
}
