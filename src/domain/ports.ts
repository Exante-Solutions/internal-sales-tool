/**
 * Ports — domain-owned interfaces. Infrastructure implements these; the
 * application layer depends only on them. The one genuinely volatile external
 * dependency (the Anthropic SDK) sits behind ScorerGateway / RescorerGateway /
 * DrillScenarioGateway. Swapping the real adapter for the fake changes only the
 * composition root — never domain/ or application/ (CLAUDE.md law 5).
 */

import type { Transcript, Evaluation, FumbledMoment, DrillScenario, Rescore } from "./coaching";
import type { CoachBriefing, SkillGap } from "./briefing";
import type { Session } from "./session";
import type { StoredCall } from "./store";
import type { TeamCoachingAction, TeamItemStat } from "./team";
import type { CallType } from "./rubric";
import type { Person, EmailIdentity, IdentityResolution } from "./person";
import type { GoogleConnection } from "./connection";
import type { AppUser } from "./tenancy";
import type { Company, CompanyMembership } from "./company";
import type {
  Initiative,
  InitiativeTarget,
  InitiativeCalendarLink,
  TargetStatus,
} from "./initiative";
import type {
  Conversation,
  IncomingRecording,
  Participant,
} from "./conversation";
import type { Analysis } from "./analysis";
import type { TimelineEntry, ProfileSummary, EmailMessage, SubjectType } from "./profile";
import type { FollowUp } from "./followup";
import type { UserIntegration, IntegrationKind, IntegrationScope } from "./integration";

export interface ScorerGateway {
  /** Run the 4-pass eval (adversarial: score → refute → reconcile). */
  score(transcript: Transcript): Promise<Evaluation>;
}

export interface CoachBriefingGateway {
  /** Synthesize the sales-leader coaching prep for the drilled skill, aware of
   * the rep's other gaps but focused on the one move (Feature 1, SPEC §19). */
  brief(moment: FumbledMoment, gaps: SkillGap[], transcript: Transcript): Promise<CoachBriefing>;
  /** Answer the rep's single follow-up question, in the coach's voice. */
  answer(question: string, briefing: CoachBriefing, transcript: Transcript): Promise<string>;
}

export interface CallStore {
  /** The user's own calls, newest first (Feature 2, SPEC §20). */
  list(userId: string): Promise<StoredCall[]>;
  /** A single owned call, or null if it isn't the user's. */
  get(userId: string, callId: string): Promise<StoredCall | null>;
  /** Persist a user-owned call. */
  save(userId: string, call: StoredCall): Promise<void>;
}

export interface SessionGateway {
  /** The current user/team (seeded demo team until Auth0 is wired, Feature 3). */
  current(): Promise<Session>;
}

export interface TeamCoachGateway {
  /** Synthesize the agentic coaching action for a call type (Feature 4, §22). */
  action(callType: CallType, stats: TeamItemStat[]): Promise<TeamCoachingAction>;
}

export interface DrillScenarioGateway {
  /** Generate-and-filter a drill scenario from the fumbled moment. */
  scenario(moment: FumbledMoment, transcript: Transcript): Promise<DrillScenario>;
}

export interface RescorerGateway {
  /** Score the drill transcript on the single drilled item's 1–5 anchors. */
  rescore(
    drillTranscript: string,
    moment: FumbledMoment,
    callId: string,
  ): Promise<Rescore>;
}

// ── Discovery Workspace ports (SPEC §6, §7.1, §8) ───────────────────────────
//
// Every external service is a port + a real adapter + a FAKE (CLAUDE.md law 7,
// SPEC §7.6) so ingest→analysis→profile runs offline with no keys/DB. Only
// domain-owned data crosses these boundaries; vendor objects die at the adapter.

/**
 * Recorder ingestion (SPEC §6.1). The paste path uses this now; the deferred
 * Circleback/Fathom webhooks drop in as new adapters behind the same port. The
 * adapter normalizes its vendor payload into a domain `IncomingRecording`.
 */
export interface RecorderGateway {
  /** The recorder provider key (e.g. "circleback", "fathom", "fake"). */
  readonly provider: string;
  /** Pull/normalize a recording by its provider id into the domain contract. */
  fetchRecording(externalId: string): Promise<IncomingRecording | null>;
}

/** A normalized inbound calendar event (SPEC §6.3) — vendor-agnostic. */
export interface CalendarEvent {
  externalId: string;
  /** Booking link / event-type id; maps to an initiative via InitiativeCalendarLink. */
  linkId?: string;
  status: "created" | "updated" | "cancelled";
  start: string;
  end: string;
  attendees: { name?: string; email: string }[];
  initiativeHint?: string;
}

