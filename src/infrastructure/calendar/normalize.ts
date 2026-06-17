/**
 * Calendar webhook normalization (SPEC §6.3). A raw provider event payload is
 * vendor-shaped chaos; it dies here and is translated into the domain-owned
 * CalendarEvent before anything else sees it (CLAUDE.md law 2/3). Both the fake
 * and the live provider adapter share this single normalizer so the
 * linkId→initiative association (lib/calendar/associate) has one stable input.
 */

import type { CalendarEvent } from "@/domain/ports";

/** A tolerant, vendor-agnostic view of the common booking-webhook fields. */
interface RawCalendarPayload {
  externalId?: string;
  id?: string;
  uid?: string;
  linkId?: string;
  eventTypeId?: string | number;
  event_type_id?: string | number;
  status?: string;
  type?: string;
  start?: string;
  startTime?: string;
  start_time?: string;
  end?: string;
  endTime?: string;
  end_time?: string;
  attendees?: Array<{ name?: string; email?: string } | string>;
  invitees?: Array<{ name?: string; email?: string } | string>;
  initiativeHint?: string;
  notes?: string;
}

const STATUS_MAP: Record<string, CalendarEvent["status"]> = {
  created: "created",
  booking_created: "created",
  scheduled: "created",
  confirmed: "created",
  updated: "updated",
  rescheduled: "updated",
  booking_rescheduled: "updated",
  cancelled: "cancelled",
  canceled: "cancelled",
  booking_cancelled: "cancelled",
};

function normalizeStatus(raw?: string): CalendarEvent["status"] {
  if (!raw) return "created";
  return STATUS_MAP[raw.toLowerCase()] ?? "created";
}

function normalizeAttendees(
  list: RawCalendarPayload["attendees"] | RawCalendarPayload["invitees"],
): CalendarEvent["attendees"] {
  if (!Array.isArray(list)) return [];
  const out: CalendarEvent["attendees"] = [];
  for (const a of list) {
    if (typeof a === "string") {
      if (a.includes("@")) out.push({ email: a.trim() });
    } else if (a && typeof a.email === "string" && a.email.includes("@")) {
      out.push({ name: a.name, email: a.email.trim() });
    }
  }
  return out;
}

/** Translate a raw provider webhook body into the domain CalendarEvent. */
export function normalizeCalendarEvent(raw: unknown): CalendarEvent {
  const p = (raw ?? {}) as RawCalendarPayload;
  const externalId = p.externalId ?? p.id ?? p.uid;
  if (!externalId) {
    throw new Error("calendar webhook missing an event id (externalId/id/uid)");
  }
  const linkRaw = p.linkId ?? p.eventTypeId ?? p.event_type_id;
  return {
    externalId: String(externalId),
    linkId: linkRaw != null ? String(linkRaw) : undefined,
    status: normalizeStatus(p.status ?? p.type),
    start: p.start ?? p.startTime ?? p.start_time ?? "",
    end: p.end ?? p.endTime ?? p.end_time ?? "",
    attendees: normalizeAttendees(p.attendees ?? p.invitees),
    initiativeHint: p.initiativeHint ?? p.notes,
  };
}
