/**
 * Team-analytics domain types (Feature 4, SPEC §22). The read layer aggregates
 * many atomic evals; this describes the boundary shapes for the team view and
 * the agentic coaching action. No SDK/framework imports.
 */

import type { CallType } from "./rubric";

/** Team performance on one rubric item (computed in the read layer). */
export interface TeamItemStat {
  itemId: number;
  name: string;
  weight: number;
  avg: number;
  strongest: { rep: string; score: number };
  weakest: { rep: string; score: number };
}

/** One coaching recommendation: who needs what + where to drill it. */
export interface TeamRecommendation {
  repId: string;
  repName: string;
  skill: string;
  itemId: number;
  why: string;
  /** Call the rep drills from (routes to its contextualized drill). */
  drillCallId?: string;
}

/** The hero of the team view — coaching, not a dashboard. */
export interface TeamCoachingAction {
  callType: CallType;
  headline: string;
  recommendations: TeamRecommendation[];
}
