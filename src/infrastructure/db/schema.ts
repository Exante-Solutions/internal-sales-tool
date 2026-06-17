/**
 * Drizzle schema — the permanent, carefully-managed data model (SPEC §8, §8.1).
 * Migrations are generated (`drizzle-kit generate`) and committed; this is the
 * ONLY place table/column shapes are declared. Snake_case names match SPEC §8.1
 * exactly. Uniqueness invariants are encoded here (RUBRIC B5); every domain row
 * carries `team_id` where SPEC shows it (RUBRIC L5). Drizzle is imported only
 * under src/infrastructure/db/ (RUBRIC B3).
 *
 * Vendor objects (drizzle row types) die at the repository boundary — repositories
 * translate to domain types; nothing here crosses into domain/ or application/.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// ── Workspace & identity ────────────────────────────────────────────────────

export const team = pgTable("team", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const appUser = pgTable("app_user", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => team.id),
  auth0Sub: text("auth0_sub").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const googleConnection = pgTable("google_connection", {
  id: text("id").primaryKey(),
  appUserId: text("app_user_id")
    .notNull()
    .unique()
    .references(() => appUser.id),
  // denormalized from the owning app_user so the email-sync fan-out can list a
  // team's connected mailboxes without a second join (SPEC §6.4).
  teamId: text("team_id")
    .notNull()
    .references(() => team.id),
  googleSub: text("google_sub").notNull(),
  email: text("email").notNull(),
  scopes: text("scopes"),
  // tokens live in AWS Secrets Manager; Postgres stores only the ref (NO token columns).
  secretRef: text("secret_ref").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const userIntegration = pgTable(
  "user_integration",
  {
    id: text("id").primaryKey(),
    appUserId: text("app_user_id")
      .notNull()
      .references(() => appUser.id),
    // denormalized team scope (mirrors google_connection) for domain-scoped lookups.
    teamId: text("team_id")
      .notNull()
      .references(() => team.id),
    kind: text("kind").notNull(), // 'circleback'|… (open-ended; §6.8)
    scope: text("scope").notNull().default("user"), // 'user'|'domain'
    // secret lives in AWS Secrets Manager; Postgres stores only the ref (NO secret value).
    secretRef: text("secret_ref"),
    configJsonb: jsonb("config_jsonb").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (tbl) => ({
    // one config per user per kind (§6.8 UNIQUE(app_user_id, kind)).
    appUserKind: unique("user_integration_app_user_kind_uq").on(
      tbl.appUserId,
      tbl.kind,
    ),
  }),
);

// ── People & companies ──────────────────────────────────────────────────────

export const person = pgTable("person", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => team.id),
  primaryDisplayName: text("primary_display_name").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  // soft person-merge: queries follow this to the survivor.
  mergedIntoId: text("merged_into_id"),
});

export const emailIdentity = pgTable("email_identity", {
  id: text("id").primaryKey(),
  personId: text("person_id")
    .notNull()
    .references(() => person.id),
  emailNormalized: text("email_normalized").notNull().unique(),
  label: text("label").notNull(), // 'work' | 'personal' | 'former' | 'other'
  verified: boolean("verified").notNull().default(false),
  source: text("source").notNull(),
});

export const company = pgTable("company", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => team.id),
  name: text("name").notNull(),
  domain: text("domain"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const companyMembership = pgTable("company_membership", {
  id: text("id").primaryKey(),
  personId: text("person_id")
    .notNull()
    .references(() => person.id),
  companyId: text("company_id")
    .notNull()
    .references(() => company.id),
  title: text("title"),
  startedOn: text("started_on"), // ISO date (YYYY-MM-DD)
  endedOn: text("ended_on"), // invariant ended_on >= started_on guarded in domain
  isCurrent: boolean("is_current").notNull().default(false),
});

// ── Initiatives ─────────────────────────────────────────────────────────────

export const initiative = pgTable("initiative", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => team.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'market'|'use_case'|'persona'|'workflow'|'org'
  goalMd: text("goal_md").notNull().default(""),
  hypothesisMd: text("hypothesis_md").notNull().default(""),
  status: text("status").notNull().default("active"), // 'active'|'paused'|'done'
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const initiativeCalendarLink = pgTable("initiative_calendar_link", {
  id: text("id").primaryKey(),
  initiativeId: text("initiative_id")
    .notNull()
    .references(() => initiative.id),
  appUserId: text("app_user_id")
    .notNull()
    .references(() => appUser.id),
  provider: text("provider").notNull(),
  linkId: text("link_id").notNull(),
  label: text("label"),
});

export const initiativeTarget = pgTable(
  "initiative_target",
  {
    id: text("id").primaryKey(),
    initiativeId: text("initiative_id")
      .notNull()
      .references(() => initiative.id),
    personId: text("person_id")
      .notNull()
      .references(() => person.id),
    // 'to_contact'|'contacted'|'responded'|'engaged'|'passed'
    status: text("status").notNull().default("to_contact"),
    reasonMd: text("reason_md"),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    initiativePerson: unique("initiative_target_initiative_person_uq").on(
      t.initiativeId,
      t.personId,
    ),
  }),
);

// ── Conversations ───────────────────────────────────────────────────────────

export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id),
    source: text("source").notNull(), // 'recorder'|'pasted'|'manual'
    provider: text("provider"),
    externalId: text("external_id"),
    title: text("title").notNull(),
    reasonMd: text("reason_md").notNull().default(""),
    outcomeMd: text("outcome_md").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    // idempotent ingest — collapses recorder webhook redelivery.
    providerExternal: unique("conversation_provider_external_uq").on(
      t.provider,
      t.externalId,
    ),
  }),
);

export const conversationInitiative = pgTable(
  "conversation_initiative",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id),
    initiativeId: text("initiative_id")
      .notNull()
      .references(() => initiative.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.conversationId, t.initiativeId] }),
  }),
);

export const transcriptSeg = pgTable("transcript_seg", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id),
  idx: integer("idx").notNull(),
  speaker: text("speaker").notNull(),
  text: text("text").notNull(),
  tsSeconds: integer("ts_seconds"),
});

export const participant = pgTable("participant", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id),
  personId: text("person_id")
    .notNull()
    .references(() => person.id),
  emailUsed: text("email_used").notNull(),
  // affiliation snapshot frozen at conversation time.
  companyAtTime: text("company_at_time"),
  roleAtTime: text("role_at_time"),
});

// ── Analysis & coaching add-on ──────────────────────────────────────────────

export const analysis = pgTable("analysis", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id),
  recorderSummaryMd: text("recorder_summary_md"),
  summaryMd: text("summary_md"),
  sentiment: text("sentiment"), // 'positive'|'neutral'|'negative'
  whatWeLearnedJsonb: jsonb("what_we_learned_jsonb").notNull().default(sql`'[]'::jsonb`),
  signalsJsonb: jsonb("signals_jsonb").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const coachingEvaluation = pgTable("coaching_evaluation", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id),
  rubricId: text("rubric_id").notNull(),
  score100: integer("score_100").notNull(),
  band: text("band").notNull(),
  headlineMd: text("headline_md").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const itemScore = pgTable("item_score", {
  id: text("id").primaryKey(),
  coachingEvaluationId: text("coaching_evaluation_id")
    .notNull()
    .references(() => coachingEvaluation.id),
  rubricItemId: integer("rubric_item_id").notNull(),
  score15: integer("score_1_5").notNull(),
  rationaleMd: text("rationale_md").notNull().default(""),
  citeTsSeconds: integer("cite_ts_seconds"),
  citeQuote: text("cite_quote"),
});

export const followUp = pgTable("follow_up", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id),
  text: text("text").notNull(),
  ownerPersonId: text("owner_person_id"),
  ownerUserId: text("owner_user_id"),
  dueOn: text("due_on"), // ISO date (YYYY-MM-DD)
  status: text("status").notNull().default("open"), // 'open'|'done'
  // archive = archived_at set; archived rows hidden from default lists (§18.6).
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  source: text("source").notNull(), // 'recorder'|'ai'|'manual'
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ── Profile (append-only timeline + rollup + permanent email) ───────────────

export const timelineEntry = pgTable("timeline_entry", {
  id: text("id").primaryKey(),
  subjectType: text("subject_type").notNull(), // 'person'|'company'
  subjectId: text("subject_id").notNull(),
  kind: text("kind").notNull(), // 'conversation'|'note'|'email'|'calendar'
  refId: text("ref_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  bodyMd: text("body_md").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const profileSummary = pgTable("profile_summary", {
  id: text("id").primaryKey(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  summaryMd: text("summary_md").notNull().default(""),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  sourceEntryCount: integer("source_entry_count").notNull().default(0),
});

export const emailMessage = pgTable("email_message", {
  id: text("id").primaryKey(),
  personId: text("person_id")
    .notNull()
    .references(() => person.id),
  rfcMessageId: text("rfc_message_id").notNull().unique(),
  threadId: text("thread_id"),
  fromEmail: text("from_email").notNull(),
  toEmailsJsonb: jsonb("to_emails_jsonb").notNull().default(sql`'[]'::jsonb`),
  subject: text("subject"),
  snippet: text("snippet"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  syncedByUserId: text("synced_by_user_id").notNull(),
});
