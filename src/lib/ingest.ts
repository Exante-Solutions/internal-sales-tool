/**
 * Transcript ingestion — normalize a raw Circleback-style transcript paste into
 * domain TranscriptSegments. Pure helper (no port: a string-parsing function
 * with no volatility, per CLAUDE.md "write the function"). Tolerant of the two
 * common shapes: "[12s] Rep: text" / "[00:12] Rep: text" and "Rep (0:12): text".
 */

import type { Transcript, TranscriptSegment } from "@/domain/coaching";
import type { CallType } from "@/domain/rubric";

const BRACKET = /^\[(\d{1,2}:\d{2}|\d+s?)\]\s*([^:]{1,40}?):\s*(.+)$/;
const PAREN = /^([^:(]{1,40}?)\s*\((\d{1,2}:\d{2}|\d+s?)\)\s*:\s*(.+)$/;

function toSeconds(stamp: string): number {
  if (stamp.includes(":")) {
    const [m, s] = stamp.split(":").map((n) => parseInt(n, 10));
    return m * 60 + s;
  }
  return parseInt(stamp.replace("s", ""), 10) || 0;
}

export function parseTranscript(raw: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let idx = 0;
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    let m = BRACKET.exec(text);
    if (m) {
      segments.push({ ts: toSeconds(m[1]), speaker: m[2].trim(), text: m[3].trim() });
      continue;
    }
    m = PAREN.exec(text);
    if (m) {
      segments.push({ ts: toSeconds(m[2]), speaker: m[1].trim(), text: m[3].trim() });
      continue;
    }
    // Fallback: a bare line continues the previous segment, or starts at idx*15s.
    if (segments.length > 0) {
      segments[segments.length - 1].text += " " + text;
    } else {
      segments.push({ ts: idx * 15, speaker: "Speaker", text });
    }
    idx++;
  }
  return segments;
}

export function buildTranscript(
  raw: string,
  meta: { callId: string; callType: CallType; prospect: string; contact: string; contactRole: string },
): Transcript {
  return { ...meta, segments: parseTranscript(raw) };
}
