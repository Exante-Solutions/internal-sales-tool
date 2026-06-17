/**
 * /api/companies/[id] (SPEC §10, §4.4). A Company is an aggregation lens over
 * people, not a hierarchy.
 *   GET   → company profile: its current + past members (via memberships), the
 *           company timeline, and the AI summary.
 *   PATCH → edit name/domain.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  const company = await svc.companies.get(session.teamId, id);
  if (!company) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [memberships, members, timeline, summary] = await Promise.all([
    svc.companies.membershipsFor(id),
    svc.people.list(session.teamId, { companyId: id }),
    svc.timeline.list("company", id),
    svc.timeline.getSummary("company", id),
  ]);
  return NextResponse.json({ company, memberships, members, timeline, summary });
}

const Patch = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().optional(),
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
  const company = await svc.companies.get(session.teamId, id);
  if (!company) return NextResponse.json({ error: "not found" }, { status: 404 });
  const d = parsed.data;
  await svc.companies.save({
    ...company,
    name: d.name ?? company.name,
    domain: d.domain ?? company.domain,
  });
  const fresh = await svc.companies.get(session.teamId, id);
  return NextResponse.json({ company: fresh });
}
