/**
 * CalendarProviderAdapter — the live CalendarGateway scaffold (SPEC §6.3, §17).
 * Calendar is a v1 live integration: a normalized inbound webhook whose
 * signature is verified with CALENDAR_WEBHOOK_SECRET before the body is trusted.
 * The provider payload dies here; only the domain CalendarEvent crosses out
 * (CLAUDE.md law 2/3). A concrete provider (Cal.com/Calendly/Google) plugs in
 * behind this same port without touching the use case.
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { CalendarGateway, CalendarEvent } from "@/domain/ports";
import { normalizeCalendarEvent } from "./normalize";

export class CalendarProviderAdapter implements CalendarGateway {
  readonly provider: string;

  constructor(
    provider = "calendar",
    private readonly webhookSecret = process.env.CALENDAR_WEBHOOK_SECRET,
  ) {
    this.provider = provider;
  }

  /**
   * Verify an inbound webhook's HMAC-SHA256 signature against the shared secret.
   * The raw request body (exact bytes) and the provider's signature header are
   * supplied by the route; this keeps signing logic in the adapter, not the edge.
   */
  verifySignature(rawBody: string, signature: string | null | undefined): boolean {
    if (!this.webhookSecret) {
      throw new Error("CALENDAR_WEBHOOK_SECRET is not configured");
    }
    if (!signature) return false;
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const provided = signature.replace(/^sha256=/, "");
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /** Translate a raw, already-verified provider event into the domain contract. */
  async normalizeEvent(raw: unknown): Promise<CalendarEvent> {
    return normalizeCalendarEvent(raw);
  }
}
