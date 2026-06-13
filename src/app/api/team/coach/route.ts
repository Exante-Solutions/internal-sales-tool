/**
 * GET /api/team/coach?callType=discovery — the agentic team coaching action
 * (Feature 4, SPEC §22). Opus synthesizes the coaching prose; the targets
 * (gap skill + who-needs-it) are deterministic (lib/team/*), so "assign a
 * drill" always points at the right skill. Offline = FakeTeamCoach.
 */

import { NextRequest, NextResponse } from "next/server";
import { teamStats } from "@/data/seed";
import { buildTeamCoach, scoringMode } from "@/infrastructure/composition";
import type { CallType } from "@/domain/rubric";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const ct = req.nextUrl.searchParams.get("callType");
  const callType: CallType = ct === "demo" ? "demo" : "discovery";

  try {
    const action = await buildTeamCoach().action(callType, teamStats(callType));
    return NextResponse.json({ mode: scoringMode(), action });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "team coach failed" },
      { status: 500 },
    );
  }
}
