/**
 * /api/conversations/[id]/follow-ups (SPEC §10).
 *   POST  → create a structured follow-up (text + optional owner/due; source
 *           defaults to manual).
 *   PATCH → lifecycle transitions (SPEC §18.6): mark complete (`status:'done'`),
 *           archive (`archive:true` → archived_at set) or unarchive
 *           (`archive:false`). Archived follow-ups drop out of default lists.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import type { FollowUp } from "@/domain/followup";

export const runtime = "nodejs";

const Create = z.object({
  text: z.string().min(1),
  ownerPersonId: z.string().optional(),
  ownerUserId: z.string().optional(),
  dueOn: z.string().optional(),
  source: z.enum(["recorder", "ai", "manual"]).default("manual"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Create.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();
  const conversation = await svc.conversations.get(session.teamId, id);
  if (!conversation) return NextResponse.json({ error: "conversation not found" }, { status: 404 });

  const d = parsed.data;
  const followUp: FollowUp = {
    id: svc.ids.next(),
    conversationId: id,
    text: d.text,
    status: "open",
    source: d.source,
    ownerPersonId: d.ownerPersonId ?? null,
    ownerUserId: d.ownerUserId ?? null,
    dueOn: d.dueOn ?? null,
    createdAt: svc.clock.nowIso(),
  };
  await svc.followUps.save(followUp);
  return NextResponse.json({ followUp }, { status: 201 });
}

const Update = z
  .object({
    followUpId: z.string().min(1),
    // Complete/reopen via status; archive/unarchive via the archive flag. At
    // least one transition must be present.
    status: z.enum(["open", "done"]).optional(),
    archive: z.boolean().optional(),
  })
  .refine((d) => d.status !== undefined || d.archive !== undefined, {
    message: "provide a status and/or an archive transition",
  });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Update.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();
  const conversation = await svc.conversations.get(session.teamId, id);
  if (!conversation) return NextResponse.json({ error: "conversation not found" }, { status: 404 });

  const d = parsed.data;

  // IDOR guard (C4.3): the target follow-up must belong to THIS conversation.
  // Without this a client could change/archive follow-ups on other conversations
  // by reusing a known id. Include archived so unarchive transitions still match.
  const followUps = await svc.followUps.listForConversation(id, { includeArchived: true });
  if (!followUps.some((f) => f.id === d.followUpId)) {
    return NextResponse.json({ error: "follow-up not found" }, { status: 404 });
  }

  const patch: { status?: "open" | "done"; archivedAt?: string | null } = {};
  if (d.status !== undefined) patch.status = d.status;
  if (d.archive !== undefined) patch.archivedAt = d.archive ? svc.clock.nowIso() : null;

  await svc.followUps.update(d.followUpId, patch);
  return NextResponse.json({ ok: true, followUpId: d.followUpId, ...patch });
}
