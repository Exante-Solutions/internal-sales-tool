/**
 * /api/conversations (SPEC §10).
 *   GET  → list conversations; `?inbox=1` (alias `?unassigned=1`) returns the
 *          Unassigned inbox (SPEC §6.2), `?initiativeId=` / `?personId=` filter.
 *   POST → create a pasted/manual conversation. A pasted transcript is parsed
 *          into the normalized IncomingRecording and ingested (identity
 *          resolution → conversation → recorder summary → follow-ups →
 *          calendar-match else inbox) via the IngestRecording use case.
 *
 * Thin controller: Zod at the edge, call the composition-root use case, return
 * JSON. Vendor objects never cross this boundary — only domain types.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { FakeRecorderAdapter } from "@/infrastructure/recorder/fake-recorder";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const session = await buildSession().current();
  const svc = getServices();
  const sp = req.nextUrl.searchParams;
  // Unassigned inbox (SPEC §6.2): the nav links `?inbox=1`; `?unassigned=1` kept as an alias (BF12).
  const isTruthy = (v: string | null) => v === "1" || v === "true";
  const unassignedOnly = isTruthy(sp.get("inbox")) || isTruthy(sp.get("unassigned"));
  const conversations = await svc.conversations.list(session.teamId, {
    initiativeId: sp.get("initiativeId") ?? undefined,
    unassignedOnly,
    personId: sp.get("personId") ?? undefined,
    companyAtTime: sp.get("companyId") ?? undefined,
  });
  return NextResponse.json({ conversations });
}

const Participant = z.object({ name: z.string().min(1), email: z.string().email() });

const Create = z.object({
  source: z.enum(["pasted", "manual"]),
  title: z.string().min(1),
  reasonMd: z.string().optional(),
  outcomeMd: z.string().optional(),
  occurredAt: z.string().optional(),
  participants: z.array(Participant).default([]),
  /** Required for source=pasted; ignored for manual (notes-only). */
  transcript: z.string().optional(),
  /** Manual notes (source=manual). */
  notes: z.string().optional(),
  recorderSummary: z.string().optional(),
  recorderActionItems: z.array(z.string()).default([]),
  /** Calendar booking link id → drives initiative auto-association (§6.3). */
  calendarLinkId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Create.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid request" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  if (d.source === "pasted" && !d.transcript?.trim()) {
    return NextResponse.json({ error: "a pasted conversation requires a transcript" }, { status: 400 });
  }

  const session = await buildSession().current();
  const svc = getServices();
  const recorder = new FakeRecorderAdapter();

  const recording = recorder.normalizePaste(d.transcript ?? d.notes ?? "", {
    occurredAt: d.occurredAt,
    participants: d.participants,
    recorderSummary: d.recorderSummary,
    recorderActionItems: d.recorderActionItems,
  });

  try {
    const result = await svc.ingestRecording.ingest(session, {
      source: d.source,
      recording,
      title: d.title,
      reasonMd: d.reasonMd,
      outcomeMd: d.outcomeMd,
      calendar: d.calendarLinkId ? { linkId: d.calendarLinkId } : undefined,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ingest failed" },
      { status: 500 },
    );
  }
}
