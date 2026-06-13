/**
 * Coaching use cases. Imports domain + the canonical grader only — no SDK, no
 * Next, no Zod (CLAUDE.md law 2). Orchestrates the gateways and enforces the
 * product invariants by re-validating every gateway result against the same
 * pure grader the fixture test uses, so a bad model output can never escape.
 */

import { validateEvaluation, validateRescore, selectWeakest, leverage } from "@scoring";
import type { GradeableEvaluation } from "@/domain/grading";
import type { Evaluation, Transcript, FumbledMoment, Rescore } from "@/domain/coaching";
import type { CoachBriefing, SkillGap } from "@/domain/briefing";
import type {
  ScorerGateway,
  RescorerGateway,
  DrillScenarioGateway,
  CoachBriefingGateway,
} from "@/domain/ports";
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
    private readonly briefing?: CoachBriefingGateway,
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

  /**
   * Build the fumbled moment for a drill target. Defaults to the rep's
   * highest-leverage item; pass `targetItemId` to drill a SPECIFIC item (e.g.
   * the team-wide gap a manager assigned), so the assigned skill is the one
   * practiced — not the rep's personal weakness (SPEC §22 / RUBRIC F4-2).
   */
  fumbledMoment(evaluation: Evaluation, transcript: Transcript, targetItemId?: number): FumbledMoment {
    const explicit =
      targetItemId != null ? evaluation.items.find((i) => i.rubric_item_id === targetItemId) : undefined;
    const weakest = explicit ?? (() => {
      const w = selectWeakest(evaluation.items);
      return w ? evaluation.items.find((i) => i.rubric_item_id === w.rubric_item_id) : undefined;
    })();
    if (!weakest) throw new ScoringIntegrityError(["no items to select a drill target from"]);

    const item = weakest;
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

  /** The rep's other weak items on this call type (context for the coach prep,
   * not the focus) — highest-leverage first, excluding the drilled item. */
  gaps(evaluation: Evaluation): SkillGap[] {
    const weakestId = selectWeakest(evaluation.items)?.rubric_item_id;
    return evaluation.items
      .filter((i) => i.rubric_item_id !== weakestId)
      .sort((a, b) => leverage(b) - leverage(a))
      .slice(0, 4)
      .map((i) => ({ skill: i.name, score_1_5: i.score_1_5, weight: i.weight }));
  }

  /** Coaching prep before the roleplay (Feature 1). */
  brief(moment: FumbledMoment, evaluation: Evaluation, transcript: Transcript): Promise<CoachBriefing> {
    if (!this.briefing) throw new ScoringIntegrityError(["no coach-briefing gateway wired"]);
    return this.briefing.brief(moment, this.gaps(evaluation), transcript);
  }

  /** The rep's single follow-up question to the coach. */
  answer(question: string, briefing: CoachBriefing, transcript: Transcript): Promise<string> {
    if (!this.briefing) throw new ScoringIntegrityError(["no coach-briefing gateway wired"]);
    return this.briefing.answer(question, briefing, transcript);
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
