/**
 * /api/initiatives/[id]/targets/[personId] (SPEC §10, §4.2).
 *   PATCH  → advance a target's outreach status / edit its reason.
 *   DELETE → remove the person from the prospect list.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { TARGET_STATUSES } from "@/domain/initiative";

export const runtime = "nodejs";

const Patch = z.object({
  status: z.enum(TARGET_STATUSES).optional(),
  reasonMd: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; personId: string }> },
) {
  const { id, personId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Patch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const d = parsed.data;
  if (d.status === undefined && d.reasonMd === undefined) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();
  const initiative = await svc.initiatives.get(session.teamId, id);
  if (!initiative) return NextResponse.json({ error: "initiative not found" }, { status: 404 });

  const targets = await svc.initiatives.listTargets(id);
  const target = targets.find((t) => t.personId === personId);
  if (!target) return NextResponse.json({ error: "target not found" }, { status: 404 });

  await svc.initiatives.setTargetStatus(id, personId, d.status ?? target.status, d.reasonMd);
  const fresh = (await svc.initiatives.listTargets(id)).find((t) => t.personId === personId);
  return NextResponse.json({ target: fresh });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; personId: string }> },
) {
  const { id, personId } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  const initiative = await svc.initiatives.get(session.teamId, id);
  if (!initiative) return NextResponse.json({ error: "initiative not found" }, { status: 404 });
  await svc.initiatives.removeTarget(id, personId);
  return NextResponse.json({ ok: true, initiativeId: id, personId });
}
