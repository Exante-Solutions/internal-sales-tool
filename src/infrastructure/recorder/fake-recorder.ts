/**
 * FakeRecorderAdapter — the offline/test RecorderGateway (SPEC §6.1). It drives
 * the demo and powers the v1 paste path's normalization: a raw transcript paste
 * is normalized through lib/ingest/parse into domain TranscriptSegments and
 * returned as the domain IncomingRecording contract. No network, no key — the
 * whole ingest loop runs offline (CLAUDE.md law 7).
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import type { RecorderGateway } from "@/domain/ports";
import type { IncomingRecording, IncomingParticipant } from "@/domain/conversation";
import type { TranscriptSegment } from "@/domain/coaching";
import { parseTranscript } from "@ingest";

/** A deterministic recording the demo can ingest with no integration wired. */
const SEEDED_RECORDING: IncomingRecording = {
  externalId: "fake-rec-001",
  occurredAt: "2026-06-12T17:00:00Z",
  participants: [
    { name: "Sam Rivera", email: "sam@northwind.example" },
    { name: "Demo Rep", email: "rep@seeded-team.example" },
  ],
  transcriptSegments: [
    { ts: 0, speaker: "Demo Rep", text: "Thanks for making the time — what prompted you to take this call?" },
    { ts: 12, speaker: "Sam Rivera", text: "We're drowning in manual reconciliation and it's slowing month-end close." },
    { ts: 30, speaker: "Demo Rep", text: "Got it. How much time does that cost the team each cycle?" },
    { ts: 41, speaker: "Sam Rivera", text: "Hard to say — maybe a couple of days, but I'd have to check." },
  ],
  recorderSummary:
    "Discovery call with Northwind. Pain: manual reconciliation slowing month-end close. Quantification was soft.",
  recorderActionItems: [
    "Send a one-pager on reconciliation automation",
    "Follow up to quantify time cost per close cycle",
  ],
};

export class FakeRecorderAdapter implements RecorderGateway {
  readonly provider = "fake";

  /**
   * Pull a recording by id. The seeded id returns the canned fixture; any other
   * id returns a deterministic stub so the loop never dead-ends offline.
   */
  async fetchRecording(externalId: string): Promise<IncomingRecording | null> {
    if (!externalId || externalId === SEEDED_RECORDING.externalId) return SEEDED_RECORDING;
    return {
      ...SEEDED_RECORDING,
      externalId,
    };
  }

  /**
   * Normalize a raw transcript paste into the domain IncomingRecording contract
   * (the v1 inbound path, SPEC §6.1). The pasted text is parsed through the
   * single-source-of-truth parser; metadata defaults keep the contract complete.
   */
  normalizePaste(
    raw: string,
    meta: {
      externalId?: string;
      occurredAt?: string;
      participants?: IncomingParticipant[];
      recorderSummary?: string;
      recorderActionItems?: string[];
    } = {},
  ): IncomingRecording {
    const transcriptSegments = parseTranscript(raw) as TranscriptSegment[];
    return {
      externalId: meta.externalId,
      occurredAt: meta.occurredAt ?? new Date().toISOString(),
      participants: meta.participants ?? [],
      transcriptSegments,
      recorderSummary: meta.recorderSummary,
      recorderActionItems: meta.recorderActionItems ?? [],
    };
  }
}