/**
 * Calendar (SPEC §6.3). v1 is a normalized inbound webhook; a provider
 * (Cal.com/Calendly/Google) is wired later behind this port.
 */
export interface CalendarGateway {
  readonly provider: string;
  /** Normalize a raw provider event payload into the domain CalendarEvent. */
  normalizeEvent(raw: unknown): Promise<CalendarEvent>;
}

/** A raw-ish thread message pulled from a mailbox, already domain-shaped. */
export interface GmailThreadMessage {
  rfcMessageId: string;
  threadId?: string;
  fromEmail: string;
  toEmails: string[];
  subject?: string;
  snippet?: string;
  occurredAt: string;
  /** Which user's mailbox this copy came from. */
  mailboxUserId: string;
}

/**
 * Gmail (SPEC §6.4). On-demand, per-contact pull across all connected team
 * mailboxes; the use case dedupes by RFC Message-ID. Tokens are read via the
 * SecretStore (never inline). Adapters: GoogleGmailAdapter, FakeGmailAdapter.
 */
export interface GmailGateway {
  /**
   * Pull threads where the person (matched by any of their emails) is a
   * sender/recipient, from one connected mailbox identified by `secretRef`.
   */
  fetchMessagesForEmails(
    emails: string[],
    mailboxUserId: string,
    secretRef: string,
  ): Promise<GmailThreadMessage[]>;
}

/**
 * Analysis (SPEC §6.5). Produces the discovery fields and the profile AI rollup.
 * May wrap the same Anthropic client as ScorerGateway, but stays a distinct port
 * — the on-demand playbook check (ScorerGateway) and discovery enrichment have
 * different volatility. FakeAnalysisGateway powers offline runs.
 */
export interface AnalysisGateway {
  /** Produce the discovery fields for a conversation from its available text. */
  analyzeConversation(conversation: Conversation): Promise<Analysis>;
  /** Roll a profile's append-only timeline up into a fresh AI summary. */
  summarizeProfile(
    subjectType: SubjectType,
    subjectId: string,
    timeline: TimelineEntry[],
  ): Promise<ProfileSummary>;
}

/**
 * User/domain integration config (SPEC §6.8, §18.1). The generalized home for
 * per-user/per-domain integration credentials (Circleback first). `set` writes
 * any secret to the SecretStore and persists ONLY the resulting `secretRef` in
 * the user_integration row — the raw secret never touches Postgres. Adding an
 * integration = a new `kind`, not a new mechanism.
 *
 * `scopeKey` is the owning app_user id for a user-scoped integration (and the
 * team id for a domain-scoped one). Adapters: Neon-backed + an in-memory fake.
 */
export interface IntegrationConfigStore {
  /** The stored config for a scope's integration kind, or null if unset. */
  get(scopeKey: string, kind: IntegrationKind): Promise<UserIntegration | null>;
  /**
   * Upsert the config for `kind` under `scopeKey`. When `secret` is provided it
   * is written to the SecretStore and only the ref is persisted; when omitted
   * the existing secretRef is preserved. UNIQUE(appUserId, kind) backs the upsert.
   */
  set(
    scopeKey: string,
    kind: IntegrationKind,
    input: {
      config?: Record<string, unknown>;
      secret?: string;
      scope?: IntegrationScope;
      teamId: string;
    },
  ): Promise<UserIntegration>;
  /** Remove the config (and its SecretStore secret) for a scope's kind. */
  clear(scopeKey: string, kind: IntegrationKind): Promise<void>;
}

/**
 * Secrets (SPEC §6.7). Per-user OAuth tokens live in AWS Secrets Manager (or a
 * fake in-memory store offline); Postgres stores only a `secret_ref`.
 */
export interface SecretStore {
  /** Store token material; returns the secret_ref (ARN/name) to persist. */
  put(ref: string, value: string): Promise<string>;
  /** Read token material by ref, or null if absent. */
  get(ref: string): Promise<string | null>;
  /** Rewrite the secret (server-side token refresh); returns the secret_ref. */
  rotate(ref: string, value: string): Promise<string>;
  /** Remove the secret. */
  delete(ref: string): Promise<void>;
}

// ── Repository ports (SPEC §8) ──────────────────────────────────────────────
// Only infrastructure/db imports Drizzle; a Fake/in-memory impl keeps
// application/ tests offline. All methods exchange domain types only.

