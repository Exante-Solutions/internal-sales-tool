/**
 * Boundary-crossing domain types. Only these plain objects cross adapter
 * boundaries — never a vendor object (an Anthropic Message dies at its adapter).
 * No SDK, no framework imports here (verifiable by grep, per CLAUDE.md law 2).
 */

import type { Band } from "./grading";
import type { CallType } from "./rubric";

export interface TranscriptSegment {
  ts: number;
  speaker: string;
  text: string;
}

export interface Transcript {
  callId: string;
  callType: CallType;
  prospect: string;
  contact: string;
  contactRole: string;
  segments: TranscriptSegment[];
}

/** One scored rubric item with its grounded citation. */
export interface ItemScore {
  rubric_item_id: number;
  name: string;
  weight: number;
  score_1_5: number;
  rationale: string;
  cite_ts_seconds: number;
  cite_quote: string;
}

/** An atomic evaluation — references only its own call (SPEC.md §8). */
export interface Evaluation {
  call_id: string;
  call_type: CallType;
  rubric_id: string;
  score_100: number;
  band: Band;
  headline: string;
  /** Honest process-quality-not-deal-quality interpretation. */
  deal_vs_process_note: string;
  weakest_item_id: number;
  /** The single highest-leverage change, with a quoted script. */
  coaching_theme: string;
  items: ItemScore[];
}

/** The fumbled moment that seeds the drill (drill target = weakest item). */
export interface FumbledMoment {
  rubric_item_id: number;
  skill: string;
  weight: number;
  before_1_5: number;
  anchorLow: string;
  anchorHigh: string;
  cite_ts_seconds: number;
  rep_line: string;
  prospect_line: string;
}

/** Server-built scenario the voice (or text) drill is seeded with. */
export interface DrillScenario {
  rubric_item_id: number;
  skill: string;
  /** Persona/behaviour the AI prospect adopts to re-stage the moment. */
  prospect_system_prompt: string;
  opening_line: string;
  /** What the rep must do to hit the 5/5 anchor (recovery condition). */
  recovery_condition: string;
}

/** Scoped re-score of a drill on ONE item — the visible gain. */
export interface Rescore {
  call_id: string;
  drilled_item_id: number;
  skill: string;
  weight: number;
  before_1_5: number;
  after_1_5: number;
  delta_points_100: number;
  cite_quote: string;
  rationale: string;
}
