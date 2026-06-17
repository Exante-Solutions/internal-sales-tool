/**
 * AnthropicAnalysis — the live AnalysisGateway (SPEC §5.3, §6.5). Produces the
 * lightweight discovery fields for a conversation and the profile AI rollup over
 * a timeline, via Opus 4.8. This is a DISTINCT port from ScorerGateway: the
 * on-demand playbook eval and discovery enrichment have different volatility
 * (SPEC §6.5). The Anthropic Message dies in callJson; only the domain Analysis /
 * ProfileSummary cross out (CLAUDE.md law 2/3).
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import type { AnalysisGateway } from "@/domain/ports";
import type { Conversation } from "@/domain/conversation";
import type { Analysis, LearnedFact, Signal, Sentiment } from "@/domain/analysis";
import type { TimelineEntry, ProfileSummary, SubjectType } from "@/domain/profile";
import { callJson } from "./llm";

interface RawAnalysis {
  summary: string;
  sentiment?: Sentiment;
  what_we_learned?: { text: string; cite_ts_seconds?: number }[];
  signals?: { text: string; kind?: string; cite_ts_seconds?: number }[];
  next_steps?: string[];
  reason?: string;
  outcome?: string;
}

const ANALYSIS_SYSTEM = `You are a discovery analyst. From a sales/discovery conversation, extract lightweight, evidence-bound structured notes. Do NOT score against any rubric — that is a separate, opt-in step. Be concise and honest; never invent facts the text does not support. When you cite, cite_ts_seconds must be one of the [Ns] timestamps shown.`;

function conversationText(conversation: Conversation): string {
  if (conversation.segments.length) {
    return conversation.segments.map((s) => `[${s.ts}s] ${s.speaker}: ${s.text}`).join("\n");
  }
  // Manual conversation (no transcript): analyze the captured reason/outcome notes.
  return [conversation.reasonMd, conversation.outcomeMd].filter(Boolean).join("\n\n");
}

export class AnthropicAnalysis implements AnalysisGateway {
  async analyzeConversation(conversation: Conversation): Promise<Analysis> {
    const raw = await callJson<RawAnalysis>({
      maxTokens: 1500,
      system: ANALYSIS_SYSTEM,
      user: `CONVERSATION "${conversation.title}" (source: ${conversation.source}).
${conversation.reasonMd ? `Stated reason: ${conversation.reasonMd}\n` : ""}TEXT:
${conversationText(conversation) || "(no text available)"}

Return JSON:
{"summary":"2-3 sentence discovery summary",
 "sentiment":"positive|neutral|negative",
 "what_we_learned":[{"text":"a discrete fact we learned","cite_ts_seconds":N}],
 "signals":[{"text":"a buying/risk/timing/competitor signal","kind":"buying|risk|timing|competitor","cite_ts_seconds":N}],
 "next_steps":["concrete recommended follow-up"],
 "reason":"why this conversation happened",
 "outcome":"how it went / what came of it"}`,
    });

    const whatWeLearned: LearnedFact[] = (raw.what_we_learned ?? []).map((f) => ({
      text: f.text,
      cite_ts_seconds: f.cite_ts_seconds,
    }));
    const signals: Signal[] = (raw.signals ?? []).map((s) => ({
      text: s.text,
      kind: s.kind,
      cite_ts_seconds: s.cite_ts_seconds,
    }));

    return {
      id: `analysis-${conversation.id}`,
      conversationId: conversation.id,
      recorderActionItems: [],
      summaryMd: raw.summary,
      sentiment: raw.sentiment,
      whatWeLearned,
      signals,
      nextSteps: raw.next_steps ?? [],
      reasonMd: raw.reason ?? (conversation.reasonMd || undefined),
      outcomeMd: raw.outcome ?? (conversation.outcomeMd || undefined),
      createdAt: conversation.createdAt,
    };
  }

  async summarizeProfile(
    subjectType: SubjectType,
    subjectId: string,
    timeline: TimelineEntry[],
  ): Promise<ProfileSummary> {
    const block = timeline
      .map((e) => `- ${e.occurredAt} (${e.kind}): ${e.bodyMd}`)
      .join("\n");

    const raw = await callJson<{ summary: string }>({
      maxTokens: 1200,
      system: `You roll up everything we know about a ${subjectType} into a tight, current briefing for a salesperson about to engage them. Synthesize the timeline; surface what matters; be honest about gaps. Markdown.`,
      user: `Append-only timeline for this ${subjectType}, oldest→newest:
${block || "(no history yet)"}

Return {"summary":"markdown rollup — who they are, what we've learned, open threads, recommended next move"}`,
    });

    return {
      id: `summary-${subjectType}-${subjectId}`,
      subjectType,
      subjectId,
      summaryMd: raw.summary,
      // The use case (regenerate-profile) owns the authoritative generatedAt via
      // its Clock; this is a sensible default if used directly.
      generatedAt: new Date().toISOString(),
      sourceEntryCount: timeline.length,
    };
  }
}
