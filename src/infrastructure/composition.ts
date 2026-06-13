/**
 * Composition root — the ONE place concrete adapters are chosen (CLAUDE.md law
 * 6). With ANTHROPIC_API_KEY set, the real Opus 4.8 adversarial adapters run;
 * without it, the deterministic fakes keep the whole loop alive offline.
 * Grep an adapter's class name → it appears only in its own file and here.
 */

import { CoachService } from "@/application/coach-service";
import { AnthropicScorer } from "./anthropic-scorer";
import { AnthropicDrillScenario } from "./anthropic-drill-scenario";
import { AnthropicRescorer } from "./anthropic-rescorer";
import { FakeScorer, FakeDrillScenario, FakeRescorer } from "./fake-adapters";

export type ScoringMode = "live" | "seeded";

export function scoringMode(): ScoringMode {
  return process.env.ANTHROPIC_API_KEY ? "live" : "seeded";
}

export function buildCoachService(mode: ScoringMode = scoringMode()): CoachService {
  if (mode === "live") {
    return new CoachService(new AnthropicScorer(), new AnthropicDrillScenario(), new AnthropicRescorer());
  }
  return new CoachService(new FakeScorer(), new FakeDrillScenario(), new FakeRescorer());
}

/** Seeded service for views that should never hit the network (progress/team). */
export function seededCoachService(): CoachService {
  return buildCoachService("seeded");
}
