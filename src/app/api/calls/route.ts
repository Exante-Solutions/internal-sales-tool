/**
 * /api/calls — live call ingestion (Feature 2, SPEC §20).
 *   GET  → the session user's uploaded calls (metas) + the seeded examples.
 *   POST → ingest {exampleId} OR {transcript, callType, ...meta} → score
 *          through the loop → persist as a user-owned call (CallStore).
 * Seeded examples are the reliable on-ramp; paste/upload is the real path.
 * Persists to Neon when DATABASE_URL is set, else the in-memory fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildCoachService,
  buildCallStore,
  buildSession,
  scoringMode,
  storageMode,
} from "@/infrastructure/composition";
import { buildTranscript } from "@/lib/ingest";
import { EXAMPLES, exampleById, exampleRaw } from "@/data/examples";
import { ScoringIntegrityError } from "@/domain/errors";
import type { StoredCall } from "@/domain/store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const session = await buildSession().current();
  const calls = await buildCallStore().list(session.userId);
  return NextResponse.json({
    mode: scoringMode(),
    storage: storageMode(),
    examples: EXAMPLES.map(({ id, label, callType, prospect, contact, contactRole }) => ({
      id,
      label,
      callType,
      prospect,
      contact,
      contactRole,
    })),
    calls: calls.map((c) => c.meta),
  });
}

const FromExample = z.object({ exampleId: z.string().min(1) });
const FromPaste = z.object({
  transcript: z.string().min(1),
  callType: z.enum(["discovery", "demo"]),
  prospect: z.string().min(1).default("Prospect"),
  contact: z.string().min(1).default("Contact"),
  contactRole: z.string().default(""),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const session = await buildSession().current();

  let raw: string;
  let callType: "discovery" | "demo";
  let prospect: string;
  let contact: string;
  let contactRole: string;

  const ex = FromExample.safeParse(body);
  if (ex.success) {
    const e = exampleById(ex.data.exampleId);
    if (!e) return NextResponse.json({ error: "unknown example" }, { status: 404 });
    raw = exampleRaw(e.file);
    ({ callType, prospect, contact, contactRole } = e);
  } else {
    const p = FromPaste.safeParse(body);
    if (!p.success) {
      return NextResponse.json({ error: p.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
    }
    ({ transcript: raw, callType, prospect, contact, contactRole } = p.data);
  }

  const callId = `up-${callType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const transcript = buildTranscript(raw, { callId, callType, prospect, contact, contactRole });

  const coach = buildCoachService();
  try {
    const evaluation = await coach.score(transcript);
    const call: StoredCall = {
      meta: {
        id: callId,
        repId: session.userId,
        callType,
        prospect,
        contact,
        contactRole,
        date: new Date().toISOString().slice(0, 10),
      },
      evaluation,
      transcript,
    };
    await buildCallStore().save(session.userId, call);
    return NextResponse.json({ mode: scoringMode(), call });
  } catch (err) {
    if (err instanceof ScoringIntegrityError) {
      return NextResponse.json({ error: "scoring failed integrity check", issues: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "ingest failed" }, { status: 500 });
  }
}
