/**
 * NeonCallStore — the durable CallStore (Feature 2, SPEC §20), used when
 * DATABASE_URL is set. Rows are keyed by (user_id, call_id) so ownership is
 * enforced at the query, mirroring the in-memory contract. Bootstraps its table
 * on first use (CREATE TABLE IF NOT EXISTS) so a fresh Neon project just works.
 * Vendor rows die here — only domain StoredCall crosses the boundary.
 */

import { neon } from "@neondatabase/serverless";
import type { CallStore } from "@/domain/ports";
import type { StoredCall } from "@/domain/store";

export class NeonCallStore implements CallStore {
  private readonly sql = neon(process.env.DATABASE_URL!);
  private ready: Promise<void> | null = null;

  private bootstrap(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.sql`CREATE TABLE IF NOT EXISTS stored_call (
          user_id    text NOT NULL,
          call_id    text NOT NULL,
          data       jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, call_id)
        )`;
      })();
    }
    return this.ready;
  }

  async list(userId: string): Promise<StoredCall[]> {
    await this.bootstrap();
    const rows = await this.sql`
      SELECT data FROM stored_call WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map((r) => r.data as StoredCall);
  }

  async get(userId: string, callId: string): Promise<StoredCall | null> {
    await this.bootstrap();
    const rows = await this.sql`
      SELECT data FROM stored_call WHERE user_id = ${userId} AND call_id = ${callId} LIMIT 1`;
    return (rows[0]?.data as StoredCall | undefined) ?? null;
  }

  async save(userId: string, call: StoredCall): Promise<void> {
    await this.bootstrap();
    await this.sql`
      INSERT INTO stored_call (user_id, call_id, data)
      VALUES (${userId}, ${call.meta.id}, ${JSON.stringify(call)}::jsonb)
      ON CONFLICT (user_id, call_id) DO UPDATE SET data = EXCLUDED.data`;
  }
}
