/**
 * In-memory repository implementations (RUBRIC B4) — the offline/test backing for
 * every repository port in domain/ports.ts. NO drizzle import: the whole
 * ingest→analysis→profile loop runs with no DATABASE_URL (CLAUDE.md law 7).
 *
 * Reads are team-scoped (RUBRIC L5): every accessor that SPEC shows carrying a
 * team_id filters by it. Person.get follows `mergedIntoId` to the survivor
 * (soft-merge), matching the Neon repository contract. Only domain types cross
 * the boundary — there is no vendor object to die here.
 */

import type {
  PersonRepository,
  CompanyRepository,
  InitiativeRepository,
  ConversationRepository,
  TimelineRepository,
  FollowUpRepository,
  EmailMessageRepository,
  AppUserRepository,
  GoogleConnectionRepository,
  IntegrationConfigStore,
  SecretStore,
} from "@/domain/ports";
import type { AppUser } from "@/domain/tenancy";
import type { GoogleConnection } from "@/domain/connection";
import type {
  UserIntegration,
  IntegrationKind,
  IntegrationScope,
} from "@/domain/integration";
import { integrationSecretRef } from "@/domain/integration";
import type { Person, EmailIdentity } from "@/domain/person";
import type { Company, CompanyMembership } from "@/domain/company";
import type {
  Initiative,
  InitiativeTarget,
  InitiativeCalendarLink,
  TargetStatus,
} from "@/domain/initiative";
import { TARGET_STATUSES } from "@/domain/initiative";

/** Rank of a target outreach status (later in the lifecycle = more advanced). */
const targetStatusRank = (s: TargetStatus): number => TARGET_STATUSES.indexOf(s);
import type { Conversation, Participant } from "@/domain/conversation";
import type { Analysis } from "@/domain/analysis";
import type {
  TimelineEntry,
  ProfileSummary,
  EmailMessage,
  SubjectType,
} from "@/domain/profile";
import type { FollowUp } from "@/domain/followup";

// ── Shared store (persisted across dev HMR via globalThis) ──────────────────

interface Tables {
  people: Map<string, Person>;
  companies: Map<string, Company>;
  memberships: Map<string, CompanyMembership>;
  initiatives: Map<string, Initiative>;
  targets: Map<string, InitiativeTarget>;
  calendarLinks: Map<string, InitiativeCalendarLink>;
  conversations: Map<string, Conversation>;
  participants: Map<string, Participant>;
  analyses: Map<string, Analysis>; // keyed by conversationId
  timeline: TimelineEntry[];
  summaries: Map<string, ProfileSummary>; // keyed by `${subjectType}:${subjectId}`
  followUps: Map<string, FollowUp>;
  emails: Map<string, EmailMessage>; // keyed by rfcMessageId
  appUsers: Map<string, AppUser>; // keyed by app_user.id
  connections: Map<string, GoogleConnection>; // keyed by appUserId (one per user)
  integrations: Map<string, UserIntegration>; // keyed by `${appUserId}:${kind}`
  teamNames: Map<string, string>; // keyed by teamId → workspace name
}

function emptyTables(): Tables {
  return {
    people: new Map(),
    companies: new Map(),
    memberships: new Map(),
    initiatives: new Map(),
    targets: new Map(),
    calendarLinks: new Map(),
    conversations: new Map(),
    participants: new Map(),
    analyses: new Map(),
    timeline: [],
    summaries: new Map(),
    followUps: new Map(),
    emails: new Map(),
    appUsers: new Map(),
    connections: new Map(),
    integrations: new Map(),
    teamNames: new Map(),
  };
}

const g = globalThis as unknown as { __discoveryMemoryDb?: Tables };
const db: Tables = g.__discoveryMemoryDb ?? (g.__discoveryMemoryDb = emptyTables());

/** Test/seed helper: wipe the shared store. */
export function resetMemoryDb(): void {
  g.__discoveryMemoryDb = emptyTables();
  Object.assign(db, g.__discoveryMemoryDb);
}

const summaryKey = (subjectType: SubjectType, subjectId: string) =>
  `${subjectType}:${subjectId}`;

// ── People ──────────────────────────────────────────────────────────────────

