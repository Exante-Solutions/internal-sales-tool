/**
 * AnalyzeConversation use case (SPEC §5.3, §6.5; RUBRIC F6/G3).
 *
 * Produces the lightweight discovery fields (summary, what_we_learned[],
 * signals[], next_steps[], reason, outcome) for a conversation from whatever
 * text is available — a transcript OR manual notes. It does NOT run the
 * playbook/coaching rubric: that is the on-demand RunPlaybookCheck add-on
 * (SPEC §5.2). A manual conversation with no transcript still gets discovery
 * fields; it simply has no rubric score to skip (G3).
 *
 * The discovery `next_steps` are seeded as AI-sourced FollowUps (source=ai),
 * distinct from the recorder-sourced ones IngestRecording created.
 *
 * The vendor model output dies at the AnalysisGateway adapter; only the domain
 * Analysis crosses here. Imports domain only — no SDK, no framework, no ORM, no
 * validator.
 */

import type { Conversation } from "@/domain/conversation";
import type { Analysis } from "@/domain/analysis";
import type { FollowUp } from "@/domain/followup";
import type { Session } from "@/domain/session";
import type {
  AnalysisGateway,
  ConversationRepository,
  FollowUpRepository,
} from "@/domain/ports";
import type { IdGenerator, Clock } from "./support";

export interface AnalyzeResult {
  analysis: Analysis;
  /** FollowUps seeded from the discovery next_steps (source = ai). */
  followUps: FollowUp[];
  /** True when the conversation had no transcript (manual notes only) — the
   * playbook check is N/A here (G3); discovery fields are still produced. */
  manualOnly: boolean;
}

export class AnalyzeConversation {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly followUps: FollowUpRepository,
    private readonly analysisGateway: AnalysisGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async analyze(session: Session, conversationId: string): Promise<AnalyzeResult> {
    const conversation = await this.conversations.get(session.teamId, conversationId);
    if (!conversation) throw new Error(`conversation not found: ${conversationId}`);

    const manualOnly = conversation.segments.length === 0;

    // Run the discovery analysis over the available text (transcript or notes).
    const produced = await this.analysisGateway.analyzeConversation(conversation);

    const now = this.clock.nowIso();
    // Merge onto any existing analysis (e.g. the recorder summary stored on
    // ingest) without dropping it; never attach a coachingEvaluation here (G3).
    const existing = await this.conversations.getAnalysis(conversationId);
    const analysis: Analysis = {
      id: existing?.id ?? produced.id ?? this.ids.next(),
      conversationId,
      recorderSummaryMd: existing?.recorderSummaryMd ?? produced.recorderSummaryMd,
      recorderActionItems: existing?.recorderActionItems ?? produced.recorderActionItems ?? [],
      summaryMd: produced.summaryMd,
      sentiment: produced.sentiment,
      whatWeLearned: produced.whatWeLearned ?? [],
      signals: produced.signals ?? [],
      nextSteps: produced.nextSteps ?? [],
      reasonMd: produced.reasonMd ?? (conversation.reasonMd || undefined),
      outcomeMd: produced.outcomeMd ?? (conversation.outcomeMd || undefined),
      // Preserve a prior on-demand playbook score if one exists; never add one.
      coachingEvaluation: existing?.coachingEvaluation,
      createdAt: existing?.createdAt ?? now,
    };
    await this.conversations.saveAnalysis(analysis);

    // Seed AI follow-ups from the discovery next_steps (source = ai).
    const followUps: FollowUp[] = [];
    for (const text of analysis.nextSteps) {
      const followUp: FollowUp = {
        id: this.ids.next(),
        conversationId,
        text,
        status: "open",
        source: "ai",
        ownerPersonId: null,
        ownerUserId: null,
        dueOn: null,
        createdAt: now,
      };
      await this.followUps.save(followUp);
      followUps.push(followUp);
    }

    return { analysis, followUps, manualOnly };
  }
}
