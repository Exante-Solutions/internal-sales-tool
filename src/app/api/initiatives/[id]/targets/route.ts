/**
 * /api/initiatives/[id]/targets (SPEC §10, §4.2). The prospect list — explicit
 * Person↔Initiative links added before (or independent of) any conversation.
 *   GET  → list targets (with outreach status + reason).
 *   POST → add a target by `personId`, OR create a Person inline (`displayName`
 *          + `email`) and target them in one call. UNIQUE(initiative, person).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { TARGET_STATUSES } from "@/domain/initiative";
import { makeNormalizedEmail, InvalidEmailError } from "@/domain/person";
import type { InitiativeTarget } from "@/domain/initiative";
import type { Person, EmailIdentity } from "@/domain/person";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  const initiative = await svc.initiatives.get(session.teamId, id);
  if (!initiative) return NextResponse.json({ error: "not found" }, { status: 404 });
  const rawTargets = await svc.initiatives.listTargets(id);
  // BUG_FIX B7: join person_id → primaryDisplayName so each TargetView carries a
  // name, not a UUID.
  const targets = await Promise.all(
    rawTargets.map(async (t) => {
      const person = await svc.people.get(session.teamId, t.personId);
      return { ...t, personName: person?.primaryDisplayName ?? null };
    }),
  );
  return NextResponse.json({ targets });
}

const Add = z
  .object({
    personId: z.string().min(1).optional(),
    displayName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    status: z.enum(TARGET_STATUSES).default("to_contact"),
    reasonMd: z.string().optional(),
  })
  .refine((d) => d.personId || (d.displayName && d.email), {
    message: "provide a personId, or displayName + email to create a person inline",
  });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Add.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();
  const initiative = await svc.initiatives.get(session.teamId, id);
  if (!initiative) return NextResponse.json({ error: "initiative not found" }, { status: 404 });
  const d = parsed.data;

  let personId = d.personId;
  if (!personId) {
    // Create the Person inline (new prospect added to the list, §10).
    let normalized;
    try {
      normalized = makeNormalizedEmail(d.email!);
    } catch (err) {
      if (err instanceof InvalidEmailError) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }
    const existing = await svc.people.findByEmail(session.teamId, normalized as string);
    if (existing) {
      personId = existing.id;
    } else {
      const newId = svc.ids.next();
      const emailIdentity: EmailIdentity = {
        id: svc.ids.next(),
        personId: newId,
        emailNormalized: normalized,
        label: "work",
        verified: false,
        source: "manual",
      };
      const person: Person = {
        id: newId,
        teamId: session.teamId,
        primaryDisplayName: d.displayName!,
        emails: [emailIdentity],
        memberships: [],
        createdBy: session.userId,
        createdAt: svc.clock.nowIso(),
        mergedIntoId: null,
      };
      await svc.people.save(person);
      personId = newId;
    }
  } else {
    const person = await svc.people.get(session.teamId, personId);
    if (!person) return NextResponse.json({ error: "person not found" }, { status: 404 });
    personId = person.id;
  }

  const target: InitiativeTarget = {
    id: svc.ids.next(),
    initiativeId: id,
    personId,
    status: d.status,
    reasonMd: d.reasonMd,
    addedBy: session.userId,
    createdAt: svc.clock.nowIso(),
  };
  await svc.initiatives.addTarget(target);
  return NextResponse.json({ target }, { status: 201 });
}
