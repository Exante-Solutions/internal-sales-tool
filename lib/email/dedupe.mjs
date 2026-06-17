/**
 * Gmail message dedupe — pure (SPEC §10, RUBRIC J2/J3).
 *
 * The same RFC Message-ID can arrive from multiple synced mailboxes (sender's
 * and recipient's). Dedupe collapses them to one logical message keyed by
 * rfcMessageId, preserving first-seen order. This makes a thread synced from two
 * mailboxes appear once, not twice.
 */

/**
 * @param {Array<{rfcMessageId:string}>} messages
 * @returns {Array} deduped, first-seen order preserved
 */
export function dedupeMessages(messages) {
  const seen = new Set();
  const out = [];
  for (const m of messages ?? []) {
    const id = m.rfcMessageId;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(m);
  }
  return out;
}