export class MemoryPersonRepository implements PersonRepository {
  async get(teamId: string, personId: string): Promise<Person | null> {
    let p = db.people.get(personId);
    // follow soft-merge to the survivor
    const seen = new Set<string>();
    while (p?.mergedIntoId && !seen.has(p.id)) {
      seen.add(p.id);
      p = db.people.get(p.mergedIntoId);
    }
    return p && p.teamId === teamId ? p : null;
  }

  async findByEmail(teamId: string, emailNormalized: string): Promise<Person | null> {
    for (const p of db.people.values()) {
      if (p.teamId !== teamId || p.mergedIntoId) continue;
      if (p.emails.some((e) => e.emailNormalized === emailNormalized)) return p;
    }
    return null;
  }

  async list(
    teamId: string,
    filter?: { companyId?: string; email?: string; initiativeId?: string; query?: string },
  ): Promise<Person[]> {
    let rows = [...db.people.values()].filter(
      (p) => p.teamId === teamId && !p.mergedIntoId,
    );
    if (filter?.companyId) {
      rows = rows.filter((p) =>
        p.memberships.some((m) => m.companyId === filter.companyId),
      );
    }
    if (filter?.email) {
      const needle = filter.email.toLowerCase();
      rows = rows.filter((p) =>
        p.emails.some((e) => e.emailNormalized.includes(needle)),
      );
    }
    if (filter?.initiativeId) {
      const memberIds = new Set(
        [...db.targets.values()]
          .filter((t) => t.initiativeId === filter.initiativeId)
          .map((t) => t.personId),
      );
      // also engaged via linked conversations
      for (const conv of db.conversations.values()) {
        if (!conv.initiativeIds.includes(filter.initiativeId)) continue;
        for (const part of db.participants.values()) {
          if (part.conversationId === conv.id) memberIds.add(part.personId);
        }
      }
      rows = rows.filter((p) => memberIds.has(p.id));
    }
    if (filter?.query) {
      const q = filter.query.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.primaryDisplayName.toLowerCase().includes(q) ||
          p.emails.some((e) => e.emailNormalized.includes(q)),
      );
    }
    return rows;
  }

  async save(person: Person): Promise<void> {
    db.people.set(person.id, structuredClone(person));
  }

  async addEmail(personId: string, email: EmailIdentity): Promise<void> {
    const p = db.people.get(personId);
    if (!p) return;
    if (!p.emails.some((e) => e.emailNormalized === email.emailNormalized)) {
      p.emails.push(structuredClone(email));
    }
  }

  async merge(teamId: string, survivorId: string, absorbedId: string): Promise<Person> {
    const survivor = db.people.get(survivorId);
    const absorbed = db.people.get(absorbedId);
    if (!survivor || survivor.teamId !== teamId) {
      throw new Error(`survivor ${survivorId} not found in team ${teamId}`);
    }
    if (!absorbed || absorbed.teamId !== teamId) {
      throw new Error(`absorbed ${absorbedId} not found in team ${teamId}`);
    }
    // unify identities + memberships under the survivor
    for (const e of absorbed.emails) {
      if (!survivor.emails.some((x) => x.emailNormalized === e.emailNormalized)) {
        survivor.emails.push({ ...structuredClone(e), personId: survivorId });
      }
    }
    for (const m of absorbed.memberships) {
      if (!survivor.memberships.some((x) => x.id === m.id)) {
        survivor.memberships.push({ ...structuredClone(m), personId: survivorId });
      }
    }
    // re-point standalone membership rows + targets + participants
    for (const m of db.memberships.values()) {
      if (m.personId === absorbedId) m.personId = survivorId;
    }
    // Reassign initiative targets to the survivor, collapsing duplicates so we
    // never end up with two rows sharing (initiativeId, survivorId) — which the
    // Neon UNIQUE(initiative_id, person_id) constraint forbids. When the survivor
    // is already a target of the same initiative, keep the more-advanced status.
    const survivorTargets = new Map(
      [...db.targets.values()]
        .filter((t) => t.personId === survivorId)
        .map((t) => [t.initiativeId, t] as const),
    );
    for (const [id, target] of db.targets) {
      if (target.personId !== absorbedId) continue;
      const survivorTarget = survivorTargets.get(target.initiativeId);
      if (!survivorTarget) {
        target.personId = survivorId;
        survivorTargets.set(target.initiativeId, target);
        continue;
      }
      // Conflict: fold into the survivor's row, keeping the more-advanced status,
      // then drop the absorbed row.
      if (
        targetStatusRank(target.status) > targetStatusRank(survivorTarget.status)
      ) {
        survivorTarget.status = target.status;
        survivorTarget.reasonMd = target.reasonMd ?? survivorTarget.reasonMd;
      }
      db.targets.delete(id);
    }
    for (const part of db.participants.values()) {
      if (part.personId === absorbedId) part.personId = survivorId;
    }
    for (const em of db.emails.values()) {
      if (em.personId === absorbedId) em.personId = survivorId;
    }
    absorbed.mergedIntoId = survivorId;
    return survivor;
  }
}

