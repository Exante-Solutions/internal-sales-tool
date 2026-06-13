/**
 * POST /api/drill/turn — the text-mode drill (used when ElevenLabs voice is not
 * configured). With ANTHROPIC_API_KEY set, Claude plays the AI prospect seeded
 * with the same scenario prompt the voice agent would use. Without a key it
 * falls back to a SCRIPTED prospect driven by the seeded scenario, so the loop
 * still runs end-to-end offline. Either way the transcript feeds /api/rescore.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropic } from "@/lib/anthropic";
import { MODEL } from "@/config";
import { EVALUATIONS, TRANSCRIPTS, DRILL_SCENARIOS } from "@/data/seed";
import { buildCoachService, scoringMode } from "@/infrastructure/composition";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({
  callId: z.string().min(1),
  history: z.array(z.object({ role: z.enum(["rep", "prospect"]), content: z.string() })).default([]),
  repTurn: z.string().min(1),
});

/** Did the rep quantify the pain (a number, $, or a time horizon)? */
function repQuantified(text: string): boolean {
  return /\$|\bk\b|\d{2,}|\bdays?\b|\bweeks?\b|\bmonths?\b|\bpercent\b|%/i.test(text);
}

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const { callId, history, repTurn } = parsed.data;

  const evaluation = EVALUATIONS[callId];
  const transcript = TRANSCRIPTS[callId];
  if (!evaluation || !transcript) {
    return NextResponse.json({ error: `unknown call ${callId}` }, { status: 404 });
  }

  let scenario = DRILL_SCENARIOS[callId];

  // ── Seeded fallback: scripted prospect, no network ───────────────────────
  if (scoringMode() === "seeded") {
    const recovered = repQuantified(repTurn) && history.some((h) => h.role === "rep");
    const reply = recovered
      ? "Honestly, yeah — since you put it that way, about $2.1M is sitting over 60 days right now, and DSO's running around 58 against a 45 target. That's the number that keeps me up."
      : "It's hard to put a clean number on it — it's just a constant headache. Can you help me think about how to size it?";
    return NextResponse.json({ reply, recovered });
  }

  // ── Live: Claude plays the prospect ──────────────────────────────────────
  if (!scenario) {
    const coach = buildCoachService();
    const moment = coach.fumbledMoment(evaluation, transcript);
    scenario = await coach.scenario(moment, transcript);
  }

  const messages = [
    ...history.map((h) => ({
      role: (h.role === "rep" ? "user" : "assistant") as "user" | "assistant",
      content: h.content,
    })),
    { role: "user" as const, content: repTurn },
  ];

  const message = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 400,
    system: `${scenario.prospect_system_prompt}

Stay fully in character as the buyer. Keep replies to 1-3 sentences, conversational. Recovery condition: ${scenario.recovery_condition}. When the rep meets it, concede warmly and signal the moment is handled. Never break character or coach.`,
    messages,
  });

  const reply = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join(" ")
    .trim();

  const recovered = /\$|\bdays?\b|\bweeks?\b|\b\d{2,}\b|fair enough|you('| a)re right|okay, ?yes/i.test(reply);

  return NextResponse.json({ reply, recovered });
}
