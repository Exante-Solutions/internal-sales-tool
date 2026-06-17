#!/usr/bin/env node
/**
 * Idempotent live-Neon seed for the Discovery Workspace (SPEC §8, §8.1).
 *
 * Run:  node scripts/with-env.mjs node scripts/seed.mjs
 *   (the loader puts DATABASE_URL into process.env without echoing it)
 *
 * Raw SQL via @neondatabase/serverless. Every insert is idempotent
 * (ON CONFLICT DO NOTHING / DO UPDATE) keyed on stable ids, so re-running
 * neither duplicates rows nor errors. Column names + enum literals mirror
 * src/infrastructure/db/schema.ts EXACTLY (snake_case).
 *
 * NOTE on the team id: the workspace id must equal the shared constant
 * DEFAULT_TEAM_ID exported from src/domain/tenancy.ts. That module is TS, not
 * importable from a plain .mjs without a build step, so the literal is mirrored
 * here with this comment. Keep in sync if the constant ever changes.
 *   src/domain/tenancy.ts -> export const DEFAULT_TEAM_ID = "seeded-team";
 */
import { neon } from "@neondatabase/serverless";

const DEFAULT_TEAM_ID = "seeded-team"; // == src/domain/tenancy.ts DEFAULT_TEAM_ID
const DEFAULT_TEAM_NAME = "Discovery Workspace"; // == DEFAULT_TEAM_NAME
const SEED_BY = "seed-script"; // created_by / added_by / synced_by marker

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Run via: node scripts/with-env.mjs node scripts/seed.mjs",
  );
  process.exit(2);
}
const sql = neon(url);

// Stable ids — re-running the seed re-targets the same rows (idempotent).
const ID = {
  // companies
  coAcme: "co-acme",
  coGlobex: "co-globex",
  // people
  pSam: "per-sam-reyes", // two emails + past(Globex)+current(Acme) memberships
  pDana: "per-dana-okafor",
  pLee: "per-lee-zhang",
  // email identities
  eiSamWork: "eid-sam-work",
  eiSamPersonal: "eid-sam-personal",
  eiDana: "eid-dana-work",
  eiLee: "eid-lee-work",
  // memberships
  memSamGlobex: "mem-sam-globex", // past
  memSamAcme: "mem-sam-acme", // current
  memDanaAcme: "mem-dana-acme",
  memLeeGlobex: "mem-lee-globex",
  // initiatives
  initPersona: "init-finance-persona",
  initMarket: "init-midmarket",
  // initiative targets (prospect list, no conversation)
  tgtLee: "tgt-lee-midmarket",
  tgtDana: "tgt-dana-persona",
  // conversation graph
  conv: "conv-acme-discovery",
  partSam: "part-conv-sam",
  followUp: "fu-conv-sam-pricing",
  analysis: "ana-conv-acme",
};

const counts = {};
const bump = (k, n = 1) => {
  counts[k] = (counts[k] ?? 0) + n;
};

