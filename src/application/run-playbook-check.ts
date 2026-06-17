/**
 * RunPlaybookCheck use case (SPEC §5.2, §6.5; RUBRIC H1-H4, H3).
 *
 * The on-demand coaching add-on: the reused 4-pass adversarial rubric eval
 * (ScorerGateway) producing a citation-grounded CoachingEvaluation (score /100,
 * per-item 1-5 with cited timestamps). It is triggered EXPLICITLY by the user
 * ("Run playbook check") — it does NOT run on ingest (RUBRIC H1). A manual
 * conversation with no transcript cannot be scored, so it is rejected up front
 * (G3/H4): there is nothing to ground citations against.
 *
 * Every gateway result is re-validated against the same pure grader the fixture
 * test uses (lib/scoring/grade.mjs), so a bad model output can never escape
 * (citation-grounded, H3). The deterministic gap is the highest-leverage item,
 * selected by the same pure selectWeakest the coaching loop uses (H2).
 *
 * The vendor Message dies at the ScorerGateway adapter; only the domain
 * Evaluation crosses here. Imports domain + the canonical grader only — no SDK,
 * no framework, no ORM, no validator.
 */

import { validateEvaluation, selectWeakest } from "@scoring";
import type { GradeableEvaluation } from "@/domain/grading";
import type { Transcript, Evaluation } from "@/domain/coaching";
import type { CallType } from "@/domain/rubric";
import type { Analysis } from "@/domain/analysis";
import type { Conversation } from "@/domain/conversation";
import type { Session } from "@/domain/session";
import type { ScorerGateway, ConversationRepository } from "@/domain/ports";
import { ScoringIntegrityError, TranscriptError } from "@/domain/errors";
import type { IdGenerator, Clock } from "./support";

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

/** The single highest-leverage gap selected from the eval (deterministic, H2). */
export interface SelectedGap {
  rubric_item_id: number;
  skill: string;
  weight: number;
  score_1_5: number;
}

export interface PlaybookResult {
  evaluation: Evaluation;
  gap: SelectedGap;
  analysis: Analysis;
}

export class RunPlaybookCheck {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly scorer: ScorerGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /**
   * @param callType which rubric to grade against (discovery/demo). The caller
   *   chooses it explicitly — discovery is not assumed.
   * @param meta the prospect/contact framing for the transcript.
   */
  async run(
    session: Session,
    conversationId: string,
    callType: CallType,
    meta: { prospect: string; contact: string; contactRole: string },
  ): Promise<PlaybookResult> {
    const conversation = await this.conversations.get(session.teamId, conversationId);
    if (!conversation) throw new Error(`conversation not found: ${conversationId}`);

    // No transcript → nothing to ground citations against (G3/H4).
    if (conversation.segments.length === 0) {
      throw new TranscriptError(
        "playbook check requires a transcript; this conversation has manual notes only",
      );
    }

    const transcript: Transcript = {
      callId: conversation.id,
      callType,
      prospect: meta.prospect,
      contact: meta.contact,
      contactRole: meta.contactRole,
      segments: conversation.segments,
    };

    // Reused 4-pass adversarial scorer; vendor Message dies at the adapter.
    const evaluation = await this.scorer.score(transcript);

    // Re-validate against the canonical grader — bad output can't escape (H3).
    const { ok, errors } = validateEvaluation(toGradeable(evaluation), {
      segments: transcript.segments,
    });
    if (!ok) throw new ScoringIntegrityError(errors);

    // Deterministic gap = highest-leverage item (same pure selector, H2).
    const weakest = selectWeakest(evaluation.items);
    const item = weakest
      ? evaluation.items.find((i) => i.rubric_item_id === weakest.rubric_item_id)
      : undefined;
    if (!item) throw new ScoringIntegrityError(["no items to select a gap from"]);
    const gap: SelectedGap = {
      rubric_item_id: item.rubric_item_id,
      skill: item.name,
      weight: item.weight,
      score_1_5: item.score_1_5,
    };

    // Persist the on-demand scorecard onto the conversation's analysis, leaving
    // the rest of the discovery fields intact (the playbook check is additive).
    const existing = await this.conversations.getAnalysis(conversationId);
    const now = this.clock.nowIso();
    const analysis: Analysis = existing
      ? { ...existing, coachingEvaluation: evaluation }
      : {
          id: this.ids.next(),
          conversationId,
          recorderActionItems: [],
          whatWeLearned: [],
          signals: [],
          nextSteps: [],
          coachingEvaluation: evaluation,
          createdAt: now,
        };
    await this.conversations.saveAnalysis(analysis);

    return { evaluation, gap, analysis };
  }
}
