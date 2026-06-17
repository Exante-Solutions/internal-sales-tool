/**
 * FollowUp domain (SPEC §3, §8.1). A structured next-step on a conversation,
 * surfaced on the person and initiative. Text + status, with an optional owner
 * (a person OR an app-user) and due date, and a source telling where it came
 * from (recorder-extracted, AI-suggested, or manually added).
 * No SDK, no framework, no ORM, no validator imports.
 */

/** SPEC §8.1 follow_up.status. */
export const FOLLOWUP_STATUSES = ["open", "done"] as const;
export type FollowUpStatus = (typeof FOLLOWUP_STATUSES)[number];

/** SPEC §8.1 follow_up.source — provenance of the follow-up. */
export const FOLLOWUP_SOURCES = ["recorder", "ai", "manual"] as const;
export type FollowUpSource = (typeof FOLLOWUP_SOURCES)[number];

export interface FollowUp {
  id: string;
  conversationId: string;
  text: string;
  status: FollowUpStatus;
  source: FollowUpSource;
  /** Owner as a tracked Person (e.g. the prospect). */
  ownerPersonId?: string | null;
  /** Owner as a workspace user (e.g. the rep). */
  ownerUserId?: string | null;
  /** ISO date (YYYY-MM-DD) the follow-up is due. */
  dueOn?: string | null;
  /**
   * ISO timestamp when the follow-up was archived (SPEC §18.6). When set, the
   * follow-up is hidden from default lists; `status` still records open/done.
   * null/undefined means not archived.
   */
  archivedAt?: string | null;
  createdAt: string;
}
