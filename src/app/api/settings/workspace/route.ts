/**
 * /api/settings/workspace (SPEC §9, §10, §18.2; RUBRIC Q6).
 *   PATCH { name } → rename the APP-MANAGED workspace; persists team.name via
 *   AppUserRepository.upsertTeamName(session.teamId, name) and returns { name }.
 *
 * The workspace name is owned by the app, not the IdP: this route is the source
 * of truth for renames, and Auth0 login provisioning never overwrites it. Zod
 * validates the body at the edge (non-empty, trimmed, max 80). Node runtime.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { DEFAULT_TEAM_ID } from "@/domain/tenancy";

export const runtime = "nodejs";

const Patch = z.object({
  name: z.string().trim().min(1, "name is required").max(80, "name is too long"),
});

export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await buildSession().current();
  } catch {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Patch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid request" },
      { status: 400 },
    );
  }

  const svc = getServices();
  const name = await svc.appUsers.upsertTeamName(
    session.teamId || DEFAULT_TEAM_ID,
    parsed.data.name,
  );

  return NextResponse.json({ name });
}
