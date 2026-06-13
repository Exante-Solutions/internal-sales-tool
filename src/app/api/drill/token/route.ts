/**
 * POST /api/drill/token — mint an ElevenLabs signed URL for the realtime voice
 * drill (Claude brain via the native LLM dropdown). The server-held xi-api-key
 * never reaches the client. Degrades gracefully (501 with a clear reason) when
 * ElevenLabs keys are unset, so the build/demo falls back to the text drill.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { error: "voice drill not configured", reason: "ELEVENLABS_API_KEY/ELEVENLABS_AGENT_ID unset — using text drill" },
      { status: 501 },
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "elevenlabs rejected the request" }, { status: 502 });
    }
    const data = (await res.json()) as { signed_url?: string };
    return NextResponse.json({ signedUrl: data.signed_url, agentId });
  } catch {
    return NextResponse.json({ error: "could not reach elevenlabs" }, { status: 502 });
  }
}
