/**
 * Ports — domain-owned interfaces. Infrastructure implements these; the
 * application layer depends only on them. The one genuinely volatile external
 * dependency (the Anthropic SDK) sits behind ScorerGateway / RescorerGateway /
 * DrillScenarioGateway. Swapping the real adapter for the fake changes only the
 * composition root — never domain/ or application/ (CLAUDE.md law 5).
 */

import type { Transcript, Evaluation, FumbledMoment, DrillScenario, Rescore } from "./coaching";

export interface ScorerGateway {
  /** Run the 4-pass eval (adversarial: score → refute → reconcile). */
  score(transcript: Transcript): Promise<Evaluation>;
}

export interface DrillScenarioGateway {
  /** Generate-and-filter a drill scenario from the fumbled moment. */
  scenario(moment: FumbledMoment, transcript: Transcript): Promise<DrillScenario>;
}

export interface RescorerGateway {
  /** Score the drill transcript on the single drilled item's 1–5 anchors. */
  rescore(
    drillTranscript: string,
    moment: FumbledMoment,
    callId: string,
  ): Promise<Rescore>;
}
