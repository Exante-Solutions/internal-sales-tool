/**
 * /api/initiatives/[id] (SPEC §10, §4.2, §11).
 *   GET   → initiative detail: goal/hypothesis, linked conversations, the
 *           people view (targets ∪ engaged, each flagged targeted/engaged/both),
 *           and follow-ups across its linked conversations.
 *   PATCH → edit name/goal/hypothesis/type/status.
 *
 * The people view unions the explicit prospect list (targets) with the inferred
 * engaged people (anyone with a linked conversation), via the pure peopleView.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { INITIATIVE_TYPES, INITIATIVE_STATUSES } from "@/domain/initiative";
import { peopleView } from "../../../../../lib/initiative/people.mjs";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  const initiative = await svc.initiatives.get(session.teamId, id);
  if (!initiative) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [rawTargets, conversations, followUps] = await Promise.all([
    svc.initiatives.listTargets(id),
    svc.conversations.list(session.teamId, { initiativeId: id }),
    svc.followUps.listForInitiative(id),
  ]);

  // Engaged = people with a conversation linked to this initiative (inferred).
  const engagedIds = new Set<string>();
  for (const conv of conversations) {
    for (const part of conv.participants) engagedIds.add(part.personId);
  }

  // BUG_FIX B7: resolve every person in the union (targeted ∪ engaged) to a
  // display name so the UI renders names, not UUIDs. The targeted set is carried
  // into the union, so a targeted person with zero conversations still appears.
  const allPersonIds = new Set<string>([
    ...rawTargets.map((t) => t.personId),
    ...engagedIds,
  ]);
  const nameById = new Map<string, string>();
  await Promise.all(
    [...allPersonIds].map(async (personId) => {
      const person = await svc.people.get(session.teamId, personId);
      if (person) nameById.set(personId, person.primaryDisplayName);
    }),
  );

  const targets = rawTargets.map((t) => ({ ...t, personName: nameById.get(t.personId) ?? null }));
  const view = (
    peopleView({
      targets: rawTargets.map((t) => ({ personId: t.personId })),
      engaged: [...engagedIds].map((personId) => ({ personId })),
    }) as Array<{ personId: string; targeted: boolean; engaged: boolean }>
  ).map((row) => ({ ...row, personName: nameById.get(row.personId) ?? null }));

  // The UI reads `peopleView` (PeopleViewRow[]); emit under that key so the
  // initiative detail's union panel renders (BUG_FIX B7 cross-agent contract).
  return NextResponse.json({ initiative, targets, conversations, peopleView: view, followUps });
}

// Accepts the documented snake_case fields (SPEC §8.1) with camelCase aliases;
// snake_case wins when both are present.
const Patch = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(INITIATIVE_TYPES).optional(),
  goal_md: z.string().optional(),
  goalMd: z.string().optional(),
  hypothesis_md: z.string().optional(),
  hypothesisMd: z.string().optional(),
  status: z.enum(INITIATIVE_STATUSES).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Patch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();
  const initiative = await svc.initiatives.get(session.teamId, id);
  if (!initiative) return NextResponse.json({ error: "not found" }, { status: 404 });
  const d = parsed.data;
  await svc.initiatives.save({
    ...initiative,
    name: d.name ?? initiative.name,
    type: d.type ?? initiative.type,
    goalMd: d.goal_md ?? d.goalMd ?? initiative.goalMd,
    hypothesisMd: d.hypothesis_md ?? d.hypothesisMd ?? initiative.hypothesisMd,
    status: d.status ?? initiative.status,
  });
  const fresh = await svc.initiatives.get(session.teamId, id);
  return NextResponse.json({ initiative: fresh });
}

/**
 * DELETE → hard-delete the initiative (BUG_FIX B6, locked: hard delete +
 * confirm). Team-scoped: removes the initiative's targets + conversation links,
 * then the initiative row. Linked conversations are PRESERVED (only unlinked).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  const initiative = await svc.initiatives.get(session.teamId, id);
  if (!initiative) return NextResponse.json({ error: "not found" }, { status: 404 });
  await svc.initiatives.delete(session.teamId, id);
  return NextResponse.json({ ok: true });
}
