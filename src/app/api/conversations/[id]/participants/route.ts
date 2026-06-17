/**
 * POST /api/conversations/[id]/participants (BUG_FIX B2, SPEC §6.1, §10).
 *
 * Manually attach a Person to a conversation. The AddParticipant use case
 * snapshots `emailUsed` (the person's primary email) + `companyAtTime` +
 * `roleAtTime` from the person's membership current at conversation time, then
 * mints an idempotent participant row (UNIQUE(conversationId, personId)).
 *
 * Thin controller: Zod at the edge, call the composition-root use case, return
 * the new participant.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";

const Add = z.object({ personId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Add.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();
  try {
    const participant = await svc.addParticipant.add(session, id, parsed.data.personId);
    return NextResponse.json({ participant }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /not found/.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "add participant failed" },
      { status: 500 },
    );
  }
}
