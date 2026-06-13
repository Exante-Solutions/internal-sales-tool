/**
 * AnthropicCoachBriefing — the sales-leader coaching prep (CoachBriefingGateway,
 * Feature 1, SPEC §19). Opus plays a leader debriefing the rep 1:1 before a
 * roleplay: what happened, the ONE move, a script line, and the buyer's natural
 * opening line that re-stages the moment WITHOUT naming the skill. The opener is
 * self-filtered against the anti-telegraph rule (lib/coaching/telegraph.mjs);
 * if it leaks the skill, we fall back to the real prospect line.
 */

import type { CoachBriefingGateway } from "@/domain/ports";
import type { CoachBriefing, SkillGap } from "@/domain/briefing";
import type { FumbledMoment, Transcript } from "@/domain/coaching";
import { MODEL } from "@/config";
import { getAnthropic } from "@/lib/anthropic";
import { mentionsSkill } from "@telegraph";
import { callJson } from "./llm";

interface RawBriefing {
  situation: string;
  the_move: string;
  sample_line: string;
  opener: string;
}

export class AnthropicCoachBriefing implements CoachBriefingGateway {
  async brief(moment: FumbledMoment, gaps: SkillGap[], transcript: Transcript): Promise<CoachBriefing> {
    const otherGaps = gaps.length
      ? gaps.map((g) => `- ${g.skill} (${g.score_1_5}/5)`).join("\n")
      : "- (none worth flagging)";

    const raw = await callJson<RawBriefing>({
      maxTokens: 1200,
      system: `You are a seasoned sales leader running a quick 1:1 with a rep right before a practice roleplay. You are warm, direct, and specific. You debrief what actually happened on the call and the ONE move that would have changed it — you do NOT read out rubric names, metric names, or scores. Then you hand off to a roleplay where a buyer re-creates the moment.`,
      user: `CALL: ${transcript.callType} with ${transcript.contact} (${transcript.contactRole}) at ${transcript.prospect}.

THE MOMENT TO WORK ON (at ${moment.cite_ts_seconds}s):
  Rep said: "${moment.rep_line}"
  Buyer said: "${moment.prospect_line}"
  What great looks like here: ${moment.anchorHigh}
  What weak looks like here: ${moment.anchorLow}

The rep also has softer spots you're AWARE of but should NOT dwell on (stay focused on the one moment above):
${otherGaps}

Write the prep. Return JSON:
{
 "situation": "2-3 sentences: what happened in this moment and why it cost them — like a leader talking, grounded in the call, NOT a metric readout",
 "the_move": "1-2 sentences: the single move to make next time",
 "sample_line": "one verbatim line the rep could say to make that move",
 "opener": "the BUYER's natural first line that re-opens this moment in the roleplay — a real, in-character line that creates a situation where the skill matters. It must NOT name the skill, the metric, or any coaching language; it should sound like a guarded buyer, not a quiz."
}`,
    });

    let opener = (raw.opener ?? "").trim() || moment.prospect_line;
    // Anti-telegraph guard: a real buyer never names the skill being practiced.
    if (mentionsSkill(opener, moment.skill)) opener = moment.prospect_line;

    return {
      skill: moment.skill,
      situation: (raw.situation ?? "").trim(),
      the_move: (raw.the_move ?? "").trim(),
      sample_line: (raw.sample_line ?? "").trim(),
      opener,
    };
  }

  async answer(question: string, briefing: CoachBriefing, transcript: Transcript): Promise<string> {
    const message = await getAnthropic().messages.create({
      model: MODEL,
      max_tokens: 400,
      system: `You are the same sales leader from the prep. Answer the rep's ONE follow-up in 2-4 concrete sentences, then nudge them into the roleplay. Stay in a coaching voice; never name rubric items, metrics, or scores.`,
      messages: [
        {
          role: "user",
          content: `Context — we're working on this move: ${briefing.the_move}
The buyer is ${transcript.contact}, ${transcript.contactRole} at ${transcript.prospect}.
Rep's question: ${question}`,
        },
      ],
    });
    return message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim();
  }
}
