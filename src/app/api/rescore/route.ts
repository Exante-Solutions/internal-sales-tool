/**
 * POST /api/rescore — score a drill transcript on the ONE drilled skill and
 * return the visible before→after gain. Scoped, not a full re-eval (RUBRIC D1).
 * The delta math is enforced by the grader inside CoachService.rescore.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildCoachService, scoringMode } from "@/infrastructure/composition";
import { resolveCall } from "@/lib/calls";
import { ScoringIntegrityError } from "@/domain/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({
  callId: z.string().min(1),
  skillId: z.number().int().optional(),
  drillTranscript: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid request" },
      { status: 400 },
    );
  }

  const { callId, skillId, drillTranscript } = parsed.data;
  const resolved = await resolveCall(callId);
  if (!resolved) {
    return NextResponse.json({ error: `unknown call ${callId}` }, { status: 404 });
  }

  const coach = buildCoachService();
  try {
    const moment = coach.fumbledMoment(resolved.evaluation, resolved.transcript, skillId);
    const rescore = await coach.rescore(drillTranscript, moment, resolved.evaluation);
    return NextResponse.json({ mode: scoringMode(), rescore });
  } catch (err) {
    if (err instanceof ScoringIntegrityError) {
      return NextResponse.json({ error: "rescore failed integrity check", issues: err.issues }, { status: 422 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "rescore failed" },
      { status: 500 },
    );
  }
}
