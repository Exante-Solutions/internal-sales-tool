/**
 * Coaching use cases. Imports domain + the canonical grader only — no SDK, no
 * Next, no Zod (CLAUDE.md law 2). Orchestrates the gateways and enforces the
 * product invariants by re-validating every gateway result against the same
 * pure grader the fixture test uses, so a bad model output can never escape.
 */

import { validateEvaluation, validateRescore, selectWeakest } from "@scoring";
import type { GradeableEvaluation } from "@/domain/grading";
import type { Evaluation, Transcript, FumbledMoment, Rescore } from "@/domain/coaching";
import type { ScorerGateway, RescorerGateway, DrillScenarioGateway } from "@/domain/ports";
import { rubricFor } from "@/domain/rubric";
import { ScoringIntegrityError } from "@/domain/errors";

function toGradeable(ev: Evaluation): GradeableEvaluation {
  return {
    score_100: ev.score_100,
    band: ev.band,
    weakest_item_id: ev.weakest_item_id,
    items: ev.items.map((i) => ({
      rubric_item_id: i.rubric_item_id,
      name: i.name,
      weight: i.weight,
      score_1_5: i.score_1_5,
      cite_ts_seconds: i.cite_ts_seconds,
      cite_quote: i.cite_quote,
    })),
  };
}

export class CoachService {
  constructor(
    private readonly scorer: ScorerGateway,
    private readonly drillScenario: DrillScenarioGateway,
    private readonly rescorer: RescorerGateway,
  ) {}

  /** Score a transcript and refuse to return anything the grader rejects. */
  async score(transcript: Transcript): Promise<Evaluation> {
    const evaluation = await this.scorer.score(transcript);
    const { ok, errors } = validateEvaluation(toGradeable(evaluation), {
      segments: transcript.segments,
    });
    if (!ok) {
      throw new ScoringIntegrityError(errors);
    }
    return evaluation;
  }

  /** Build the fumbled moment for the highest-leverage item (the drill target). */
  fumbledMoment(evaluation: Evaluation, transcript: Transcript): FumbledMoment {
    const weakest = selectWeakest(evaluation.items);
    if (!weakest) throw new ScoringIntegrityError(["no items to select a weakest from"]);

    const item = evaluation.items.find((i) => i.rubric_item_id === weakest.rubric_item_id)!;
    const rubricItem = rubricFor(transcript.callType).items.find((r) => r.id === item.rubric_item_id)!;

    const idx = transcript.segments.findIndex((s) => s.ts === item.cite_ts_seconds);
    const repLine =
      [...transcript.segments].slice(0, idx + 1).reverse().find((s) => /rep/i.test(s.speaker))?.text ??
      transcript.segments[idx]?.text ??
      "";
    const prospectLine =
      transcript.segments.slice(idx).find((s) => /prospect|buyer/i.test(s.speaker))?.text ??
      transcript.segments[idx]?.text ??
      "";

    return {
      rubric_item_id: item.rubric_item_id,
      skill: item.name,
      weight: item.weight,
      before_1_5: item.score_1_5,
      anchorLow: rubricItem.anchorLow,
      anchorHigh: rubricItem.anchorHigh,
      cite_ts_seconds: item.cite_ts_seconds,
      rep_line: repLine,
      prospect_line: prospectLine,
    };
  }

  scenario(moment: FumbledMoment, transcript: Transcript) {
    return this.drillScenario.scenario(moment, transcript);
  }

  /** Re-score a drill transcript on the one drilled item; verify the delta math. */
  async rescore(
    drillTranscript: string,
    moment: FumbledMoment,
    originalEvaluation: Evaluation,
  ): Promise<Rescore> {
    const result = await this.rescorer.rescore(drillTranscript, moment, originalEvaluation.call_id);
    const { ok, errors } = validateRescore(
      {
        drilled_item_id: result.drilled_item_id,
        before_1_5: result.before_1_5,
        after_1_5: result.after_1_5,
        weight: result.weight,
        delta_points_100: result.delta_points_100,
      },
      { items: originalEvaluation.items },
    );
    if (!ok) throw new ScoringIntegrityError(errors);
    return result;
  }
}