// ── Companies ─────────────────────────────────────────────────────────────────

export class MemoryCompanyRepository implements CompanyRepository {
  async get(teamId: string, companyId: string): Promise<Company | null> {
    const c = db.companies.get(companyId);
    return c && c.teamId === teamId ? c : null;
  }
  async findByDomain(teamId: string, domain: string): Promise<Company | null> {
    const d = domain.toLowerCase();
    for (const c of db.companies.values()) {
      if (c.teamId === teamId && c.domain?.toLowerCase() === d) return c;
    }
    return null;
  }
  async list(teamId: string): Promise<Company[]> {
    return [...db.companies.values()].filter((c) => c.teamId === teamId);
  }
  async save(company: Company): Promise<void> {
    db.companies.set(company.id, structuredClone(company));
  }
  async membershipsFor(companyId: string): Promise<CompanyMembership[]> {
    return [...db.memberships.values()].filter((m) => m.companyId === companyId);
  }
  async saveMembership(membership: CompanyMembership): Promise<void> {
    db.memberships.set(membership.id, structuredClone(membership));
  }
}

// ── Initiatives ───────────────────────────────────────────────────────────────

export class MemoryInitiativeRepository implements InitiativeRepository {
  async get(teamId: string, initiativeId: string): Promise<Initiative | null> {
    const i = db.initiatives.get(initiativeId);
    return i && i.teamId === teamId ? i : null;
  }
  async list(
    teamId: string,
    filter?: { type?: string; status?: string },
  ): Promise<Initiative[]> {
    return [...db.initiatives.values()].filter(
      (i) =>
        i.teamId === teamId &&
        (!filter?.type || i.type === filter.type) &&
        (!filter?.status || i.status === filter.status),
    );
  }
  async save(initiative: Initiative): Promise<void> {
    db.initiatives.set(initiative.id, structuredClone(initiative));
  }
  async delete(teamId: string, initiativeId: string): Promise<void> {
    const i = db.initiatives.get(initiativeId);
    // team-scoped: ignore a delete that targets another team's initiative.
    if (!i || i.teamId !== teamId) return;
    // remove prospect-list targets for this initiative.
    for (const [id, target] of db.targets) {
      if (target.initiativeId === initiativeId) db.targets.delete(id);
    }
    // remove calendar links for this initiative.
    for (const [id, link] of db.calendarLinks) {
      if (link.initiativeId === initiativeId) db.calendarLinks.delete(id);
    }
    // unlink conversations (conversation_initiative rows) — conversations PRESERVED.
    for (const conv of db.conversations.values()) {
      if (conv.initiativeIds.includes(initiativeId)) {
        conv.initiativeIds = conv.initiativeIds.filter((id) => id !== initiativeId);
      }
    }
    db.initiatives.delete(initiativeId);
  }
  async listTargets(initiativeId: string): Promise<InitiativeTarget[]> {
    return [...db.targets.values()].filter((t) => t.initiativeId === initiativeId);
  }
  async addTarget(target: InitiativeTarget): Promise<void> {
    // honor UNIQUE(initiativeId, personId)
    const existing = [...db.targets.values()].find(
      (t) => t.initiativeId === target.initiativeId && t.personId === target.personId,
    );
    if (existing) {
      db.targets.set(existing.id, { ...existing, ...structuredClone(target), id: existing.id });
      return;
    }
    db.targets.set(target.id, structuredClone(target));
  }
  async setTargetStatus(
    initiativeId: string,
    personId: string,
    status: TargetStatus,
    reasonMd?: string,
  ): Promise<void> {
    for (const t of db.targets.values()) {
      if (t.initiativeId === initiativeId && t.personId === personId) {
        t.status = status;
        if (reasonMd !== undefined) t.reasonMd = reasonMd;
      }
    }
  }
  async removeTarget(initiativeId: string, personId: string): Promise<void> {
    for (const [id, t] of db.targets) {
      if (t.initiativeId === initiativeId && t.personId === personId) {
        db.targets.delete(id);
      }
    }
  }
  async listCalendarLinks(teamId: string): Promise<InitiativeCalendarLink[]> {
    const teamInitiatives = new Set(
      [...db.initiatives.values()].filter((i) => i.teamId === teamId).map((i) => i.id),
    );
    return [...db.calendarLinks.values()].filter((l) =>
      teamInitiatives.has(l.initiativeId),
    );
  }
  async saveCalendarLink(link: InitiativeCalendarLink): Promise<void> {
    db.calendarLinks.set(link.id, structuredClone(link));
  }
}

