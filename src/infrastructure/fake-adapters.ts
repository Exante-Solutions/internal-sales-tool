/**
 * Deterministic, offline adapters — the demo's safety net (build these FIRST,
 * per CLAUDE.md). They return the seeded artifacts with no network and no key,
 * so the whole loop runs even if the venue WiFi dies or no ANTHROPIC_API_KEY
 * is set. Swapping these for the real Anthropic adapters changes only the
 * composition root.
 */

import type {
  ScorerGateway,
  RescorerGateway,
  DrillScenarioGateway,
  CoachBriefingGateway,
  TeamCoachGateway,
} from "@/domain/ports";
import type { Transcript, FumbledMoment, DrillScenario, Rescore } from "@/domain/coaching";
import type { CoachBriefing, SkillGap } from "@/domain/briefing";
import type { TeamCoachingAction, TeamItemStat } from "@/domain/team";
import type { CallType } from "@/domain/rubric";
import type { Evaluation } from "@/domain/coaching";
import { rubricFor } from "@/domain/rubric";
import { EVALUATIONS, DRILL_SCENARIOS, RESCORES, teamItemScores, seededDrillCallId } from "@/data/seed";
import { selectTeamGap } from "@team-select";
import { buildRecommendations } from "@team-action";
import { computeScore100, bandFor, selectWeakest } from "@scoring";
import discoveryBriefing from "@/data/artifacts/discovery-briefing.json";

/**
 * Deterministic, grader-valid evaluation for an UNSEEDED transcript (an uploaded
 * call with no ANTHROPIC_API_KEY). Every item cites a real segment so it passes
 * validateEvaluation; the loop runs offline. Clearly labelled as an estimate.
 */
function synthesizeEvaluation(transcript: Transcript): Evaluation {
  const rubric = rubricFor(transcript.callType);
  const segs = transcript.segments.length ? transcript.segments : [{ ts: 0, speaker: "Speaker", text: "(empty)" }];
  const items = rubric.items.map((it, i) => {
    const seg = segs[Math.min(i, segs.length - 1)];
    return {
      rubric_item_id: it.id,
      name: it.name,
      weight: it.weight,
      score_1_5: 2 + ((it.id * 2 + it.weight) % 3), // deterministic 2–4
      rationale: `Offline estimate (no ANTHROPIC_API_KEY) anchored to the moment at ${seg.ts}s.`,
      cite_ts_seconds: seg.ts,
      cite_quote: seg.text.slice(0, 40),
    };
  });
  const computed = computeScore100(items);
  const weakest = selectWeakest(items);
  return {
    call_id: transcript.callId,
    call_type: transcript.callType,
    rubric_id: rubric.version,
    score_100: Math.round(computed),
    band: bandFor(computed),
    headline: `Offline estimate for ${transcript.prospect} — set ANTHROPIC_API_KEY for a real Opus 4.8 evaluation.`,
    deal_vs_process_note:
      "Deterministic offline estimate so the loop runs without a key. Scores are illustrative, not a real evaluation — every item still cites a real transcript moment.",
    weakest_item_id: weakest.rubric_item_id,
    coaching_theme: `Offline estimate: your highest-leverage gap here is "${weakest.name}".`,
    items,
  };
}

const BRIEFINGS: Record<string, CoachBriefing> = {
  "call-northwind-disco": discoveryBriefing as CoachBriefing,
};

export class FakeScorer implements ScorerGateway {
  async score(transcript: Transcript) {
    // Seeded calls return their real Opus eval; uploaded calls get a
    // deterministic, grader-valid offline estimate so the loop runs with no key.
    return EVALUATIONS[transcript.callId] ?? synthesizeEvaluation(transcript);
  }
}

export class FakeDrillScenario implements DrillScenarioGateway {
  async scenario(moment: FumbledMoment, transcript: Transcript): Promise<DrillScenario> {
    return (
      DRILL_SCENARIOS[transcript.callId] ?? {
        rubric_item_id: moment.rubric_item_id,
        skill: moment.skill,
        prospect_system_prompt: `Re-stage the moment where the rep should have nailed "${moment.skill}". Stay in character; concede when they hit: ${moment.anchorHigh}.`,
        opening_line: moment.prospect_line,
        recovery_condition: moment.anchorHigh,
      }
    );
  }
}

export class FakeCoachBriefing implements CoachBriefingGateway {
  async brief(moment: FumbledMoment, _gaps: SkillGap[], transcript: Transcript): Promise<CoachBriefing> {
    return (
      BRIEFINGS[transcript.callId] ?? {
        skill: moment.skill,
        situation: `On the ${transcript.callType} call, the moment around "${moment.rep_line.slice(0, 70)}…" slipped — that's the 1/5: ${moment.anchorLow}. It's the one to run back.`,
        the_move: `Don't accept the first answer — push until you hit ${moment.anchorHigh.toLowerCase()}.`,
        sample_line: `"Totally fair — let's put a rough number on it so we can size this properly. Most teams your size see X; does that sound high or low?"`,
        // The opener re-stages the real moment and never names the skill.
        opener: moment.prospect_line,
      }
    );
  }
  async answer(_question: string, _briefing: CoachBriefing, _transcript: Transcript): Promise<string> {
    return "Good question. Acknowledge what they said so it doesn't feel like an interrogation, then hand them a range to react to — that's what makes the number come out. When you're ready, jump in and try it.";
  }
}

export class FakeTeamCoach implements TeamCoachGateway {
  async action(callType: CallType, stats: TeamItemStat[]): Promise<TeamCoachingAction> {
    const gap = selectTeamGap(stats);
    if (!gap) return { callType, headline: "No data yet for this call type.", recommendations: [] };
    const perRep = teamItemScores(callType, gap.itemId).map((p) => ({
      ...p,
      drillCallId: seededDrillCallId(p.repId, callType),
    }));
    return {
      callType,
      headline: `The team's biggest lever on ${callType}: ${gap.name} (avg ${gap.avg}/5). Assign a focused drill to the reps below.`,
      recommendations: buildRecommendations(gap, perRep),
    };
  }
}

export class FakeRescorer implements RescorerGateway {
  async rescore(_drillTranscript: string, moment: FumbledMoment, callId: string): Promise<Rescore> {
    const seeded = RESCORES[callId];
    if (seeded && seeded.drilled_item_id === moment.rubric_item_id) return seeded;
    // Generic positive-gain fallback so the loop always shows a delta.
    const after = Math.min(5, moment.before_1_5 + 2);
    return {
      call_id: callId,
      drilled_item_id: moment.rubric_item_id,
      skill: moment.skill,
      weight: moment.weight,
      before_1_5: moment.before_1_5,
      after_1_5: after,
      delta_points_100: ((after - moment.before_1_5) * moment.weight) / 5,
      cite_quote: "(simulated drill) the rep pushed until a number surfaced",
      rationale: "Simulated drill recovery — replace with a live ElevenLabs drill once keys are set.",
    };
  }
}
