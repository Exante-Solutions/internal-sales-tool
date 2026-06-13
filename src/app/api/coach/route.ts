import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { anthropic } from "@/lib/anthropic";
import { MODEL, MAX_TOKENS } from "@/config";

export const runtime = "nodejs";

const RequestSchema = z.object({
  transcript: z.string().min(1, "transcript is required"),
});

const SYSTEM_PROMPT = `You are CoachLoop, a sales-call coach. Given a call transcript,
return concise, actionable coaching: what went well, what to improve, and the single
highest-leverage change for the next call. Be specific and quote the rep where useful.`;

export async function POST(req: NextRequest) {
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid request" },
      { status: 400 },
    );
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: parsed.data.transcript }],
  });

  const coaching = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return NextResponse.json({ coaching });
}
