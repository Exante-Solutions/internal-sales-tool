/**
 * Seed data — the demo's world. No DB in this build (DATABASE_URL is unset for
 * the hackathon), so the read model lives here: reps, the two real Opus-scored
 * calls (Northwind discovery + demo), and a deterministic history that powers
 * the progress + team views. Atomic evals never compare across calls; the
 * progress/team aggregates are computed in a separate read layer (SPEC.md §12).
 */

import type { Transcript, Evaluation, DrillScenario, Rescore } from "@/domain/coaching";
import type { CallType } from "@/domain/rubric";
import { RUBRICS } from "@/domain/rubric";

import discoveryTranscript from "./artifacts/discovery-transcript.json";
import demoTranscript from "./artifacts/demo-transcript.json";
import discoveryEval from "./artifacts/discovery-eval.json";
import demoEval from "./artifacts/demo-eval.json";
import discoveryScenario from "./artifacts/discovery-drill-scenario.json";
import discoveryRescore from "./artifacts/discovery-rescore.json";

export interface Rep {
  id: string;
  name: string;
  initials: string;
}

export interface CallMeta {
  id: string;
  repId: string;
  callType: CallType;
  prospect: string;
  contact: string;
  contactRole: string;
  date: string;
}

export const REPS: Rep[] = [
  { id: "rep-alex", name: "Alex Chen", initials: "AC" },
  { id: "rep-jordan", name: "Jordan Lee", initials: "JL" },
  { id: "rep-priya", name: "Priya Nair", initials: "PN" },
  { id: "rep-marcus", name: "Marcus Webb", initials: "MW" },
];

export const TRANSCRIPTS: Record<string, Transcript> = {
  "call-northwind-disco": discoveryTranscript as Transcript,
  "call-northwind-demo": demoTranscript as Transcript,
};

export const EVALUATIONS: Record<string, Evaluation> = {
  "call-northwind-disco": discoveryEval as Evaluation,
  "call-northwind-demo": demoEval as Evaluation,
};

export const DRILL_SCENARIOS: Record<string, DrillScenario> = {
  "call-northwind-disco": discoveryScenario as DrillScenario,
};

export const RESCORES: Record<string, Rescore> = {
  "call-northwind-disco": discoveryRescore as Rescore,
};

/** The two real calls belong to Alex; they carry full Opus evaluations. */
export const CALLS: CallMeta[] = [
  { id: "call-northwind-disco", repId: "rep-alex", callType: "discovery", prospect: "Northwind Manufacturing", contact: "Sam Reyes", contactRole: "VP Finance", date: "2026-06-11" },
  { id: "call-northwind-demo", repId: "rep-alex", callType: "demo", prospect: "Northwind Manufacturing", contact: "Sam Reyes", contactRole: "VP Finance", date: "2026-06-12" },
];

export function repById(id: string): Rep | undefined {
  return REPS.find((r) => r.id === id);
}
export function callsForRep(repId: string): CallMeta[] {
  return CALLS.filter((c) => c.repId === repId);
}
export function callById(id: string): CallMeta | undefined {
  return CALLS.find((c) => c.id === id);
}

// ── Derived read layer: progress + team (computed, no table) ────────────────

export interface HistoryPoint {
  date: string;
  /** item id -> 1-5 score */
  scores: Record<number, number>;
}

/**
 * Deterministic synthetic history per rep per call type, so progress lines and
 * team aggregates look real. Seeded from the rep's name + call type (no RNG, so
 * the build is reproducible). Scores trend gently upward over 6 calls.
 */
function seededHistory(repId: string, callType: CallType): HistoryPoint[] {
  const items = RUBRICS[callType].items;
  const base = [...repId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const dates = ["04-28", "05-05", "05-13", "05-21", "05-29", "06-06"];
  return dates.map((d, t) => {
    const scores: Record<number, number> = {};
    for (const it of items) {
      // pseudo-random but stable, drifting up with t
      const seed = (base + it.id * 37 + t * 13) % 7;
      const drift = Math.floor(t / 2);
      scores[it.id] = Math.max(1, Math.min(5, 2 + (seed % 3) + drift - 1));
    }
    return { date: `2026-${d}`, scores };
  });
}

export function repProgress(repId: string, callType: CallType): HistoryPoint[] {
  return seededHistory(repId, callType);
}

// ── Team read layer: per-rep-per-item scores + drill routing (Feature 4) ─────

export interface RepItemScore {
  repId: string;
  repName: string;
  score: number;
}

/** Latest-call score for every rep on one rubric item — powers the team view's
 * people drill-down and the coaching-action's "who needs what" (SPEC §22). */
export function teamItemScores(callType: CallType, itemId: number): RepItemScore[] {
  return REPS.map((r) => {
    const hist = seededHistory(r.id, callType);
    return { repId: r.id, repName: r.name, score: hist[hist.length - 1].scores[itemId] };
  });
}

/** Where a rep drills this call type: their own scored call if any, else the
 * canonical seeded call of that type — so "assign a drill" always routes in the
 * demo (the contextualized drill re-stages that call's weakest moment). */
export function seededDrillCallId(repId: string, callType: CallType): string | undefined {
  const own = CALLS.find((c) => c.repId === repId && c.callType === callType && EVALUATIONS[c.id]);
  if (own) return own.id;
  return CALLS.find((c) => c.callType === callType && EVALUATIONS[c.id])?.id;
}

export interface TeamItemStat {
  itemId: number;
  name: string;
  weight: number;
  avg: number;
  strongest: { rep: string; score: number };
  weakest: { rep: string; score: number };
}

/** Team view: latest-call average per rubric item + strongest/weakest rep. */
export function teamStats(callType: CallType): TeamItemStat[] {
  const items = RUBRICS[callType].items;
  return items.map((it) => {
    const latest = REPS.map((r) => {
      const hist = seededHistory(r.id, callType);
      return { rep: r.name, score: hist[hist.length - 1].scores[it.id] };
    });
    const avg = latest.reduce((s, x) => s + x.score, 0) / latest.length;
    const sorted = [...latest].sort((a, b) => b.score - a.score);
    return {
      itemId: it.id,
      name: it.name,
      weight: it.weight,
      avg: Math.round(avg * 10) / 10,
      strongest: sorted[0],
      weakest: sorted[sorted.length - 1],
    };
  });
}
