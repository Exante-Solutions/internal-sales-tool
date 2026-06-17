/**
 * CirclebackRecorderAdapter — port-ready stub for the DEFERRED live Circleback
 * webhook (SPEC §6.1, §15). The RecorderGateway port and the normalized
 * IncomingRecording contract are built now so this adapter drops in later
 * without touching the ingest use case; v1 inbound is manual paste/upload via
 * FakeRecorderAdapter. Calling fetchRecording throws `deferred` by design —
 * the wiring must not select this adapter until the signed webhook ships.
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import type { RecorderGateway } from "@/domain/ports";
import type { IncomingRecording } from "@/domain/conversation";

export class CirclebackRecorderAdapter implements RecorderGateway {
  readonly provider = "circleback";

  /**
   * The webhook secret is read here (not inline elsewhere) so the live adapter's
   * config surface is established. Unused until the deferred webhook ships (§15).
   */
  constructor(
    private readonly webhookSecret = process.env.CIRCLEBACK_WEBHOOK_SECRET,
  ) {}

  async fetchRecording(_externalId: string): Promise<IncomingRecording | null> {
    throw new Error(
      "deferred: live Circleback recorder webhook is out of scope this build (SPEC §15) — v1 inbound is manual paste/upload via FakeRecorderAdapter",
    );
  }
}
