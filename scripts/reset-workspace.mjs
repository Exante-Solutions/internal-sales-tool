#!/usr/bin/env node
/**
 * Clean-workspace reset (SPEC §18.8). The documented "reset to clean workspace"
 * path so the [MANUAL] confirmation flow starts EMPTY and is driven by a real
 * transcript the operator supplies — never seeded/fixture rows.
 *
 * Run:  node scripts/with-env.mjs node scripts/reset-workspace.mjs
 *   (the loader puts DATABASE_URL into process.env without echoing it)
 *
 * TRUNCATEs the domain DATA tables (people, companies, conversations,
 * initiatives, follow-ups, timeline, participants, analysis, targets, email
 * identities, memberships, …) while PRESERVING the workspace + identity config:
 *   team, app_user, google_connection, user_integration.
 * So the operator stays signed in with their Google/Circleback connections
 * intact, but the workspace holds no demo/sales data.
 *
 * Idempotent: TRUNCATE on an already-empty table is a no-op. RESTART IDENTITY +
 * CASCADE keep FK ordering irrelevant. Prints what it cleared (row counts taken
 * before truncation). Raw SQL via @neondatabase/serverless — mirrors seed.mjs.
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Run via: node scripts/with-env.mjs node scripts/reset-workspace.mjs",
  );
  process.exit(2);
}
const sql = neon(url);

// Domain DATA tables to wipe. Order is irrelevant (CASCADE), but listed
// child→parent for readability. Identity/config tables are intentionally absent:
//   team, app_user, google_connection, user_integration  → PRESERVED.
const DATA_TABLES = [
  "item_score",
  "coaching_evaluation",
  "analysis",
  "follow_up",
  "transcript_seg",
  "participant",
  "conversation_initiative",
  "conversation",
  "initiative_target",
  "initiative_calendar_link",
  "initiative",
  "company_membership",
  "email_identity",
  "email_message",
  "timeline_entry",
  "profile_summary",
  "person",
  "company",
];

const PRESERVED = ["team", "app_user", "google_connection", "user_integration"];

async function tableExists(name) {
  const rows = await sql`select to_regclass(${"public." + name}) as oid`;
  return rows[0]?.oid != null;
}

async function countRows(name) {
  // identifier can't be parameterized — names come from a fixed allowlist above.
  const rows = await sql.query(`select count(*)::int as n from "${name}"`);
  return rows[0]?.n ?? 0;
}

async function main() {
  const present = [];
  for (const name of DATA_TABLES) {
    if (await tableExists(name)) present.push(name);
  }

  if (present.length === 0) {
    console.log("Nothing to clear — no domain data tables present.");
    return;
  }

  // Snapshot counts before truncation so we can report what was cleared.
  const before = {};
  let total = 0;
  for (const name of present) {
    const n = await countRows(name);
    before[name] = n;
    total += n;
  }

  // Single TRUNCATE … CASCADE clears everything atomically, FK order be damned.
  const list = present.map((n) => `"${n}"`).join(", ");
  await sql.query(`truncate table ${list} restart identity cascade`);

  console.log("Clean workspace reset complete.");
  console.log(`Preserved (identity/config): ${PRESERVED.join(", ")}`);
  console.log(`Cleared ${total} row(s) across ${present.length} table(s):`);
  for (const name of present) {
    if (before[name] > 0) console.log(`  - ${name}: ${before[name]}`);
  }
  if (total === 0) console.log("  (all data tables were already empty)");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
