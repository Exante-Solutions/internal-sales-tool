/**
 * FakeSecretStore — in-memory SecretStore (SPEC §6.7, §17). Lets the OAuth /
 * SyncContactEmails use cases run offline with no AWS (CLAUDE.md law 7). Token
 * material lives only in this process map; the ref it returns is what Postgres
 * would persist (never the token itself).
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import type { SecretStore } from "@/domain/ports";

export class FakeSecretStore implements SecretStore {
  private readonly store = new Map<string, string>();

  async put(ref: string, value: string): Promise<string> {
    this.store.set(ref, value);
    return ref;
  }

  async get(ref: string): Promise<string | null> {
    return this.store.has(ref) ? this.store.get(ref)! : null;
  }

  async rotate(ref: string, value: string): Promise<string> {
    this.store.set(ref, value);
    return ref;
  }

  async delete(ref: string): Promise<void> {
    this.store.delete(ref);
  }
}