// ── Conversations ─────────────────────────────────────────────────────────────

export class MemoryConversationRepository implements ConversationRepository {
  /**
   * Join the participants stored in the separate `db.participants` map onto the
   * conversation document (Neon hydrates the same way). Participants attached via
   * `addParticipant`/`saveParticipant` live only in that map, so returning the
   * stored document verbatim would drop them and break personId/companyAtTime
   * filters. The map is authoritative for participants here.
   */
  private withParticipants(c: Conversation): Conversation {
    const participants = [...db.participants.values()].filter(
      (p) => p.conversationId === c.id,
    );
    return structuredClone({ ...c, participants });
  }

  async get(teamId: string, conversationId: string): Promise<Conversation | null> {
    const c = db.conversations.get(conversationId);
    return c && c.teamId === teamId ? this.withParticipants(c) : null;
  }
  async findByExternalId(
    teamId: string,
    provider: string,
    externalId: string,
  ): Promise<Conversation | null> {
    for (const c of db.conversations.values()) {
      if (
        c.teamId === teamId &&
        c.provider === provider &&
        c.externalId === externalId
      ) {
        return this.withParticipants(c);
      }
    }
    return null;
  }
  async list(
    teamId: string,
    filter?: {
      initiativeId?: string;
      unassignedOnly?: boolean;
      companyAtTime?: string;
      personId?: string;
    },
  ): Promise<Conversation[]> {
    let rows = [...db.conversations.values()].filter((c) => c.teamId === teamId);
    if (filter?.initiativeId) {
      rows = rows.filter((c) => c.initiativeIds.includes(filter.initiativeId!));
    }
    if (filter?.unassignedOnly) {
      rows = rows.filter((c) => c.initiativeIds.length === 0);
    }
    if (filter?.personId || filter?.companyAtTime) {
      const matchConv = new Set<string>();
      for (const part of db.participants.values()) {
        const personOk = !filter.personId || part.personId === filter.personId;
        const companyOk =
          !filter.companyAtTime || part.companyAtTime === filter.companyAtTime;
        if (personOk && companyOk) matchConv.add(part.conversationId);
      }
      rows = rows.filter((c) => matchConv.has(c.id));
    }
    return rows.map((c) => this.withParticipants(c));
  }
  async save(conversation: Conversation): Promise<void> {
    db.conversations.set(conversation.id, structuredClone(conversation));
    // Mirror Neon: persist inline participants into the authoritative map so the
    // join in get()/list() returns them (and addParticipant rows survive a save).
    for (const p of conversation.participants) {
      db.participants.set(p.id, structuredClone(p));
    }
  }
  async saveParticipant(participant: Participant): Promise<void> {
    db.participants.set(participant.id, structuredClone(participant));
  }
  async addParticipant(
    conversationId: string,
    snapshot: {
      personId: string;
      emailUsed: string;
      companyAtTime?: string | null;
      roleAtTime?: string | null;
    },
  ): Promise<Participant> {
    // idempotent by (conversationId, personId) — reuse the row if it exists.
    const existing = [...db.participants.values()].find(
      (p) => p.conversationId === conversationId && p.personId === snapshot.personId,
    );
    const participant: Participant = {
      id: existing?.id ?? `${conversationId}:p:${snapshot.personId}`,
      conversationId,
      personId: snapshot.personId,
      emailUsed: snapshot.emailUsed,
      companyAtTime: snapshot.companyAtTime ?? null,
      roleAtTime: snapshot.roleAtTime ?? null,
    };
    db.participants.set(participant.id, structuredClone(participant));
    return participant;
  }
  async removeParticipant(conversationId: string, personId: string): Promise<void> {
    for (const [id, p] of db.participants) {
      if (p.conversationId === conversationId && p.personId === personId) {
        db.participants.delete(id);
      }
    }
  }
  async linkInitiative(conversationId: string, initiativeId: string): Promise<void> {
    const c = db.conversations.get(conversationId);
    if (c && !c.initiativeIds.includes(initiativeId)) {
      c.initiativeIds.push(initiativeId);
    }
  }
  async unlinkInitiative(conversationId: string, initiativeId: string): Promise<void> {
    const c = db.conversations.get(conversationId);
    if (c) c.initiativeIds = c.initiativeIds.filter((id) => id !== initiativeId);
  }
  async getAnalysis(conversationId: string): Promise<Analysis | null> {
    return db.analyses.get(conversationId) ?? null;
  }
  async saveAnalysis(analysis: Analysis): Promise<void> {
    db.analyses.set(analysis.conversationId, structuredClone(analysis));
  }
}

