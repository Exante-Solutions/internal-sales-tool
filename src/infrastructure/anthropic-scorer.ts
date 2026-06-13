/**
 * AnthropicScorer — the real Opus 4.8 adversarial scorer (ScorerGateway).
 *
 * Adversarial loop, faithful to SPEC.md §9 + the orchestration ask:
 *   1. SCORE   — Opus observes + scores each rubric item 1–5 with a cited moment.
 *   2. REFUTE  — a second Opus pass attacks pass 1 against the rubric anchors,
 *                flagging ungrounded citations and mis-scored items.
 *   3. RECONCILE — a final pass merges the critique into a corrected evaluation.
 * Then citations are grounded against the transcript; a miss triggers one
 * re-prompt for a real anchor rather than accepting an invention.
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import type { ScorerGateway } from "@/domain/ports";
import type { Evaluation, Transcript, ItemScore } from "@/domain/coaching";
import { rubricFor } from "@/domain/rubric";
import { bandFor, computeScore100, selectWeakest } from "@scoring";
import { callJson } from "./llm";

interface RawItem {
  rubric_item_id: number;
  score_1_5: number;
  rationale: string;
  cite_ts_seconds: number;
  cite_quote: string;
}
interface RawScore {
  items: RawItem[];
  headline: string;
  deal_vs_process_note: string;
  coaching_theme: string;
}
interface RawCritique {
  revised_items: RawItem[];
  notes: string;
}

function rubricBlock(transcript: Transcript): string {
  const r = rubricFor(transcript.callType);
  return r.items
    .map((i) => `#${i.id} "${i.name}" (weight ${i.weight}) — 5/5: ${i.anchorHigh} | 1/5: ${i.anchorLow}`)
    .join("\n");
}

function transcriptBlock(transcript: Transcript): string {
  return transcript.segments.map((s) => `[${s.ts}s] ${s.speaker}: ${s.text}`).join("\n");
}

const SCORER_SYSTEM = `You are CoachLoop's senior sales-call evaluator. You score a call against a fixed rubric.
RULES:
- Score every rubric item an INTEGER 1-5 against its 5/5 and 1/5 anchors.
- EVERY item MUST cite a real moment: cite_ts_seconds must be one of the [Ns] timestamps shown, and cite_quote must be a VERBATIM substring of that exact line. Never invent a quote or timestamp.
- Be evidence-bound and honest; do not inflate scores.`;

export class AnthropicScorer implements ScorerGateway {
  async score(transcript: Transcript): Promise<Evaluation> {
    const rubric = rubricFor(transcript.callType);
    const ids = rubric.items.map((i) => i.id);
    const rb = rubricBlock(transcript);
    const tb = transcriptBlock(transcript);

    // 1. SCORE
    const first = await callJson<RawScore>({
      system: SCORER_SYSTEM,
      user: `CALL TYPE: ${transcript.callType}
RUBRIC:
${rb}

TRANSCRIPT:
${tb}

Score all ${ids.length} items. Return JSON:
{"items":[{"rubric_item_id":N,"score_1_5":N,"rationale":"...","cite_ts_seconds":N,"cite_quote":"..."}],
 "headline":"one-line process-quality (not deal-quality) headline",
 "deal_vs_process_note":"distinguish hot-deal-weak-process from cold-deal-weak-process",
 "coaching_theme":"the single highest-leverage change, with a quoted script the rep should have said"}`,
    });

    // 2. REFUTE — adversarial pass
    const critique = await callJson<RawCritique>({
      system: SCORER_SYSTEM,
      user: `You are auditing another evaluator's scores. Be skeptical. For each item, check:
- Is the score justified by the anchors, or inflated/deflated?
- Is cite_ts_seconds a real timestamp AND is cite_quote a verbatim substring of that line? If not, replace it with a real one.
RUBRIC:
${rb}

TRANSCRIPT:
${tb}

EVALUATOR'S SCORES:
${JSON.stringify(first.items)}

Return corrected JSON: {"revised_items":[{"rubric_item_id":N,"score_1_5":N,"rationale":"...","cite_ts_seconds":N,"cite_quote":"..."}],"notes":"what you changed and why"}`,
    });

    // 3. RECONCILE — prefer the audited items, then ground every citation.
    const merged = this.mergeItems(rubric, first.items, critique.revised_items);
    const grounded = await this.groundCitations(transcript, merged);

    const items: ItemScore[] = grounded.map((raw) => {
      const ri = rubric.items.find((i) => i.id === raw.rubric_item_id)!;
      return {
        rubric_item_id: ri.id,
        name: ri.name,
        weight: ri.weight,
        score_1_5: clamp1to5(raw.score_1_5),
        rationale: raw.rationale,
        cite_ts_seconds: raw.cite_ts_seconds,
        cite_quote: raw.cite_quote,
      };
    });

    const score100 = Math.round(computeScore100(items));
    const weakest = selectWeakest(items)!;

    return {
      call_id: transcript.callId,
      call_type: transcript.callType,
      rubric_id: rubric.version,
      score_100: score100,
      band: bandFor(score100),
      headline: first.headline,
      deal_vs_process_note: first.deal_vs_process_note,
      weakest_item_id: weakest.rubric_item_id,
      coaching_theme: first.coaching_theme,
      items,
    };
  }

  private mergeItems(
    rubric: ReturnType<typeof rubricFor>,
    first: RawItem[],
    revised: RawItem[],
  ): RawItem[] {
    return rubric.items.map((ri) => {
      const r = revised.find((x) => x.rubric_item_id === ri.id);
      const f = first.find((x) => x.rubric_item_id === ri.id);
      return (
        r ??
        f ?? {
          rubric_item_id: ri.id,
          score_1_5: 3,
          rationale: "no evidence surfaced",
          cite_ts_seconds: -1,
          cite_quote: "",
        }
      );
    });
  }

  /** Citation grounding: any item whose quote isn't a substring at its ts gets one re-prompt. */
  private async groundCitations(transcript: Transcript, items: RawItem[]): Promise<RawItem[]> {
    // ts -> ALL texts at that ts: multiple segments can share a timestamp, and
    // a ts->text Map (last-wins) would shadow the first, making a real quote
    // from it un-groundable. Mirror the canonical grader (grade.mjs).
    const segByTs = new Map<number, string[]>();
    for (const s of transcript.segments) {
      const texts = segByTs.get(s.ts);
      if (texts) texts.push(s.text);
      else segByTs.set(s.ts, [s.text]);
    }
    const grounded = (i: RawItem) => {
      const texts = segByTs.get(i.cite_ts_seconds);
      return !!texts && i.cite_quote.length > 0 && texts.some((t) => t.includes(i.cite_quote));
    };

    const bad = items.filter((i) => !grounded(i));
    if (bad.length === 0) return items;

    const fixes = await callJson<{ items: RawItem[] }>({
      system: SCORER_SYSTEM,
      user: `These citations are NOT grounded (the quote is not a verbatim substring at that timestamp).
For each, pick a real [Ns] timestamp and a VERBATIM substring of that line that supports the score.

TRANSCRIPT:
${transcriptBlock(transcript)}

UNGROUNDED ITEMS: ${JSON.stringify(bad.map((b) => ({ rubric_item_id: b.rubric_item_id, score_1_5: b.score_1_5 })))}

Return {"items":[{"rubric_item_id":N,"score_1_5":N,"rationale":"...","cite_ts_seconds":N,"cite_quote":"..."}]}`,
    });

    return items.map((i) => {
      if (grounded(i)) return i;
      const fix = fixes.items.find((f) => f.rubric_item_id === i.rubric_item_id);
      return fix && grounded(fix) ? fix : i;
    });
  }
}

function clamp1to5(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}
