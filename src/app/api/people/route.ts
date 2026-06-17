/**
 * /api/people (SPEC §10).
 *   GET  → list/search people; filter by `?companyId=`, `?email=`,
 *          `?initiativeId=`, or free-text `?q=`.
 *   POST → create a person with one initial email identity (the join key).
 *
 * Person is the root entity; "company view" / "email view" are filters over
 * people, not a hierarchy. Thin controller, Zod at the edge.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { makeNormalizedEmail, InvalidEmailError } from "@/domain/person";
import type { Person, EmailIdentity } from "@/domain/person";
import type { Company, CompanyMembership } from "@/domain/company";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await buildSession().current();
  const svc = getServices();
  const sp = req.nextUrl.searchParams;
  const people = await svc.people.list(session.teamId, {
    companyId: sp.get("companyId") ?? undefined,
    email: sp.get("email") ?? undefined,
    initiativeId: sp.get("initiativeId") ?? undefined,
    query: sp.get("q") ?? undefined,
  });
  return NextResponse.json({ people });
}

const Create = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  label: z.enum(["work", "personal", "former", "other"]).default("work"),
  /** Optional company the new person currently belongs to (the /people/new form
   * sends this). Find-or-created for the team, then attached as a current
   * membership below (SPEC §3, §8.1). */
  company: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Create.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const session = await buildSession().current();
  const svc = getServices();
  const d = parsed.data;

  let normalized;
  try {
    normalized = makeNormalizedEmail(d.email);
  } catch (err) {
    if (err instanceof InvalidEmailError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  // Dedup at the edge: an existing owner of this email is returned, not duplicated.
  const existing = await svc.people.findByEmail(session.teamId, normalized as string);
  if (existing) return NextResponse.json({ person: existing, created: false });

  const personId = svc.ids.next();
  const emailIdentity: EmailIdentity = {
    id: svc.ids.next(),
    personId,
    emailNormalized: normalized,
    label: d.label,
    verified: false,
    source: "manual",
  };
  const person: Person = {
    id: personId,
    teamId: session.teamId,
    primaryDisplayName: d.displayName,
    emails: [emailIdentity],
    memberships: [],
    createdBy: session.userId,
    createdAt: svc.clock.nowIso(),
    mergedIntoId: null,
  };
  await svc.people.save(person);

  // Optional company: find-or-create it for the team (case-insensitive by name,
  // since there's no email domain here), then attach the new person as a CURRENT
  // membership so "company view" filters surface them (SPEC §3, §8.1).
  if (d.company) {
    const wanted = d.company.toLowerCase();
    const companies = await svc.companies.list(session.teamId);
    let company: Company | undefined = companies.find(
      (c) => c.name.trim().toLowerCase() === wanted,
    );
    if (!company) {
      company = {
        id: svc.ids.next(),
        teamId: session.teamId,
        name: d.company,
        createdAt: svc.clock.nowIso(),
      };
      await svc.companies.save(company);
    }
    const membership: CompanyMembership = {
      id: svc.ids.next(),
      personId,
      companyId: company.id,
      isCurrent: true,
      startedOn: null,
      endedOn: null,
    };
    await svc.companies.saveMembership(membership);
    person.memberships = [membership];
  }

  return NextResponse.json({ person, created: true }, { status: 201 });
}
