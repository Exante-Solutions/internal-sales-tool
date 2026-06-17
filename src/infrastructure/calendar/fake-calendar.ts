/**
 * FakeCalendarGateway — the offline/test CalendarGateway (SPEC §6.3, §17). It
 * uses the shared normalizer so a raw inbound webhook body becomes a domain
 * CalendarEvent with no signature secret and no provider call. Lets the
 * booking→initiative association loop run offline (CLAUDE.md law 7).
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import type { CalendarGateway, CalendarEvent } from "@/domain/ports";
import { normalizeCalendarEvent } from "./normalize";

export class FakeCalendarGateway implements CalendarGateway {
  readonly provider = "fake";

  async normalizeEvent(raw: unknown): Promise<CalendarEvent> {
    return normalizeCalendarEvent(raw);
  }
}
