/**
 * POST /api/conversations/[id]/analyze (BUG_FIX B3, SPEC §5.3, §6.5).
 *
 * The on-demand discovery analysis trigger — explicitly invoked from the
 * conversation detail's `run-discovery-analysis` control, never automatically.
 * Runs AnalyzeConversation (FakeAnalysisGateway offline / Anthropic when keyed),
 * which persists the analysis row AND seeds one open AI follow-up per
 * `nextSteps` entry. Returns the updated analysis + seeded follow-ups.
 *
 * Thin controller: resolve the session, call the composition-root use case,
 * return JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServices, buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  try {
    const result = await svc.analyzeConversation.analyze(session, id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && /not found/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "analyze failed" },
      { status: 500 },
    );
  }
}
