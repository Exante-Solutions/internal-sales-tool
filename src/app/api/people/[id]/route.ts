/**
 * /api/people/[id] (SPEC §10, §4.4).
 *   GET   → the person profile: identities (emails), company memberships
 *           (current + history), the append-only timeline, the AI summary, and
 *           their email messages + follow-ups.
 *   PATCH → edit the primary display name, or add an email identity.
 *
 * Person.get follows soft-merge to the survivor; the timeline is the source of
 * truth, the summary a derived rollup.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { makeNormalizedEmail, InvalidEmailError } from "@/domain/person";
import type { EmailIdentity } from "@/domain/person";
import type { TimelineEntry } from "@/domain/profile";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  const person = await svc.people.get(session.teamId, id);
  if (!person) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [timeline, summary, emailMessages, followUps] = await Promise.all([
    svc.timeline.list("person", person.id),
    svc.timeline.getSummary("person", person.id),
    svc.emails.listForPerson(person.id),
    svc.followUps.listForPerson(person.id),
  ]);
  return NextResponse.json({
    person,
    memberships: person.memberships,
    // Identity rows (each carries `emailNormalized`); the UI renders these as EMAIL IDENTITIES (BF9).
    emails: person.emails,
    timeline,
    summary,
    // Synced email *messages* (EmailMessage[]); distinct from identity rows above (BF9).
    emailMessages,
    followUps,
  });
}

const Patch = z.object({
  primaryDisplayName: z.string().min(1).optional(),
  addEmail: z
    .object({
      email: z.string().email(),
      label: z.enum(["work", "personal", "former", "other"]).default("work"),
    })
    .optional(),
  /** A manual note appended to the person's append-only timeline (C5.2). */
  note: z.string().min(1).optional(),
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
  const person = await svc.people.get(session.teamId, id);
  if (!person) return NextResponse.json({ error: "not found" }, { status: 404 });
  const d = parsed.data;

  if (d.primaryDisplayName !== undefined) {
    await svc.people.save({ ...person, primaryDisplayName: d.primaryDisplayName });
  }

  if (d.addEmail) {
    let normalized;
    try {
      normalized = makeNormalizedEmail(d.addEmail.email);
    } catch (err) {
      if (err instanceof InvalidEmailError) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }
    const emailIdentity: EmailIdentity = {
      id: svc.ids.next(),
      personId: person.id,
      emailNormalized: normalized,
      label: d.addEmail.label,
      verified: false,
      source: "manual",
    };
    await svc.people.addEmail(person.id, emailIdentity);
  }

  if (d.note !== undefined) {
    // Append a manual note to the person's append-only timeline (C5.2). The
    // timeline is the profile source of truth; the summary is a derived rollup.
    const now = svc.clock.nowIso();
    const entry: TimelineEntry = {
      id: svc.ids.next(),
      subjectType: "person",
      subjectId: person.id,
      kind: "note",
      refId: null,
      occurredAt: now,
      bodyMd: d.note,
      createdBy: session.userId,
      createdAt: now,
    };
    await svc.timeline.append(entry);
  }

  const fresh = await svc.people.get(session.teamId, id);
  return NextResponse.json({ person: fresh });
}
