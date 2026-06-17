/**
 * Company domain types (SPEC §3, §8.1). A Company is an aggregation lens over
 * people — NOT a top-level hierarchy. People hold time-ranged memberships.
 * The one invariant here is on the membership range: it cannot end before it
 * starts. That rule lives with the data it guards (CLAUDE.md law 4) as a guard
 * + smart constructor. No SDK, no framework, no ORM, no validator imports.
 */

export interface Company {
  id: string;
  teamId: string;
  name: string;
  /** Optional primary email domain (e.g. "acme.com"). */
  domain?: string;
  createdAt: string;
}

/** Optional descriptor of a person's role in a company over a span. */
export type MembershipLabel = string;

/**
 * Person ↔ Company over a time range. A person may hold several (job changes,
 * advisory roles). `endedOn === null` with `isCurrent` means an ongoing tenure.
 */
export interface CompanyMembership {
  id: string;
  personId: string;
  companyId: string;
  title?: string;
  /** ISO date (YYYY-MM-DD) or null if unknown/open-start. */
  startedOn?: string | null;
  /** ISO date (YYYY-MM-DD) or null for an ongoing membership. */
  endedOn?: string | null;
  isCurrent: boolean;
}

/** The fields the range invariant guards (a subset usable before an id exists). */
export interface MembershipRange {
  startedOn?: string | null;
  endedOn?: string | null;
  isCurrent?: boolean;
}

/**
 * Invariant (SPEC §8.1, RUBRIC D2): a membership cannot end before it starts.
 * An open range (no end, or current) is always valid. Pure, total, deterministic
 * — mirrors lib/company/membership.mjs::validateMembership which the libs assert.
 */
export function isValidMembershipRange(range: MembershipRange): boolean {
  const { startedOn, endedOn } = range;
  if (endedOn === null || endedOn === undefined) return true;
  if (startedOn === null || startedOn === undefined) return true;
  return endedOn >= startedOn;
}

/** Thrown by the smart constructor when the range invariant is violated. */
export class InvalidMembershipRangeError extends Error {
  constructor(public readonly range: MembershipRange) {
    super(
      `membership range invalid: ended_on (${range.endedOn}) is before started_on (${range.startedOn})`,
    );
    this.name = "InvalidMembershipRangeError";
  }
}

/**
 * Smart constructor: returns a CompanyMembership only if the range is valid,
 * else throws. Use this at the boundary where a membership is created so the
 * invariant can never be persisted in a broken state.
 */
export function makeCompanyMembership(membership: CompanyMembership): CompanyMembership {
  if (!isValidMembershipRange(membership)) {
    throw new InvalidMembershipRangeError(membership);
  }
  return membership;
}
