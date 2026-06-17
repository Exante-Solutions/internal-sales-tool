/**
 * /api/conversations/[id]/initiatives (SPEC §10, §6.2). Link/unlink (move) a
 * conversation to/from an initiative — the many-to-many join. Linking moves no
 * data; a conversation can belong to several initiatives at once.
 *   POST   → link { initiativeId }
 *   DELETE → unlink { initiativeId }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";

const Body = z.object({ initiativeId: z.string().min(1) });

async function resolve(
  req: NextRequest,
  id: string,
): Promise<{ teamId: string; initiativeId: string } | NextResponse> {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();
  const conversation = await svc.conversations.get(session.teamId, id);
  if (!conversation) return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  const initiative = await svc.initiatives.get(session.teamId, parsed.data.initiativeId);
  if (!initiative) return NextResponse.json({ error: "initiative not found" }, { status: 404 });
  return { teamId: session.teamId, initiativeId: parsed.data.initiativeId };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await resolve(req, id);
  if (r instanceof NextResponse) return r;
  await getServices().conversations.linkInitiative(id, r.initiativeId);
  return NextResponse.json({ ok: true, conversationId: id, initiativeId: r.initiativeId });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await resolve(req, id);
  if (r instanceof NextResponse) return r;
  await getServices().conversations.unlinkInitiative(id, r.initiativeId);
  return NextResponse.json({ ok: true, conversationId: id, initiativeId: r.initiativeId });
}
