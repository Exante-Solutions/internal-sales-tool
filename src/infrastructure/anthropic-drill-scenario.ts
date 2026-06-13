/**
 * AnthropicDrillScenario — generates-and-filters the drill scenario from the
 * fumbled moment (DrillScenarioGateway). Opus drafts a prospect persona that
 * re-stages the exact moment, then self-filters it against a quality bar
 * (in-character, re-stages THIS objection, has a clear recovery condition).
 */

import type { DrillScenarioGateway } from "@/domain/ports";
import type { FumbledMoment, DrillScenario, Transcript } from "@/domain/coaching";
import { callJson } from "./llm";

interface RawScenario {
  prospect_system_prompt: string;
  opening_line: string;
  recovery_condition: string;
  passes_filter: boolean;
  filter_notes: string;
}

export class AnthropicDrillScenario implements DrillScenarioGateway {
  async scenario(moment: FumbledMoment, transcript: Transcript): Promise<DrillScenario> {
    const raw = await callJson<RawScenario>({
      system: `You design realistic sales role-play drills. You produce a prospect persona that RE-STAGES one exact fumbled moment so the rep can practice a single skill, then you self-audit it.`,
      user: `BUYER CONTEXT: ${transcript.prospect}, contact ${transcript.contact} (${transcript.contactRole}). Call type: ${transcript.callType}.
SKILL TO DRILL: "${moment.skill}"
  5/5 looks like: ${moment.anchorHigh}
  1/5 looks like: ${moment.anchorLow}
THE FUMBLED MOMENT (at ${moment.cite_ts_seconds}s):
  Rep said: "${moment.rep_line}"
  Prospect said: "${moment.prospect_line}"

Write a drill where an AI prospect re-stages THIS exact moment. The prospect stays in character as ${transcript.contact}; if the rep handles it to the 5/5 anchor, warm up and concede (recovery); if they fumble, press the same objection again.

Then FILTER your own scenario: set passes_filter=true only if it (a) re-stages this specific moment, (b) keeps the prospect in character, (c) has an unambiguous recovery condition tied to the 5/5 anchor.

Return {"prospect_system_prompt":"...","opening_line":"the prospect's first line, restaging the moment","recovery_condition":"what the rep must do to make the prospect concede","passes_filter":bool,"filter_notes":"..."}`,
    });

    return {
      rubric_item_id: moment.rubric_item_id,
      skill: moment.skill,
      prospect_system_prompt: raw.prospect_system_prompt,
      opening_line: raw.opening_line,
      recovery_condition: raw.recovery_condition,
    };
  }
}
