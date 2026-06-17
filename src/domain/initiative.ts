/**
 * Initiative domain (SPEC §3, §8.1, §11). A discovery initiative is a focused
 * outbound/research effort, tracked separately from any CRM deal. People relate
 * to it two ways: explicit `InitiativeTarget`s (the prospect list, no call
 * required) and inferred engaged people (anyone with a linked conversation).
 *
 * The type/status enums are declared here as the single domain source; the pure
 * lib lib/initiative/people.mjs asserts the same string sets (RUBRIC E6/E4).
 * No SDK, no framework, no ORM, no validator imports.
 */

/** SPEC §8.1 initiative.type. */
export const INITIATIVE_TYPES = [
  "market",
  "use_case",
  "persona",
  "workflow",
  "org",
] as const;
export type InitiativeType = (typeof INITIATIVE_TYPES)[number];

/** SPEC §8.1 initiative.status. */
export const INITIATIVE_STATUSES = ["active", "paused", "done"] as const;
export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];

/** SPEC §8.1 initiative_target.status (outreach lifecycle, advanceable). */
export const TARGET_STATUSES = [
  "to_contact",
  "contacted",
  "responded",
  "engaged",
  "passed",
] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

export interface Initiative {
  id: string;
  teamId: string;
  name: string;
  type: InitiativeType;
  /** Markdown goal/objective of the initiative. */
  goalMd: string;
  /** Markdown hypothesis under test. */
  hypothesisMd: string;
  status: InitiativeStatus;
  createdBy: string;
  createdAt: string;
}

/**
 * An explicit Person↔Initiative link forming the prospect list. Added before
 * (or independent of) any conversation; carries outreach status + optional
 * reason. UNIQUE(initiativeId, personId) at the DB layer.
 */
export interface InitiativeTarget {
  id: string;
  initiativeId: string;
  personId: string;
  status: TargetStatus;
  reasonMd?: string;
  addedBy: string;
  createdAt: string;
}

/**
 * Per-user booking link → initiative (SPEC §6.3, §8.1). A calendar event whose
 * `linkId` matches one of these auto-associates its conversation to the
 * initiative; no match → the Unassigned inbox (SPEC §6.2).
 */
export interface InitiativeCalendarLink {
  id: string;
  initiativeId: string;
  appUserId: string;
  provider: string;
  /** The booking link / event-type id that maps to this initiative. */
  linkId: string;
  label?: string;
}

/**
 * A row of the people view (SPEC §11 initiative detail): targets ∪ engaged,
 * each flagged. Mirrors lib/initiative/people.mjs::peopleView output (RUBRIC E5).
 */
export interface InitiativePersonView {
  personId: string;
  targeted: boolean;
  engaged: boolean;
}
