/**
 * DELETE /api/conversations/[id]/participants/[personId] (BUG_FIX B2, SPEC §10).
 *
 * Detach a manually-added person from a conversation. Idempotent: removing a
 * person who isn't a participant is a no-op. Thin controller — resolve the
 * session, guard the conversation belongs to the team, call the repo.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServices, buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; personId: string }> },
) {
  const { id, personId } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  const conversation = await svc.conversations.get(session.teamId, id);
  if (!conversation) return NextResponse.json({ error: "not found" }, { status: 404 });
  await svc.conversations.removeParticipant(id, personId);
  return NextResponse.json({ ok: true });
}
