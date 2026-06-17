/**
 * POST /api/conversations/[id]/playbook-check (SPEC §5.2, §10). The on-demand
 * coaching add-on: explicitly triggered (never on ingest) reused 4-pass
 * adversarial rubric eval producing a citation-grounded CoachingEvaluation. A
 * manual conversation with no transcript is rejected (nothing to ground
 * citations against). The caller chooses the rubric (discovery/demo).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession, scoringMode } from "@/infrastructure/composition";
import { ScoringIntegrityError, TranscriptError } from "@/domain/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  callType: z.enum(["discovery", "demo"]).default("discovery"),
  prospect: z.string().default("Prospect"),
  contact: z.string().default("Contact"),
  contactRole: z.string().default(""),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const d = parsed.data;
  const session = await buildSession().current();
  const svc = getServices();

  try {
    const result = await svc.runPlaybookCheck.run(session, id, d.callType, {
      prospect: d.prospect,
      contact: d.contact,
      contactRole: d.contactRole,
    });
    return NextResponse.json({ mode: scoringMode(), ...result });
  } catch (err) {
    if (err instanceof TranscriptError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof ScoringIntegrityError) {
      return NextResponse.json({ error: "scoring failed integrity check", issues: err.issues }, { status: 422 });
    }
    if (err instanceof Error && /not found/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "playbook check failed" }, { status: 500 });
  }
}
