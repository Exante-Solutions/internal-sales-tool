/**
 * Coach-prep domain types (Feature 1, SPEC §19). Additive — the Evaluation
 * write model in coaching.ts is untouched. No SDK/framework imports.
 */

/** One of the rep's other weak items on this call type — context the coach is
 * "aware of" so the prep can connect the dots without losing focus. */
export interface SkillGap {
  skill: string;
  score_1_5: number;
  weight: number;
}

/** The sales-leader coaching prep shown before the roleplay. */
export interface CoachBriefing {
  skill: string;
  /** What happened on the call and why it matters — grounded, not a metric readout. */
  situation: string;
  /** The single move to make (exactly one). */
  the_move: string;
  /** A script line the rep can try. */
  sample_line: string;
  /** The prospect's natural opening line for the roleplay — must NOT name the
   * drilled skill (anti-telegraph, lib/coaching/telegraph.mjs). */
  opener: string;
}
