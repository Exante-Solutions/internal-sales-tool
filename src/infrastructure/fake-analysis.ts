/**
 * FakeAnalysisGateway — deterministic, offline AnalysisGateway (SPEC §5.3,
 * §6.5). Produces the discovery fields for a conversation and the profile AI
 * rollup with NO network and NO key, so analyze-conversation / regenerate-profile
 * run offline (CLAUDE.md law 7). It derives everything from the conversation's
 * own text and the timeline it is handed — never inventing un-grounded facts.
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import type { AnalysisGateway } from "@/domain/ports";
import type { Conversation } from "@/domain/conversation";
import type { Analysis } from "@/domain/analysis";
import type { TimelineEntry, ProfileSummary, SubjectType } from "@/domain/profile";

export class FakeAnalysisGateway implements AnalysisGateway {
  async analyzeConversation(conversation: Conversation): Promise<Analysis> {
    const segs = conversation.segments;
    const text = segs.map((s) => s.text).join(" ");
    const firstSeg = segs[0];

    // Deterministic discovery fields derived from the available text. Manual
    // (no-transcript) conversations fall back to the conversation's own notes.
    const summaryMd =
      conversation.outcomeMd?.trim() ||
      (segs.length
        ? `Offline discovery summary of "${conversation.title}" (${segs.length} segments).`
        : `Offline discovery summary of "${conversation.title}" (manual notes, no transcript).`);

    return {
      id: `analysis-${conversation.id}`,
      conversationId: conversation.id,
      recorderActionItems: [],
      summaryMd,
      sentiment: "neutral",
      whatWeLearned: segs.slice(0, 3).map((s) => ({
        text: `From the call: "${s.text.slice(0, 80)}"`,
        cite_ts_seconds: s.ts,
      })),
      signals: text
        ? [
            {
              text: "Offline estimate: an actionable signal was present — set ANTHROPIC_API_KEY for a real analysis.",
              kind: "timing",
              cite_ts_seconds: firstSeg?.ts ?? 0,
            },
          ]
        : [],
      nextSteps: segs.length
        ? ["Follow up to quantify the pain mentioned on the call (offline estimate)."]
        : ["Capture more detail on this manually-logged conversation (offline estimate)."],
      reasonMd: conversation.reasonMd || undefined,
      outcomeMd: conversation.outcomeMd || undefined,
      createdAt: conversation.createdAt,
    };
  }

  async summarizeProfile(
    subjectType: SubjectType,
    subjectId: string,
    timeline: TimelineEntry[],
  ): Promise<ProfileSummary> {
    const lines = timeline
      .map((e) => `- ${e.occurredAt} (${e.kind}): ${e.bodyMd.slice(0, 80)}`)
      .join("\n");
    return {
      id: `summary-${subjectType}-${subjectId}`,
      subjectType,
      subjectId,
      summaryMd:
        `Offline ${subjectType} rollup (no ANTHROPIC_API_KEY) over ${timeline.length} timeline ` +
        `entr${timeline.length === 1 ? "y" : "ies"}:\n${lines || "- (no history yet)"}`,
      generatedAt: timeline[timeline.length - 1]?.createdAt ?? "1970-01-01T00:00:00Z",
      sourceEntryCount: timeline.length,
    };
  }
}
