/**
 * Deterministic, offline adapters — the demo's safety net (build these FIRST,
 * per CLAUDE.md). They return the seeded artifacts with no network and no key,
 * so the whole loop runs even if the venue WiFi dies or no ANTHROPIC_API_KEY
 * is set. Swapping these for the real Anthropic adapters changes only the
 * composition root.
 */

import type { ScorerGateway, RescorerGateway, DrillScenarioGateway } from "@/domain/ports";
import type { Transcript, FumbledMoment, DrillScenario, Rescore } from "@/domain/coaching";
import { EVALUATIONS, DRILL_SCENARIOS, RESCORES } from "@/data/seed";

export class FakeScorer implements ScorerGateway {
  async score(transcript: Transcript) {
    const seeded = EVALUATIONS[transcript.callId];
    if (!seeded) throw new Error(`no seeded evaluation for ${transcript.callId} (fake scorer)`);
    return seeded;
  }
}

export class FakeDrillScenario implements DrillScenarioGateway {
  async scenario(moment: FumbledMoment, transcript: Transcript): Promise<DrillScenario> {
    return (
      DRILL_SCENARIOS[transcript.callId] ?? {
        rubric_item_id: moment.rubric_item_id,
        skill: moment.skill,
        prospect_system_prompt: `Re-stage the moment where the rep should have nailed "${moment.skill}". Stay in character; concede when they hit: ${moment.anchorHigh}.`,
        opening_line: moment.prospect_line,
        recovery_condition: moment.anchorHigh,
      }
    );
  }
}

export class FakeRescorer implements RescorerGateway {
  async rescore(_drillTranscript: string, moment: FumbledMoment, callId: string): Promise<Rescore> {
    const seeded = RESCORES[callId];
    if (seeded && seeded.drilled_item_id === moment.rubric_item_id) return seeded;
    // Generic positive-gain fallback so the loop always shows a delta.
    const after = Math.min(5, moment.before_1_5 + 2);
    return {
      call_id: callId,
      drilled_item_id: moment.rubric_item_id,
      skill: moment.skill,
      weight: moment.weight,
      before_1_5: moment.before_1_5,
      after_1_5: after,
      delta_points_100: ((after - moment.before_1_5) * moment.weight) / 5,
      cite_quote: "(simulated drill) the rep pushed until a number surfaced",
      rationale: "Simulated drill recovery — replace with a live ElevenLabs drill once keys are set.",
    };
  }
}
