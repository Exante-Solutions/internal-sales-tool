/**
 * Ports — domain-owned interfaces. Infrastructure implements these; the
 * application layer depends only on them. The one genuinely volatile external
 * dependency (the Anthropic SDK) sits behind ScorerGateway / RescorerGateway /
 * DrillScenarioGateway. Swapping the real adapter for the fake changes only the
 * composition root — never domain/ or application/ (CLAUDE.md law 5).
 */

import type { Transcript, Evaluation, FumbledMoment, DrillScenario, Rescore } from "./coaching";
import type { CoachBriefing, SkillGap } from "./briefing";
import type { Session } from "./session";
import type { StoredCall } from "./store";
import type { TeamCoachingAction, TeamItemStat } from "./team";
import type { CallType } from "./rubric";

export interface ScorerGateway {
  /** Run the 4-pass eval (adversarial: score → refute → reconcile). */
  score(transcript: Transcript): Promise<Evaluation>;
}

export interface CoachBriefingGateway {
  /** Synthesize the sales-leader coaching prep for the drilled skill, aware of
   * the rep's other gaps but focused on the one move (Feature 1, SPEC §19). */
  brief(moment: FumbledMoment, gaps: SkillGap[], transcript: Transcript): Promise<CoachBriefing>;
  /** Answer the rep's single follow-up question, in the coach's voice. */
  answer(question: string, briefing: CoachBriefing, transcript: Transcript): Promise<string>;
}

export interface CallStore {
  /** The user's own calls, newest first (Feature 2, SPEC §20). */
  list(userId: string): Promise<StoredCall[]>;
  /** A single owned call, or null if it isn't the user's. */
  get(userId: string, callId: string): Promise<StoredCall | null>;
  /** Persist a user-owned call. */
  save(userId: string, call: StoredCall): Promise<void>;
}

export interface SessionGateway {
  /** The current user/team (seeded demo team until Auth0 is wired, Feature 3). */
  current(): Promise<Session>;
}

export interface TeamCoachGateway {
  /** Synthesize the agentic coaching action for a call type (Feature 4, §22). */
  action(callType: CallType, stats: TeamItemStat[]): Promise<TeamCoachingAction>;
}

export interface DrillScenarioGateway {
  /** Generate-and-filter a drill scenario from the fumbled moment. */
  scenario(moment: FumbledMoment, transcript: Transcript): Promise<DrillScenario>;
}

export interface RescorerGateway {
  /** Score the drill transcript on the single drilled item's 1–5 anchors. */
  rescore(
    drillTranscript: string,
    moment: FumbledMoment,
    callId: string,
  ): Promise<Rescore>;
}
