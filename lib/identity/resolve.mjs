/**
 * Identity resolution — pure, dependency-free (SPEC §6, RUBRIC C1/C2/C4).
 *
 * NEVER silent-merges. A known email (exact match against any of a person's
 * normalized emails) → status "known", attached to that person. An unknown
 * email → status "provisional", personId null, with merge *suggestions* the
 * human confirms: exact domain/known matches plus fuzzy hintName matches against
 * existing display names. Suggestions are advisory, not automatic.
 */

import { normalizeEmail } from "./email.mjs";

/**
 * Extract a raw address from an emails[] entry that may be a plain string or a
 * domain EmailIdentity object ({emailNormalized} / {email}). Tolerant so both
 * raw and hydrated people flow through normalizeEmail correctly.
 * @param {string | {emailNormalized?:string, email?:string}} entry
 * @returns {string}
 */
export function emailAddressOf(entry) {
  if (entry && typeof entry === "object") {
    return entry.emailNormalized ?? entry.email ?? "";
  }
  return entry ?? "";
}

/**
 * True if `email` (normalized) matches ANY of `person`'s emails (normalized).
 * Spans all of a person's addresses so "when have I talked to X" is complete.
 * @param {{emails?:Array<string|object>}} person
 * @param {string} email
 */
export function personMatchesEmail(person, email) {
  const target = normalizeEmail(email);
  return (person?.emails ?? []).some((e) => normalizeEmail(emailAddressOf(e)) === target);
}

/** Loose name equality for fuzzy hint matching: case/space-insensitive. */
function nameKey(name) {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param {string} email
 * @param {{people?:Array, hintName?:string}} opts
 * @returns {{status:"known"|"provisional", personId:string|null, suggestions:Array<{personId:string}>}}
 */
export function resolveIdentity(email, { people = [], hintName } = {}) {
  // 1. Exact, known email → attach, no suggestions, no merge.
  const known = people.find((p) => personMatchesEmail(p, email));
  if (known) {
    return { status: "known", personId: known.id, suggestions: [] };
  }

  // 2. Unknown → provisional. Gather advisory merge suggestions (fuzzy hintName).
  const suggestions = [];
  if (hintName) {
    const hk = nameKey(hintName);
    for (const p of people) {
      // Raw people expose displayName; hydrated Person records expose
      // primaryDisplayName — match against whichever is present.
      const name = p.displayName ?? p.primaryDisplayName;
      if (hk && nameKey(name) === hk) {
        suggestions.push({ personId: p.id, displayName: name, reason: "name" });
      }
    }
  }

  return { status: "provisional", personId: null, suggestions };
}