// ── Timeline / profile ─────────────────────────────────────────────────────────

export class MemoryTimelineRepository implements TimelineRepository {
  async list(subjectType: SubjectType, subjectId: string): Promise<TimelineEntry[]> {
    return db.timeline
      .filter((e) => e.subjectType === subjectType && e.subjectId === subjectId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
  async append(entry: TimelineEntry): Promise<void> {
    db.timeline.push(structuredClone(entry));
  }
  async getSummary(
    subjectType: SubjectType,
    subjectId: string,
  ): Promise<ProfileSummary | null> {
    return db.summaries.get(summaryKey(subjectType, subjectId)) ?? null;
  }
  async saveSummary(summary: ProfileSummary): Promise<void> {
    db.summaries.set(
      summaryKey(summary.subjectType, summary.subjectId),
      structuredClone(summary),
    );
  }
}

// ── Follow-ups ─────────────────────────────────────────────────────────────────

export class MemoryFollowUpRepository implements FollowUpRepository {
  /** Hide archived rows unless explicitly requested (§18.6). */
  private visible(rows: FollowUp[], includeArchived?: boolean): FollowUp[] {
    return includeArchived ? rows : rows.filter((f) => !f.archivedAt);
  }

  async listForConversation(
    conversationId: string,
    opts?: { includeArchived?: boolean },
  ): Promise<FollowUp[]> {
    const rows = [...db.followUps.values()].filter(
      (f) => f.conversationId === conversationId,
    );
    return this.visible(rows, opts?.includeArchived);
  }
  async listForPerson(
    personId: string,
    opts?: { includeArchived?: boolean },
  ): Promise<FollowUp[]> {
    const ownConvs = new Set(
      [...db.participants.values()]
        .filter((p) => p.personId === personId)
        .map((p) => p.conversationId),
    );
    const rows = [...db.followUps.values()].filter(
      (f) => f.ownerPersonId === personId || ownConvs.has(f.conversationId),
    );
    return this.visible(rows, opts?.includeArchived);
  }
  async listForInitiative(
    initiativeId: string,
    opts?: { includeArchived?: boolean },
  ): Promise<FollowUp[]> {
    const convs = new Set(
      [...db.conversations.values()]
        .filter((c) => c.initiativeIds.includes(initiativeId))
        .map((c) => c.id),
    );
    const rows = [...db.followUps.values()].filter((f) => convs.has(f.conversationId));
    return this.visible(rows, opts?.includeArchived);
  }
  async save(followUp: FollowUp): Promise<void> {
    db.followUps.set(followUp.id, structuredClone(followUp));
  }
  async setStatus(followUpId: string, status: FollowUp["status"]): Promise<void> {
    const f = db.followUps.get(followUpId);
    if (f) f.status = status;
  }
  async update(
    followUpId: string,
    patch: { status?: FollowUp["status"]; archivedAt?: string | null },
  ): Promise<void> {
    const f = db.followUps.get(followUpId);
    if (!f) return;
    if (patch.status !== undefined) f.status = patch.status;
    if (patch.archivedAt !== undefined) f.archivedAt = patch.archivedAt;
  }
}

// ── Email messages ─────────────────────────────────────────────────────────────

export class MemoryEmailMessageRepository implements EmailMessageRepository {
  async listForPerson(personId: string): Promise<EmailMessage[]> {
    return [...db.emails.values()]
      .filter((m) => m.personId === personId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
  async findByRfcMessageId(rfcMessageId: string): Promise<EmailMessage | null> {
    return db.emails.get(rfcMessageId) ?? null;
  }
  async upsert(message: EmailMessage): Promise<void> {
    // UNIQUE(rfc_message_id) collapses cross-mailbox dupes — keyed by it directly.
    db.emails.set(message.rfcMessageId, structuredClone(message));
  }
}

// ── Workspace users (app_user) ───────────────────────────────────────────────

export class MemoryAppUserRepository implements AppUserRepository {
  async upsertByAuth0Sub(input: {
    auth0Sub: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    teamId: string;
  }): Promise<AppUser> {
    const existing = [...db.appUsers.values()].find(
      (u) => u.auth0Sub === input.auth0Sub,
    );
    const user: AppUser = {
      id: existing?.id ?? `usr-${input.auth0Sub}`,
      teamId: input.teamId,
      auth0Sub: input.auth0Sub,
      email: input.email,
      displayName: input.displayName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    db.appUsers.set(user.id, structuredClone(user));
    return user;
  }
  async get(id: string): Promise<AppUser | null> {
    return db.appUsers.get(id) ?? null;
  }
  async getTeamName(teamId: string): Promise<string | null> {
    const name = db.teamNames.get(teamId);
    return name && name.trim() ? name : null;
  }
  async upsertTeamName(teamId: string, name: string): Promise<string> {
    db.teamNames.set(teamId, name);
    return name;
  }
}

// ── Google connections ───────────────────────────────────────────────────────

export class MemoryGoogleConnectionRepository implements GoogleConnectionRepository {
  async upsert(conn: GoogleConnection): Promise<void> {
    // one connection per workspace user — keyed by appUserId.
    db.connections.set(conn.appUserId, structuredClone(conn));
  }
  async getByUser(appUserId: string): Promise<GoogleConnection | null> {
    return db.connections.get(appUserId) ?? null;
  }
  async listForTeam(teamId: string): Promise<GoogleConnection[]> {
    return [...db.connections.values()].filter((c) => c.teamId === teamId);
  }
  async listAll(): Promise<GoogleConnection[]> {
    return [...db.connections.values()];
  }
}

// ── User/domain integrations (user_integration) ──────────────────────────────

const integrationKey = (appUserId: string, kind: IntegrationKind) =>
  `${appUserId}:${kind}`;

/**
 * In-memory IntegrationConfigStore (SPEC §6.8) — the offline backing for the
 * integration config port. The secret is written to the SecretStore; only the
 * ref is held on the row (CLAUDE.md law 7 — runs with no DB).
 */
export class MemoryIntegrationConfigStore implements IntegrationConfigStore {
  constructor(private readonly secrets: SecretStore) {}

  async get(scopeKey: string, kind: IntegrationKind): Promise<UserIntegration | null> {
    return db.integrations.get(integrationKey(scopeKey, kind)) ?? null;
  }

  async set(
    scopeKey: string,
    kind: IntegrationKind,
    input: {
      config?: Record<string, unknown>;
      secret?: string;
      scope?: IntegrationScope;
      teamId: string;
    },
  ): Promise<UserIntegration> {
    const existing = await this.get(scopeKey, kind);
    let secretRef = existing?.secretRef ?? null;
    if (input.secret !== undefined) {
      const ref = integrationSecretRef(input.teamId, scopeKey, kind);
      secretRef = await this.secrets.put(ref, input.secret);
    }
    const now = new Date().toISOString();
    const row: UserIntegration = {
      id: existing?.id ?? `uig-${kind}-${scopeKey}`,
      appUserId: scopeKey,
      teamId: input.teamId,
      kind,
      scope: input.scope ?? existing?.scope ?? "user",
      configJson: input.config ?? existing?.configJson ?? {},
      secretRef,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    db.integrations.set(integrationKey(scopeKey, kind), structuredClone(row));
    return row;
  }

  async clear(scopeKey: string, kind: IntegrationKind): Promise<void> {
    const existing = await this.get(scopeKey, kind);
    if (existing?.secretRef) await this.secrets.delete(existing.secretRef);
    db.integrations.delete(integrationKey(scopeKey, kind));
  }
}
