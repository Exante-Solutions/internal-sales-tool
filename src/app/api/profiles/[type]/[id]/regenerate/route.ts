/**
 * POST /api/profiles/[type]/[id]/regenerate (SPEC §4.4, §10). Regenerate the AI
 * rollup over a Person/Company's append-only timeline. Reads the timeline and
 * writes ONLY the derived ProfileSummary — the timeline is never mutated.
 * `[type]` ∈ {person, company}.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServices, buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (type !== "person" && type !== "company") {
    return NextResponse.json({ error: "type must be 'person' or 'company'" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();

  // Team-scope guard: the subject must belong to the workspace.
  const subject =
    type === "person"
      ? await svc.people.get(session.teamId, id)
      : await svc.companies.get(session.teamId, id);
  if (!subject) return NextResponse.json({ error: "subject not found" }, { status: 404 });

  try {
    const summary = await svc.regenerateProfile.regenerate(type, id);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "regenerate failed" }, { status: 500 });
  }
}
