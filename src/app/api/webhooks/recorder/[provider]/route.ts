/**
 * POST /api/webhooks/recorder/[provider] (SPEC §10, §15). DEFERRED: the live
 * signed recorder webhook (Circleback first) is out of scope this build. The
 * RecorderGateway port + normalized IncomingRecording contract are built so this
 * drops in later without touching the IngestRecording use case. v1 inbound is
 * manual paste/upload via POST /api/conversations.
 *
 * Returns 501 Not Implemented by design.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return NextResponse.json(
    {
      error: "deferred",
      detail:
        "Live recorder webhook ingestion is deferred (SPEC §15). v1 inbound is manual paste/upload via POST /api/conversations.",
      provider,
    },
    { status: 501 },
  );
}
