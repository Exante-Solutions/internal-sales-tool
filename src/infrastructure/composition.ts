/**
 * Composition root — the ONE place concrete adapters are chosen (CLAUDE.md law
 * 6). With ANTHROPIC_API_KEY set, the real Opus 4.8 adapters run; without it,
 * the deterministic fakes keep the whole loop alive offline. Storage chooses
 * Neon when DATABASE_URL is set, else an in-memory store; the session is the
 * seeded team until an Auth0 adapter is wired (Feature 3). Grep an adapter's
 * class name → it appears only in its own file and here.
 */

import { CoachService } from "@/application/coach-service";
import { AnthropicScorer } from "./anthropic-scorer";
import { AnthropicDrillScenario } from "./anthropic-drill-scenario";
import { AnthropicRescorer } from "./anthropic-rescorer";
import { AnthropicCoachBriefing } from "./anthropic-coach-briefing";
import { AnthropicTeamCoach } from "./anthropic-team-coach";
import {
  FakeScorer,
  FakeDrillScenario,
  FakeRescorer,
  FakeCoachBriefing,
  FakeTeamCoach,
} from "./fake-adapters";
import { NeonCallStore } from "./neon-call-store";
import { MemoryCallStore } from "./memory-call-store";
import { SeededSessionGateway } from "./seeded-session";
import { authMode as authModeFor } from "@auth-session";
import type { CallStore, SessionGateway, TeamCoachGateway } from "@/domain/ports";

export type ScoringMode = "live" | "seeded";
export type StorageMode = "neon" | "memory";
export type AuthMode = "auth0" | "seeded";

export function scoringMode(): ScoringMode {
  return process.env.ANTHROPIC_API_KEY ? "live" : "seeded";
}

/** Neon when DATABASE_URL is set, else the in-memory fallback (Feature 2). */
export function storageMode(): StorageMode {
  return process.env.DATABASE_URL ? "neon" : "memory";
}

/** "auth0" only when a tenant is configured; "seeded" otherwise — the demo
 * fallback that means a missing login can never break the app (Feature 3). */
export function authMode(): AuthMode {
  return authModeFor(process.env) as AuthMode;
}

export function buildCoachService(mode: ScoringMode = scoringMode()): CoachService {
  if (mode === "live") {
    return new CoachService(
      new AnthropicScorer(),
      new AnthropicDrillScenario(),
      new AnthropicRescorer(),
      new AnthropicCoachBriefing(),
    );
  }
  return new CoachService(
    new FakeScorer(),
    new FakeDrillScenario(),
    new FakeRescorer(),
    new FakeCoachBriefing(),
  );
}

/** Seeded service for views that should never hit the network (progress/team). */
export function seededCoachService(): CoachService {
  return buildCoachService("seeded");
}

export function buildCallStore(): CallStore {
  return storageMode() === "neon" ? new NeonCallStore() : new MemoryCallStore();
}

/** Seeded session today; an Auth0SessionGateway drops in behind this port once
 * AUTH0_* is set (not built this batch — see SPEC §21). */
export function buildSession(): SessionGateway {
  return new SeededSessionGateway();
}

export function buildTeamCoach(mode: ScoringMode = scoringMode()): TeamCoachGateway {
  return mode === "live" ? new AnthropicTeamCoach() : new FakeTeamCoach();
}
