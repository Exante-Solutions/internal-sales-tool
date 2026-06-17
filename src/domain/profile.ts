/**
 * Profile domain (SPEC §3, §4.4, §8.1). A Person/Company profile is an
 * append-only TimelineEntry log plus a derived ProfileSummary AI rollup. The
 * rollup records the entry count it summarized so staleness is detectable
 * (RUBRIC I1/I2). Mirrors lib/profile/timeline.mjs (appendEntry/summarySource).
 * No SDK, no framework, no ORM, no validator imports.
 */

/** What a profile timeline is about. */
export type SubjectType = "person" | "company";

/** SPEC §8.1 timeline_entry.kind. */
export const TIMELINE_KINDS = ["conversation", "note", "email", "calendar"] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

/**
 * An append-only event on a Person/Company profile. Never mutated in place;
 * `appendEntry` returns a new array (the libs assert purity).
 */
export interface TimelineEntry {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  kind: TimelineKind;
  /** Id of the underlying record (conversation/email/calendar event), if any. */
  refId?: string | null;
  occurredAt: string;
  bodyMd: string;
  createdBy: string;
  createdAt: string;
}

/**
 * The regenerated AI rollup over a timeline. `sourceEntryCount` records how many
 * timeline entries this summary covered, so a profile knows when its summary is
 * stale relative to its (grown) timeline.
 */
export interface ProfileSummary {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  summaryMd: string;
  generatedAt: string;
  sourceEntryCount: number;
}

/**
 * A permanently-persisted, deduped email message attributed to a Person (SPEC
 * §6.4, §8.1). Pulled on-demand across all connected team mailboxes; deduped by
 * RFC `rfcMessageId` (UNIQUE). Persisted so the profile survives even if mailbox
 * access later changes. Mirrors lib/email/dedupe.mjs input shape (RUBRIC J2/J3).
 */
export interface EmailMessage {
  id: string;
  personId: string;
  /** RFC Message-ID — the cross-mailbox dedupe key (UNIQUE). */
  rfcMessageId: string;
  threadId?: string | null;
  fromEmail: string;
  toEmails: string[];
  subject?: string;
  snippet?: string;
  occurredAt: string;
  /** Which workspace user's mailbox this copy was synced from. */
  syncedByUserId: string;
}
