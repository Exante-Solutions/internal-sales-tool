/**
 * /api/settings/integrations/circleback (SPEC §6.8, §18.1).
 *   PUT    → save THIS user's own Circleback secret (+ optional non-secret config).
 *            The secret is written to the SecretStore; only the resulting ref is
 *            persisted in user_integration (no shared `.env` secret, §17).
 *   DELETE → clear the user's Circleback config (and its SecretStore secret).
 *
 * Per-user scope: `scopeKey = session.userId`, `kind = "circleback"`. Zod
 * validates the body at the edge; the route never echoes the stored secret back.
 * Node runtime (talks to AWS Secrets Manager via the SecretStore adapter).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { DEFAULT_TEAM_ID } from "@/domain/tenancy";

export const runtime = "nodejs";

const KIND = "circleback" as const;

const Put = z.object({
  /** The user's own Circleback API secret/key. Never returned to the client. */
  secret: z.string().min(1, "secret is required"),
  /** Optional non-secret config (e.g. workspace/account hints), free-form. */
  config: z.record(z.string(), z.unknown()).optional(),
});

/** Connecting an integration requires a session; mirror the Google-start guard. */
async function currentSession() {
  try {
    return await buildSession().current();
  } catch {
    return null;
  }
}

export async function PUT(req: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Put.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid request" },
      { status: 400 },
    );
  }

  const svc = getServices();
  const integration = await svc.integrations.set(session.userId, KIND, {
    secret: parsed.data.secret,
    config: parsed.data.config,
    scope: "user",
    teamId: session.teamId || DEFAULT_TEAM_ID,
  });

  // Never echo the secret back — only the connected-state shape.
  return NextResponse.json({
    ok: true,
    connected: true,
    kind: integration.kind,
    updatedAt: integration.updatedAt,
  });
}

export async function DELETE() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const svc = getServices();
  await svc.integrations.clear(session.userId, KIND);
  return NextResponse.json({ ok: true, connected: false, kind: KIND });
}