async function main() {
  // ── Team (must exist before any team_id FK row) ───────────────────────────
  await sql`
    insert into team (id, name)
    values (${DEFAULT_TEAM_ID}, ${DEFAULT_TEAM_NAME})
    on conflict (id) do update set name = excluded.name
  `;
  bump("team");

  // ── Companies ─────────────────────────────────────────────────────────────
  for (const [id, name, domain] of [
    [ID.coAcme, "Acme Corp", "acme.com"],
    [ID.coGlobex, "Globex Industries", "globex.com"],
  ]) {
    await sql`
      insert into company (id, team_id, name, domain)
      values (${id}, ${DEFAULT_TEAM_ID}, ${name}, ${domain})
      on conflict (id) do update set name = excluded.name, domain = excluded.domain
    `;
    bump("company");
  }

  // ── People ──────────────────────────────────────────────────────────────────
  for (const [id, name] of [
    [ID.pSam, "Sam Reyes"],
    [ID.pDana, "Dana Okafor"],
    [ID.pLee, "Lee Zhang"],
  ]) {
    await sql`
      insert into person (id, team_id, primary_display_name, created_by)
      values (${id}, ${DEFAULT_TEAM_ID}, ${name}, ${SEED_BY})
      on conflict (id) do update set primary_display_name = excluded.primary_display_name
    `;
    bump("person");
  }

  // ── Email identities (Sam has TWO — the dedupe/identity story) ──────────────
  // label: 'work'|'personal'|'former'|'other'; source: free text. unique(email_normalized).
  for (const [id, personId, email, label] of [
    [ID.eiSamWork, ID.pSam, "sam.reyes@acme.com", "work"],
    [ID.eiSamPersonal, ID.pSam, "sam.reyes@gmail.com", "personal"],
    [ID.eiDana, ID.pDana, "dana.okafor@acme.com", "work"],
    [ID.eiLee, ID.pLee, "lee.zhang@globex.com", "work"],
  ]) {
    await sql`
      insert into email_identity (id, person_id, email_normalized, label, verified, source)
      values (${id}, ${personId}, ${email}, ${label}, true, ${"seed"})
      on conflict (email_normalized) do nothing
    `;
    bump("email_identity");
  }

  // ── Company memberships (Sam: past Globex + current Acme) ───────────────────
  for (const [id, personId, companyId, title, startedOn, endedOn, isCurrent] of [
    [ID.memSamGlobex, ID.pSam, ID.coGlobex, "Finance Analyst", "2019-02-01", "2023-08-31", false],
    [ID.memSamAcme, ID.pSam, ID.coAcme, "VP Finance", "2023-09-01", null, true],
    [ID.memDanaAcme, ID.pDana, ID.coAcme, "Director of Ops", "2021-04-01", null, true],
    [ID.memLeeGlobex, ID.pLee, ID.coGlobex, "Procurement Lead", "2020-06-01", null, true],
  ]) {
    await sql`
      insert into company_membership
        (id, person_id, company_id, title, started_on, ended_on, is_current)
      values
        (${id}, ${personId}, ${companyId}, ${title}, ${startedOn}, ${endedOn}, ${isCurrent})
      on conflict (id) do update set
        title = excluded.title,
        started_on = excluded.started_on,
        ended_on = excluded.ended_on,
        is_current = excluded.is_current
    `;
    bump("company_membership");
  }

  // ── Initiatives (one 'persona', one 'market') ───────────────────────────────
  // type: 'market'|'use_case'|'persona'|'workflow'|'org'; status: 'active'|'paused'|'done'.
  for (const [id, name, type, goalMd, hypothesisMd, status] of [
    [
      ID.initPersona,
      "Finance leaders persona",
      "persona",
      "Understand how VP Finance buyers evaluate spend-control tooling.",
      "Finance leaders adopt fastest when ROI is provable inside one quarter.",
      "active",
    ],
    [
      ID.initMarket,
      "Mid-market manufacturing",
      "market",
      "Map demand in 200-1000 headcount manufacturers.",
      "Mid-market manufacturers feel acute pain from manual reconciliation.",
      "active",
    ],
  ]) {
    await sql`
      insert into initiative
        (id, team_id, name, type, goal_md, hypothesis_md, status, created_by)
      values
        (${id}, ${DEFAULT_TEAM_ID}, ${name}, ${type}, ${goalMd}, ${hypothesisMd}, ${status}, ${SEED_BY})
      on conflict (id) do update set
        name = excluded.name,
        type = excluded.type,
        goal_md = excluded.goal_md,
        hypothesis_md = excluded.hypothesis_md,
        status = excluded.status
    `;
    bump("initiative");
  }

  // ── Initiative targets (prospect list — no conversation yet) ────────────────
  // status: 'to_contact'|'contacted'|'responded'|'engaged'|'passed'. unique(initiative_id, person_id).
  for (const [id, initiativeId, personId, status, reasonMd] of [
    [ID.tgtLee, ID.initMarket, ID.pLee, "to_contact", "Procurement lead at a target mid-market manufacturer."],
    [ID.tgtDana, ID.initPersona, ID.pDana, "contacted", "Ops director adjacent to the finance buying committee."],
  ]) {
    await sql`
      insert into initiative_target
        (id, initiative_id, person_id, status, reason_md, added_by)
      values
        (${id}, ${initiativeId}, ${personId}, ${status}, ${reasonMd}, ${SEED_BY})
      on conflict (initiative_id, person_id) do update set
        status = excluded.status,
        reason_md = excluded.reason_md
    `;
    bump("initiative_target");
  }

  // ── Conversation (source 'pasted') ──────────────────────────────────────────
  // source: 'recorder'|'pasted'|'manual'.
  const occurredAt = "2026-06-11T17:00:00Z";
  await sql`
    insert into conversation
      (id, team_id, source, provider, external_id, title, reason_md, outcome_md, occurred_at, created_by)
    values
      (${ID.conv}, ${DEFAULT_TEAM_ID}, ${"pasted"}, ${null}, ${null},
       ${"Acme discovery — spend controls"},
       ${"Discovery call with Acme VP Finance to qualify pain around manual reconciliation."},
       ${"Strong interest; agreed to a follow-up demo. Pricing question outstanding."},
       ${occurredAt}, ${SEED_BY})
    on conflict (id) do update set
      title = excluded.title,
      reason_md = excluded.reason_md,
      outcome_md = excluded.outcome_md
  `;
  bump("conversation");

  // link the conversation to the persona initiative (closed loop)
  await sql`
    insert into conversation_initiative (conversation_id, initiative_id)
    values (${ID.conv}, ${ID.initPersona})
    on conflict do nothing
  `;
  bump("conversation_initiative");

  // transcript segments
  const segments = [
    { speaker: "Rep", text: "Thanks for making time, Sam. What prompted you to look at this now?", ts: 12 },
    { speaker: "Sam Reyes", text: "Month-end close takes us eight days of manual reconciliation. It's painful.", ts: 41 },
    { speaker: "Rep", text: "What's the cost of that today — people, or missed insight?", ts: 70 },
    { speaker: "Sam Reyes", text: "Both. Two analysts effectively full-time, and we're always reacting late.", ts: 96 },
    { speaker: "Rep", text: "If we cut that to two days, what would that unlock for your team?", ts: 130 },
  ];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    await sql`
      insert into transcript_seg (id, conversation_id, idx, speaker, text, ts_seconds)
      values (${`${ID.conv}:seg:${i}`}, ${ID.conv}, ${i}, ${s.speaker}, ${s.text}, ${s.ts})
      on conflict (id) do nothing
    `;
    bump("transcript_seg");
  }

  // participant — company_at_time snapshot frozen at conversation time
  await sql`
    insert into participant
      (id, conversation_id, person_id, email_used, company_at_time, role_at_time)
    values
      (${ID.partSam}, ${ID.conv}, ${ID.pSam}, ${"sam.reyes@acme.com"}, ${"Acme Corp"}, ${"VP Finance"})
    on conflict (id) do nothing
  `;
  bump("participant");

  // analysis row — what we learned + signals (jsonb)
  const whatWeLearned = [
    { text: "Month-end close is 8 days, mostly manual reconciliation." },
    { text: "Two analysts effectively full-time on the process." },
  ];
  const signals = [{ kind: "pain", text: "Manual reconciliation; reacting late to numbers." }];
  await sql`
    insert into analysis
      (id, conversation_id, summary_md, sentiment, what_we_learned_jsonb, signals_jsonb)
    values
      (${ID.analysis}, ${ID.conv},
       ${"Acme has acute month-end close pain (8 days, 2 analysts). Quantified pain, clear next step to demo."},
       ${"positive"},
       ${JSON.stringify(whatWeLearned)}::jsonb,
       ${JSON.stringify(signals)}::jsonb)
    on conflict (id) do update set
      summary_md = excluded.summary_md,
      sentiment = excluded.sentiment,
      what_we_learned_jsonb = excluded.what_we_learned_jsonb,
      signals_jsonb = excluded.signals_jsonb
  `;
  bump("analysis");

  // follow-up — source: 'recorder'|'ai'|'manual'; status: 'open'|'done'
  await sql`
    insert into follow_up
      (id, conversation_id, text, owner_person_id, owner_user_id, due_on, status, source)
    values
      (${ID.followUp}, ${ID.conv},
       ${"Send pricing breakdown for a 2-analyst rollout."},
       ${ID.pSam}, ${null}, ${"2026-06-18"}, ${"open"}, ${"ai"})
    on conflict (id) do update set
      text = excluded.text,
      due_on = excluded.due_on,
      status = excluded.status
  `;
  bump("follow_up");

  // ── Summary ─────────────────────────────────────────────────────────────────
  const order = [
    "team",
    "company",
    "person",
    "email_identity",
    "company_membership",
    "initiative",
    "initiative_target",
    "conversation",
    "conversation_initiative",
    "transcript_seg",
    "participant",
    "analysis",
    "follow_up",
  ];
  console.log(`Seed complete for workspace "${DEFAULT_TEAM_ID}". Rows upserted:`);
  for (const k of order) console.log(`  ${k.padEnd(22)} ${counts[k] ?? 0}`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`  ${"TOTAL".padEnd(22)} ${total}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
  });
