/**
 * Ingestion idempotency — pure (SPEC §10, RUBRIC F3).
 *
 * A conversation's identity across re-ingests is (provider, externalId). Upsert
 * keys on that so re-ingesting the same call updates in place instead of
 * duplicating. Every conversation carries its derived `.key`.
 */

/** Stable dedup key for an ingested conversation. */
export function conversationKey(provider, externalId) {
  return `${provider}:${externalId}`;
}

/**
 * Insert-or-update `incoming` into `existing` by conversation key.
 * @param {Array} existing
 * @param {{provider:string, externalId:string}} incoming
 * @returns {{conversations:Array, created:boolean}}
 */
export function upsertConversation(existing, incoming) {
  const key = conversationKey(incoming.provider, incoming.externalId);
  const withKey = { ...incoming, key };
  const idx = (existing ?? []).findIndex((c) => c.key === key);
  if (idx === -1) {
    return { conversations: [...(existing ?? []), withKey], created: true };
  }
  const conversations = existing.map((c, i) => (i === idx ? { ...c, ...withKey } : c));
  return { conversations, created: false };
}
