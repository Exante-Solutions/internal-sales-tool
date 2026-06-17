/**
 * Server-side call resolver (Feature 2/3). Looks a call up by id across the
 * seeded demo world AND the current user's uploaded calls (CallStore), so the
 * eval/drill/brief/rescore surfaces work identically for seeded and uploaded
 * calls. Seeded calls win first (always available — demo-safe). Server-only:
 * touches the CallStore + Session composition.
 */

import type { Evaluation, Transcript } from "@/domain/coaching";
import type { StoredCallMeta } from "@/domain/store";
import { EVALUATIONS, TRANSCRIPTS, callById } from "@/data/seed";
import { buildCallStore } from "@/infrastructure/composition";
import { requireSession } from "@/lib/require-session";

export interface ResolvedCall {
  meta: StoredCallMeta;
  evaluation: Evaluation;
  transcript: Transcript;
}

export async function resolveCall(callId: string): Promise<ResolvedCall | null> {
  const evaluation = EVALUATIONS[callId];
  const transcript = TRANSCRIPTS[callId];
  const meta = callById(callId);
  if (evaluation && transcript && meta) return { meta, evaluation, transcript };

  // Non-seeded (uploaded) call: needs the current user. Gate through
  // requireSession so a missing live-Auth0 session redirects to /auth/login
  // rather than 500ing the eval/drill page body. Seeded calls short-circuit
  // above and never reach here, so the demo path is untouched.
  const session = await requireSession();
  const stored = await buildCallStore().get(session.userId, callId);
  return stored ?? null;
}