export interface PersonRepository {
  /** A single person by id, following `mergedIntoId` to the survivor. */
  get(teamId: string, personId: string): Promise<Person | null>;
  /** Find the person owning a given (normalized) email, or null. */
  findByEmail(teamId: string, emailNormalized: string): Promise<Person | null>;
  /**
   * List/search people (SPEC §10 /api/people). Optional filters by company,
   * by an email substring, or by initiative membership.
   */
  list(
    teamId: string,
    filter?: {
      companyId?: string;
      email?: string;
      initiativeId?: string;
      query?: string;
    },
  ): Promise<Person[]>;
  save(person: Person): Promise<void>;
  /** Add/attach an email identity to a person. */
  addEmail(personId: string, email: EmailIdentity): Promise<void>;
  /**
   * Confirm a merge: point `absorbedId` at `survivorId` and unify identities,
   * memberships, and history under the survivor. Returns the survivor.
   */
  merge(teamId: string, survivorId: string, absorbedId: string): Promise<Person>;
}

export interface CompanyRepository {
  get(teamId: string, companyId: string): Promise<Company | null>;
  findByDomain(teamId: string, domain: string): Promise<Company | null>;
  list(teamId: string): Promise<Company[]>;
  save(company: Company): Promise<void>;
  /** Memberships for a company (current and/or past). */
  membershipsFor(companyId: string): Promise<CompanyMembership[]>;
  saveMembership(membership: CompanyMembership): Promise<void>;
}

export interface InitiativeRepository {
  get(teamId: string, initiativeId: string): Promise<Initiative | null>;
  list(
    teamId: string,
    filter?: { type?: string; status?: string },
  ): Promise<Initiative[]>;
  save(initiative: Initiative): Promise<void>;
  /**
   * Hard-delete an initiative (BUG_FIX B6): removes its initiative_target and
   * conversation_initiative rows, then the initiative row itself. Conversations
   * are PRESERVED — only their link to this initiative is dropped.
   */
  delete(teamId: string, initiativeId: string): Promise<void>;

  // Prospect list (targets) — SPEC §10 /api/initiatives/[id]/targets
  listTargets(initiativeId: string): Promise<InitiativeTarget[]>;
  addTarget(target: InitiativeTarget): Promise<void>;
  setTargetStatus(
    initiativeId: string,
    personId: string,
    status: TargetStatus,
    reasonMd?: string,
  ): Promise<void>;
  removeTarget(initiativeId: string, personId: string): Promise<void>;

  // Calendar links — SPEC §6.3 (linkId → initiative)
  listCalendarLinks(teamId: string): Promise<InitiativeCalendarLink[]>;
  saveCalendarLink(link: InitiativeCalendarLink): Promise<void>;
}

export interface ConversationRepository {
  get(teamId: string, conversationId: string): Promise<Conversation | null>;
  /** Lookup by the idempotency key for upsert (SPEC §6.1, §8.1 UNIQUE). */
  findByExternalId(
    teamId: string,
    provider: string,
    externalId: string,
  ): Promise<Conversation | null>;
  /**
   * List conversations; `unassignedOnly` returns the Unassigned inbox (SPEC
   * §6.2), `initiativeId` returns those linked to one initiative.
   */
  list(
    teamId: string,
    filter?: {
      initiativeId?: string;
      unassignedOnly?: boolean;
      companyAtTime?: string;
      personId?: string;
    },
  ): Promise<Conversation[]>;
  save(conversation: Conversation): Promise<void>;
  saveParticipant(participant: Participant): Promise<void>;

  /**
   * Manually attach a person to a conversation (BUG_FIX B2). The affiliation
   * snapshot (emailUsed + companyAtTime + roleAtTime) is frozen by the caller at
   * conversation time and passed in; the repo mints the participant row.
   * UNIQUE(conversationId, personId) — a repeat call is idempotent.
   */
  addParticipant(
    conversationId: string,
    snapshot: {
      personId: string;
      emailUsed: string;
      companyAtTime?: string | null;
      roleAtTime?: string | null;
    },
  ): Promise<Participant>;
  /** Detach a manually-added person from a conversation (BUG_FIX B2). */
  removeParticipant(conversationId: string, personId: string): Promise<void>;

  // Many-to-many initiative links (SPEC §10 /conversations/[id]/initiatives)
  linkInitiative(conversationId: string, initiativeId: string): Promise<void>;
  unlinkInitiative(conversationId: string, initiativeId: string): Promise<void>;

  // Analysis attached to a conversation (incl. on-demand playbook eval)
  getAnalysis(conversationId: string): Promise<Analysis | null>;
  saveAnalysis(analysis: Analysis): Promise<void>;
}

export interface TimelineRepository {
  /** The append-only timeline for a subject, oldest→newest by occurredAt. */
  list(subjectType: SubjectType, subjectId: string): Promise<TimelineEntry[]>;
  /** Append a single entry (never mutates existing ones). */
  append(entry: TimelineEntry): Promise<void>;
  getSummary(
    subjectType: SubjectType,
    subjectId: string,
  ): Promise<ProfileSummary | null>;
  saveSummary(summary: ProfileSummary): Promise<void>;
}

