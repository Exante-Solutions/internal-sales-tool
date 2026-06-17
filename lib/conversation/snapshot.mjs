/**
 * Affiliation snapshot at conversation time — pure (SPEC §7, RUBRIC D3/D4/D5).
 *
 * A conversation freezes WHO a participant was THEN: which email they used and
 * which company employed them at occurredAt. Later company moves never rewrite
 * history — filters read the frozen companyAtTime, and a manual override mints a
 * NEW participant object, leaving the original untouched.
 */

import { membershipAt } from "../company/membership.mjs";
import { emailAddressOf } from "../identity/resolve.mjs";

/**
 * @param {object} person
 * @param {string} occurredAtISO
 * @param {string} [emailUsed] the address actually used on the call; falls back
 *   to the person's first email only when not provided.
 * @returns {{emailUsed?:string, companyAtTime:string|null, roleAtTime:string|null}}
 */
export function participantSnapshot(person, occurredAtISO, emailUsed) {
  const m = membershipAt(person, occurredAtISO);
  return {
    emailUsed: emailUsed ?? emailAddressOf((person?.emails ?? [])[0]),
    companyAtTime: m ? m.companyId : null,
    // Freeze the role/title held under that membership at occurredAt.
    roleAtTime: m ? (m.title ?? m.role ?? null) : null,
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
