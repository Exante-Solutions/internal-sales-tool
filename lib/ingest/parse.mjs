/**
 * Transcript parser — pure, dependency-free (Feature 2, SPEC §20).
 *
 * The single source of truth for normalizing a raw Circleback-style transcript
 * paste into { ts, speaker, text } segments. Mirrored out of src/lib/ingest.ts
 * (which now imports it) so ingestion is zero-dep testable (RUBRIC F2-1).
 * Tolerant of the two common shapes: "[12s] Rep: text" / "[00:12] Rep: text"
 * and "Rep (0:12): text".
 */

const BRACKET = /^\[(\d{1,2}:\d{2}|\d+s?)\]\s*([^:]{1,40}?):\s*(.+)$/;
const PAREN = /^([^:(]{1,40}?)\s*\((\d{1,2}:\d{2}|\d+s?)\)\s*:\s*(.+)$/;

/** @param {string} stamp */
export function toSeconds(stamp) {
  if (stamp.includes(":")) {
    const [m, s] = stamp.split(":").map((n) => parseInt(n, 10));
    return m * 60 + s;
  }
  return parseInt(stamp.replace("s", ""), 10) || 0;
}

/** @param {string} raw @returns {{ts:number, speaker:string, text:string}[]} */
export function parseTranscript(raw) {
  const segments = [];
  let idx = 0;
  for (const line of String(raw ?? "").split(/\r?\n/)) {
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
