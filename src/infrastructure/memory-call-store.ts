/**
 * MemoryCallStore — the offline/demo CallStore (Feature 2, SPEC §20), used when
 * DATABASE_URL is unset. Wraps the pure ownership-scoped store
 * (lib/store/in-memory.mjs) so uploaded calls survive within the session and
 * verify.sh stays green with no Neon. Persisted across dev HMR via globalThis;
 * process-local in serverless prod (good enough for the demo on-ramp).
 */

import type { CallStore } from "@/domain/ports";
import type { StoredCall } from "@/domain/store";
import { createInMemoryStore } from "@store";

type Store = ReturnType<typeof createInMemoryStore>;
const g = globalThis as unknown as { __coachloopCallStore?: Store };
const store: Store = g.__coachloopCallStore ?? (g.__coachloopCallStore = createInMemoryStore());

export class MemoryCallStore implements CallStore {
  async list(userId: string): Promise<StoredCall[]> {
    return store.list(userId) as StoredCall[];
  }
  async get(userId: string, callId: string): Promise<StoredCall | null> {
    return (store.get(userId, callId) as StoredCall | null) ?? null;
  }
  async save(userId: string, call: StoredCall): Promise<void> {
    store.save(userId, call);
  }
}
