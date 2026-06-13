/**
 * In-memory CallStore — pure, dependency-free (Feature 2, SPEC §20).
 *
 * The demo/offline persistence fallback when DATABASE_URL is unset: a
 * per-user-scoped store so the upload→score→drill loop runs with no Neon and
 * verify.sh stays green. Single source of truth for the store CONTRACT
 * (round-trip + ownership isolation), asserted by the fixture test
 * (RUBRIC F2-2/F2-3). The TS MemoryCallStore adapter wraps this.
 *
 * Ownership is enforced here: a call saved by user A is never visible to B.
 */

/** @returns {{ list:(u:string)=>any[], get:(u:string,id:string)=>any, save:(u:string,c:any)=>void }} */
export function createInMemoryStore() {
  /** @type {Map<string, Map<string, any>>} userId -> (callId -> StoredCall) */
  const byUser = new Map();

  function bucket(userId) {
    let b = byUser.get(userId);
    if (!b) {
      b = new Map();
      byUser.set(userId, b);
    }
    return b;
  }

  return {
    /** Newest-first list of the user's own calls. */
    list(userId) {
      return [...bucket(userId).values()].reverse();
    },
    /** A single owned call, or null if not the user's. */
    get(userId, callId) {
      return bucket(userId).get(callId) ?? null;
    },
    /** Persist a call under its owner. callId comes from call.meta.id. */
    save(userId, call) {
      const id = call?.meta?.id;
      if (!id) throw new Error("cannot save a call without meta.id");
      bucket(userId).set(id, call);
    },
  };
}
