/**
 * AnthropicRescorer — scores a drill transcript on the SINGLE drilled item's
 * 1–5 anchors (RescorerGateway). Returns the new score + a cited drill moment;
 * the delta math is computed here deterministically (not by the model) so it
 * always satisfies the grader's `(after-before)×weight÷5` invariant.
 */

import type { RescorerGateway } from "@/domain/ports";
import type { FumbledMoment, Rescore } from "@/domain/coaching";
import { callJson } from "./llm";

interface RawRescore {
  after_1_5: number;
  cite_quote: string;
  rationale: string;
}

export class AnthropicRescorer implements RescorerGateway {
  async rescore(drillTranscript: string, moment: FumbledMoment, callId: string): Promise<Rescore> {
    const raw = await callJson<RawRescore>({
      system: `You score a single sales skill from a practice-drill transcript, against one rubric item's anchors. Be evidence-bound; cite a real line from the drill.`,
      user: `SKILL: "${moment.skill}"
  5/5: ${moment.anchorHigh}
  1/5: ${moment.anchorLow}
The rep previously scored ${moment.before_1_5}/5 on this skill.

DRILL TRANSCRIPT:
${drillTranscript}

Score ONLY this skill 1–5 for the rep's drill performance. Return {"after_1_5":N,"cite_quote":"a verbatim line from the drill","rationale":"one line: what changed"}`,
    });

    const after = Math.max(1, Math.min(5, Math.round(raw.after_1_5)));
    const delta = ((after - moment.before_1_5) * moment.weight) / 5;

    return {
      call_id: callId,
      drilled_item_id: moment.rubric_item_id,
      skill: moment.skill,
      weight: moment.weight,
      before_1_5: moment.before_1_5,
      after_1_5: after,
      delta_points_100: delta,
      cite_quote: raw.cite_quote,
      rationale: raw.rationale,
    };
  }
}
