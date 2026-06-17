/**
 * POST /api/people/[id]/merge (SPEC §4.3, §10). Confirm a human-approved merge:
 * unify the absorbed person's identities, memberships, and history under the
 * survivor. The system NEVER silent-merges — this endpoint is the explicit
 * confirmation step. `[id]` is the survivor; the body names the absorbed person.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";

const Body = z.object({ absorbedId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: survivorId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  if (parsed.data.absorbedId === survivorId) {
    return NextResponse.json({ error: "cannot merge a person into itself" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();

  try {
    const result = await svc.resolveIdentity.confirmMerge(session, survivorId, parsed.data.absorbedId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && /not found/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "merge failed" }, { status: 500 });
  }
}
