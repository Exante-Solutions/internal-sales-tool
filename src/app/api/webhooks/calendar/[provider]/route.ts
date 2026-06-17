/**
 * POST /api/webhooks/calendar/[provider] (SPEC §6.3, §10). The v1 live calendar
 * integration: verify the inbound signature (when a live provider is wired),
 * normalize the raw provider payload into the domain CalendarEvent, then map its
 * booking `linkId` to an initiative (else it lands unassigned). The provider
 * payload dies at the adapter; only domain types cross out.
 *
 * Signature verification + normalization live in the CalendarGateway adapter —
 * the route only routes. Offline (no CALENDAR_WEBHOOK_SECRET) the fake adapter
 * skips verification so the booking→initiative loop runs with no secret.
 *
 * NOTE: CalendarEvent persistence (a CalendarEvent repository) is not yet wired;
 * this route normalizes + maps the link and returns the resolved initiative. The
 * recorder ingest later re-uses the same calendar linkId hint to attribute a
 * recording to the initiative (§6.3).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServices, buildSession, buildCalendarGateway } from "@/infrastructure/composition";
import { CalendarProviderAdapter } from "@/infrastructure/calendar/provider-adapter";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const rawBody = await req.text();
  const gateway = buildCalendarGateway(provider);

  // Verify the signature only when the live (secret-configured) adapter is wired.
  if (gateway instanceof CalendarProviderAdapter) {
    const signature =
      req.headers.get("x-webhook-signature") ??
      req.headers.get("x-signature") ??
      req.headers.get("x-cal-signature-256");
    let ok = false;
    try {
      ok = gateway.verifySignature(rawBody, signature);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "signature verification failed" },
        { status: 500 },
      );
    }
    if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  let event;
  try {
    event = await gateway.normalizeEvent(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "could not normalize event" },
      { status: 400 },
    );
  }

  const session = await buildSession().current();
  const svc = getServices();
  const initiativeId = await svc.associateInitiative.forCalendarLink(session.teamId, {
    linkId: event.linkId ?? null,
  });

  return NextResponse.json({ event, initiativeId });
}
