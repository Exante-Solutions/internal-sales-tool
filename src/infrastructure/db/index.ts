/**
 * Neon/Drizzle client factory (SPEC §8). Reads DATABASE_URL lazily through a
 * fail-fast accessor (the `getAnthropicApiKey()` pattern, CLAUDE.md conventions)
 * so importing this module never throws at build time — only constructing the
 * client without a URL does. The client is memoized per-URL for serverless reuse.
 *
 * Drizzle is imported only under src/infrastructure/db/ (RUBRIC B3).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Fail-fast accessor for the connection string. */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL — copy .env.example to .env (or run offline with the in-memory repositories).");
  }
  return url;
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: { url: string; db: Database } | null = null;

/**
 * The Drizzle client over Neon HTTP, bound to the full schema. Lazily created
 * and memoized; re-created only if DATABASE_URL changes (test/dev convenience).
 */
export function getDb(): Database {
  const url = getDatabaseUrl();
  if (cached && cached.url === url) return cached.db;
  const db = drizzle(neon(url), { schema });
  cached = { url, db };
  return db;
}

export { schema };
