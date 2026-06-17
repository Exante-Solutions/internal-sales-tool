/**
 * AssociateInitiative use case (SPEC §6.2, §6.3; RUBRIC F4/F5).
 *
 * On ingest, attempt to auto-link a conversation to an initiative:
 *   1. If the conversation came from a calendar event whose booking `linkId`
 *      maps to a stored InitiativeCalendarLink → associate automatically.
 *   2. Else → return null; the conversation lands in the Unassigned inbox for a
 *      human to link (nothing is blocked on association, SPEC §6.2).
 *
 * Wraps the pure lib/calendar/associate.mjs (RUBRIC F4). Domain + pure lib only —
 * no SDK, no framework, no ORM, no validator.
 */

import type { InitiativeRepository } from "@/domain/ports";
import { associateInitiative as associatePure } from "../../lib/calendar/associate.mjs";

/** Just enough of a calendar event to drive association. */
export interface CalendarLinkHint {
  /** Booking link / event-type id; maps to an initiative via the stored links. */
  linkId?: string | null;
}

export class AssociateInitiative {
  constructor(private readonly initiatives: InitiativeRepository) {}

  /**
   * @returns the matched initiativeId, or null → Unassigned inbox (F5).
   */
  async forCalendarLink(teamId: string, event: CalendarLinkHint): Promise<string | null> {
    if (!event || event.linkId == null) return null;
    const links = await this.initiatives.listCalendarLinks(teamId);
    const matched = associatePure(
      { linkId: event.linkId },
      links.map((l) => ({ linkId: l.linkId, initiativeId: l.initiativeId })),
    ) as string | null;
    return matched;
  }
}
