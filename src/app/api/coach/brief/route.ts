/**
 * POST /api/coach/brief — the coach-prep endpoint (Feature 1, SPEC §19).
 * Without {question}: returns the sales-leader briefing for a call's drill
 * target. With {question, briefing}: returns the coach's single follow-up
 * answer. Resolves seeded OR uploaded calls. Live = Opus; offline = the
 * deterministic Fake briefing, so the coach→roleplay flow runs with no key.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildCoachService, scoringMode } from "@/infrastructure/composition";
import { resolveCall } from "@/lib/calls";
import { ScoringIntegrityError } from "@/domain/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const BriefingShape = z.object({
  skill: z.string(),
  situation: z.string(),
  the_move: z.string(),
  sample_line: z.string(),
  opener: z.string(),
});

const Schema = z.object({
  callId: z.string().min(1),
  skillId: z.number().int().optional(),
  question: z.string().min(1).optional(),
  briefing: BriefingShape.optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const { callId, skillId, question, briefing } = parsed.data;

  const resolved = await resolveCall(callId);
  if (!resolved) return NextResponse.json({ error: `unknown call ${callId}` }, { status: 404 });

  const coach = buildCoachService();
  try {
    if (question && briefing) {
      const answer = await coach.answer(question, briefing, resolved.transcript);
      return NextResponse.json({ mode: scoringMode(), answer });
    }
    const moment = coach.fumbledMoment(resolved.evaluation, resolved.transcript, skillId);
    const result = await coach.brief(moment, resolved.evaluation, resolved.transcript);
    return NextResponse.json({ mode: scoringMode(), briefing: result });
  } catch (err) {
    if (err instanceof ScoringIntegrityError) {
      return NextResponse.json({ error: "coach prep failed integrity check", issues: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "coach prep failed" }, { status: 500 });
  }
}
