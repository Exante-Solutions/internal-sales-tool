/**
 * AnthropicTeamCoach — the agentic team coaching action (TeamCoachGateway,
 * Feature 4, SPEC §22). The TARGETS are deterministic: the gap item is
 * selectTeamGap(stats), and who-needs-it is the worst scorers on that item
 * (lib/team/*). Opus only writes the coaching PROSE (headline + per-rep why),
 * so "assign a drill" can never point at the wrong skill (RUBRIC F4-2).
 */

import type { TeamCoachGateway } from "@/domain/ports";
import type { TeamCoachingAction, TeamItemStat } from "@/domain/team";
import type { CallType } from "@/domain/rubric";
import { selectTeamGap } from "@team-select";
import { buildRecommendations } from "@team-action";
import { teamItemScores, seededDrillCallId } from "@/data/seed";
import { callJson } from "./llm";

export class AnthropicTeamCoach implements TeamCoachGateway {
  async action(callType: CallType, stats: TeamItemStat[]): Promise<TeamCoachingAction> {
    const gap = selectTeamGap(stats);
    if (!gap) return { callType, headline: "No data yet for this call type.", recommendations: [] };

    const perRep = teamItemScores(callType, gap.itemId).map((p) => ({
      ...p,
      drillCallId: seededDrillCallId(p.repId, callType),
    }));
    const recs = buildRecommendations(gap, perRep);

    const raw = await callJson<{ headline: string; whys: string[] }>({
      maxTokens: 800,
      system: `You are a sales manager reading your team's scorecard for one call type. Speak like a coach handing out a focused assignment — who needs what and why it's the highest-leverage move this week. Never sound like a dashboard.`,
      user: `Call type: ${callType}. The team's weakest high-leverage skill is "${gap.name}" (team avg ${gap.avg}/5, weight ${gap.weight}).
Reps who most need a drill on it, worst first: ${recs.map((r) => `${r.repName} (${perRep.find((p) => p.repId === r.repId)?.score}/5)`).join(", ")}.
Return {"headline":"one punchy coaching sentence naming the gap and the play","whys":[${recs.map(() => '"one sentence on why THIS rep needs it now"').join(",")}]}`,
    });

    const recommendations = recs.map((r, i) => ({
      repId: r.repId,
      repName: r.repName,
      skill: r.skill,
      itemId: r.itemId,
      why: raw.whys?.[i]?.trim() || r.why,
      drillCallId: r.drillCallId,
    }));

    return {
      callType,
      headline: raw.headline?.trim() || `The team's biggest lever on ${callType}: ${gap.name}.`,
      recommendations,
    };
  }
}
