/**
 * Types for the canonical grader. The runtime functions live in the pure JS
 * grader (lib/scoring/grade.mjs, imported via the "@scoring" alias — it stays
 * the single source of truth the fixture test grades against); these types
 * describe the shapes that cross into it. Pure TS, no SDK, no framework.
 */

export type Band = "strong" | "needs_work" | "redo";

export interface GradeableItem {
  rubric_item_id: number;
  name?: string;
  weight: number;
  score_1_5: number;
  cite_ts_seconds: number | null;
  cite_quote: string;
}

export interface GradeableEvaluation {
  score_100: number;
  band: string;
  weakest_item_id: number;
  items: GradeableItem[];
}

export interface GradeableTranscript {
  segments: { ts: number; speaker: string; text: string }[];
}

export interface GradeResult {
  ok: boolean;
  errors: string[];
}
