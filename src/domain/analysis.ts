/**
 * Analysis domain (SPEC §3, §5.3, §8.1). Structured output attached to a
 * conversation: the recorder's auto summary/action items + our discovery fields
 * (summary, what we learned, signals, next steps, reason, outcome). The reused
 * rubric scorecard is the on-demand `CoachingEvaluation` — re-exported from
 * coaching.ts WITHOUT modifying that file (CLAUDE.md / task constraint).
 * No SDK, no framework, no ORM, no validator imports.
 */

import type { Evaluation } from "./coaching";

/**
 * The reused rubric scorecard. SPEC §3 names it `CoachingEvaluation`; the
 * existing write model is `Evaluation` in coaching.ts. Re-export under the
 * spec name as an alias so the rest of the domain can speak the spec's language
 * without duplicating (or touching) coaching.ts.
 */
export type CoachingEvaluation = Evaluation;
export type { Evaluation as CoachingEvaluationModel } from "./coaching";

/** A discrete thing we learned in the conversation (discovery field). */
export interface LearnedFact {
  text: string;
  /** Optional grounding timestamp into the transcript. */
  cite_ts_seconds?: number;
}

/** A buying/risk/intent signal surfaced from the conversation. */
export interface Signal {
  text: string;
  /** e.g. "buying", "risk", "competitor", "timing". */
  kind?: string;
  cite_ts_seconds?: number;
}

/** Optional coarse sentiment read of the conversation. */
export type Sentiment = "positive" | "neutral" | "negative";

/**
 * Structured analysis attached to a conversation. The recorder fields are auto;
 * the discovery fields are produced on-demand by the AnalysisGateway. The
 * `coachingEvaluation` is present ONLY when the user runs the playbook check —
 * its absence is normal (SPEC §8.1 note).
 */
export interface Analysis {
  id: string;
  conversationId: string;
  /** Recorder's own summary, if the recording carried one (auto). */
  recorderSummaryMd?: string;
  /** Recorder's auto-extracted action items. */
  recorderActionItems: string[];
  /** Our discovery summary of the conversation. */
  summaryMd?: string;
  sentiment?: Sentiment;
  /** Discovery field: what we learned. */
  whatWeLearned: LearnedFact[];
  /** Discovery field: signals detected. */
  signals: Signal[];
  /** Discovery field: recommended next steps. */
  nextSteps: string[];
  /** Discovery field: the reason this conversation happened (derived/echoed). */
  reasonMd?: string;
  /** Discovery field: the outcome / how it went. */
  outcomeMd?: string;
  /** On-demand rubric scorecard; present only after a playbook check. */
  coachingEvaluation?: CoachingEvaluation;
  createdAt: string;
}
