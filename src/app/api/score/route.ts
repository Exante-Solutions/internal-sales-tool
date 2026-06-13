/**
 * POST /api/score — the scoring controller (composition root for HTTP).
 * Parses the request (Zod, at the edge), builds the CoachService (real Opus
 * adversarial scorer when keyed, seeded fake otherwise), and returns the atomic
 * evaluation + the fumbled moment + a drill scenario. Vendor objects never
 * cross this boundary — only domain types.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildCoachService, scoringMode } from "@/infrastructure/composition";
import { buildTranscript } from "@/lib/ingest";
import { TRANSCRIPTS } from "@/data/seed";
import { ScoringIntegrityError } from "@/domain/errors";
import type { Transcript } from "@/domain/coaching";

export const runtime = "nodejs";
export const maxDuration = 120;

const ByCallId = z.object({ callId: z.string().min(1) });
const ByPaste = z.object({
  transcript: z.string().min(1),
  callType: z.enum(["discovery", "demo"]),
  callId: z.string().min(1).optional(),
  prospect: z.string().default("Prospect"),
  contact: z.string().default("Contact"),
  contactRole: z.string().default(""),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  let transcript: Transcript;
  const byId = ByCallId.safeParse(body);
  if (byId.success && TRANSCRIPTS[byId.data.callId]) {
    transcript = TRANSCRIPTS[byId.data.callId];
  } else {
    const byPaste = ByPaste.safeParse(body);
    if (!byPaste.success) {
      return NextResponse.json(
        { error: byPaste.error.issues[0]?.message ?? "invalid request" },
        { status: 400 },
      );
    }
    const d = byPaste.data;
    transcript = buildTranscript(d.transcript, {
      callId: d.callId ?? `live-${Date.now()}`,
      callType: d.callType,
      prospect: d.prospect,
      contact: d.contact,
      contactRole: d.contactRole,
    });
  }

  const coach = buildCoachService();
  try {
    const evaluation = await coach.score(transcript);
    const moment = coach.fumbledMoment(evaluation, transcript);
    const scenario = await coach.scenario(moment, transcript);
    return NextResponse.json({ mode: scoringMode(), evaluation, moment, scenario });
  } catch (err) {
    if (err instanceof ScoringIntegrityError) {
      return NextResponse.json({ error: "scoring failed integrity check", issues: err.issues }, { status: 422 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "scoring failed" },
      { status: 500 },
    );
  }
}
