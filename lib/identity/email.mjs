/**
 * Email normalization — pure, dependency-free (SPEC §6, RUBRIC C5).
 *
 * The single source of truth for folding an email to its canonical form so
 * identity resolution and dedup are deterministic across the workspace. Trims
 * surrounding whitespace and lowercases. (We deliberately do NOT strip dots or
 * +tags — that is provider-specific and would over-merge distinct identities.)
 */

/** @param {string} raw @returns {string} canonical email */
export function normalizeEmail(raw) {
  return String(raw ?? "").trim().toLowerCase();
}