export interface FollowUpRepository {
  /**
   * Follow-ups on a conversation. Archived ones (archivedAt set) are excluded
   * unless `opts.includeArchived` is true (SPEC §18.6).
   */
  listForConversation(
    conversationId: string,
    opts?: { includeArchived?: boolean },
  ): Promise<FollowUp[]>;
  /** Follow-ups surfaced on a person (owner or participant linkage); excludes archived. */
  listForPerson(
    personId: string,
    opts?: { includeArchived?: boolean },
  ): Promise<FollowUp[]>;
  /** Follow-ups surfaced across an initiative's linked conversations; excludes archived. */
  listForInitiative(
    initiativeId: string,
    opts?: { includeArchived?: boolean },
  ): Promise<FollowUp[]>;
  save(followUp: FollowUp): Promise<void>;
  setStatus(followUpId: string, status: FollowUp["status"]): Promise<void>;
  /**
   * Patch a follow-up's lifecycle fields (SPEC §18.6): mark complete
   * (`status:'done'`) and/or archive (`archivedAt` set, or null to unarchive).
   * Only the provided fields change.
   */
  update(
    followUpId: string,
    patch: { status?: FollowUp["status"]; archivedAt?: string | null },
  ): Promise<void>;
}

export interface EmailMessageRepository {
  /** Permanent, deduped messages attributed to a person (SPEC §6.4). */
  listForPerson(personId: string): Promise<EmailMessage[]>;
  findByRfcMessageId(rfcMessageId: string): Promise<EmailMessage | null>;
  /** Idempotent persist (UNIQUE rfc_message_id collapses cross-mailbox dupes). */
  upsert(message: EmailMessage): Promise<void>;
}

/**
 * Workspace users (SPEC §6.6, §8.1, §9). Provisioned from an Auth0 subject and
 * attached to DEFAULT_TEAM_ID. Only infrastructure/db imports Drizzle; a memory
 * impl keeps application/ offline. Domain types only cross this boundary.
 */
export interface AppUserRepository {
  /**
   * Idempotently provision/update the workspace user for an Auth0 subject
   * (UNIQUE auth0_sub). Returns the resulting AppUser. `teamId` defaults to
   * DEFAULT_TEAM_ID at the call site when omitted.
   */
  upsertByAuth0Sub(input: {
    auth0Sub: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    teamId: string;
  }): Promise<AppUser>;
  /** A single workspace user by id, or null. */
  get(id: string): Promise<AppUser | null>;
  /**
   * The app-managed workspace name for a team (SPEC §9, §18.2), or null if the
   * team has no name yet. The session reads this from the DB; login provisioning
   * uses it to decide whether to seed a name ONCE (it must not overwrite a
   * user-set name).
   */
  getTeamName(teamId: string): Promise<string | null>;
  /**
   * Idempotently upsert the team row's human name (SPEC §9, §18.2). Used to
   * seed the default name on first provision and to apply a Settings rename
   * (PATCH /api/settings/workspace). Creates the team if absent. Returns the
   * stored name. Login provisioning must NOT call this on every login.
   */
  upsertTeamName(teamId: string, name: string): Promise<string>;
}

/**
 * Per-user Google connections (SPEC §6.4, §6.7, §8.1). Backs the on-demand
 * email sync: it enumerates the connected mailboxes for a team so the use case
 * can pull a contact's threads across all of them. Tokens are never stored
 * here — only the SecretStore `secretRef`. Domain types only cross the boundary.
 */
export interface GoogleConnectionRepository {
  /** Idempotently store/refresh a user's Google connection (one per appUserId). */
  upsert(conn: GoogleConnection): Promise<void>;
  /** The connection for a workspace user, or null if not connected. */
  getByUser(appUserId: string): Promise<GoogleConnection | null>;
  /** Every connected mailbox in a team (powers the email-sync fan-out). */
  listForTeam(teamId: string): Promise<GoogleConnection[]>;
  /** Every connection across all teams (admin/diagnostics). */
  listAll(): Promise<GoogleConnection[]>;
}

// ── Identity resolution port (SPEC §4.3, §7.1) ──────────────────────────────
// The resolve-identity use case may stay a pure lib call; this port lets it be
// backed by a repository-aware resolver when the candidate set comes from the DB.
export interface IdentityResolverGateway {
  /**
   * Resolve an incoming email to a person: known → existing personId; unknown →
   * a provisional personId with non-destructive merge suggestions (never
   * silent-merges, RUBRIC C2).
   */
  resolve(
    teamId: string,
    email: string,
    hintName?: string,
  ): Promise<IdentityResolution>;
}
