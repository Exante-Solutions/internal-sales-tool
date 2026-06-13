/**
 * SeededSessionGateway — the demo identity (Feature 3, SPEC §21). Returns a
 * stable seeded user/team so the whole app works with NO login; this is the
 * protected fallback that means a missing Auth0 tenant can never break the
 * demo. An Auth0SessionGateway drops in behind the same SessionGateway port
 * once AUTH0_* env is set — no other code changes.
 */

import type { SessionGateway } from "@/domain/ports";
import type { Session } from "@/domain/session";
import { SEEDED_SESSION as RAW } from "@auth-session";

export const SEEDED_SESSION: Session = RAW as Session;

export class SeededSessionGateway implements SessionGateway {
  async current(): Promise<Session> {
    return SEEDED_SESSION;
  }
}
