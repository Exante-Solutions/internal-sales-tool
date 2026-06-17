/**
 * /api/initiatives (SPEC §10).
 *   GET  → list initiatives; filter by `?type=` / `?status=`.
 *   POST → create an initiative (goal/hypothesis/type/status).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { INITIATIVE_TYPES, INITIATIVE_STATUSES } from "@/domain/initiative";
import type { Initiative } from "@/domain/initiative";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await buildSession().current();
  const svc = getServices();
  const sp = req.nextUrl.searchParams;
  const initiatives = await svc.initiatives.list(session.teamId, {
    type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? undefined,
  });
  return NextResponse.json({ initiatives });
}

// Body uses the documented snake_case fields (SPEC §8.1: goal_md, hypothesis_md,
// status). camelCase aliases are also accepted so existing clients keep working;
// snake_case wins when both are present.
const Create = z.object({
  name: z.string().min(1),
  type: z.enum(INITIATIVE_TYPES),
  goal_md: z.string().optional(),
  goalMd: z.string().optional(),
  hypothesis_md: z.string().optional(),
  hypothesisMd: z.string().optional(),
  status: z.enum(INITIATIVE_STATUSES).optional(),
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
  const initiative: Initiative = {
    id: svc.ids.next(),
    teamId: session.teamId,
    name: d.name,
    type: d.type,
    goalMd: d.goal_md ?? d.goalMd ?? "",
    hypothesisMd: d.hypothesis_md ?? d.hypothesisMd ?? "",
    status: d.status ?? "active",
    createdBy: session.userId,
    createdAt: svc.clock.nowIso(),
  };
  await svc.initiatives.save(initiative);
  return NextResponse.json({ initiative }, { status: 201 });
}
