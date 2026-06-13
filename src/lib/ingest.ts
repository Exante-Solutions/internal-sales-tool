/**
 * Transcript ingestion — normalize a raw Circleback-style transcript paste into
 * domain TranscriptSegments. The parser itself is the pure, zero-dep
 * lib/ingest/parse.mjs (single source of truth, testable offline — RUBRIC F2-1);
 * this module just re-exports it and adds the typed buildTranscript helper.
 */

import type { Transcript, TranscriptSegment } from "@/domain/coaching";
import type { CallType } from "@/domain/rubric";
import { parseTranscript as parseRaw } from "@ingest";

export function parseTranscript(raw: string): TranscriptSegment[] {
  return parseRaw(raw) as TranscriptSegment[];
}

export function buildTranscript(
  raw: string,
  meta: { callId: string; callType: CallType; prospect: string; contact: string; contactRole: string },
): Transcript {
  return { ...meta, segments: parseTranscript(raw) };
}
