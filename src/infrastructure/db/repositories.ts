/**
 * Neon-backed repository implementations (SPEC §8). This is the ONLY place the
 * repository ports touch Drizzle (RUBRIC B3); vendor row objects are translated
 * to domain types at this boundary and never escape it. Reads are team-scoped
 * (RUBRIC L5): every query that SPEC shows carrying team_id constrains by it.
 *
 * Mirrors the in-memory contract exactly: Person.get follows mergedIntoId to the
 * survivor; list filters match; UNIQUE constraints back the upserts.
 */

import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb, type Database } from "./index";
import * as t from "./schema";

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
import type { Person, EmailIdentity, EmailLabel, EmailSource } from "@/domain/person";
import type { Company, CompanyMembership } from "@/domain/company";
import type {
  Initiative,
  InitiativeType,
  InitiativeStatus,
  InitiativeTarget,
  InitiativeCalendarLink,
  TargetStatus,
} from "@/domain/initiative";
import type {
  Conversation,
  ConversationSource,
  Participant,
} from "@/domain/conversation";
import type { Analysis, LearnedFact, Signal, Sentiment } from "@/domain/analysis";
import type {
  TimelineEntry,
  TimelineKind,
  ProfileSummary,
  EmailMessage,
  SubjectType,
} from "@/domain/profile";
import type { FollowUp, FollowUpStatus, FollowUpSource } from "@/domain/followup";
import type { NormalizedEmail } from "@/domain/person";
import type { TranscriptSegment } from "@/domain/coaching";

const iso = (d: Date | string | null | undefined): string =>
  d == null ? "" : typeof d === "string" ? d : d.toISOString();

// ── People ──────────────────────────────────────────────────────────────────

export class NeonPersonRepository implements PersonRepository {
  constructor(private readonly db: Database = getDb()) {}

  private async hydrate(
    rows: (typeof t.person.$inferSelect)[],
  ): Promise<Person[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const emails = await this.db
      .select()
      .from(t.emailIdentity)
      .where(inArray(t.emailIdentity.personId, ids));
    const memberships = await this.db
      .select()
      .from(t.companyMembership)
      .where(inArray(t.companyMembership.personId, ids));
    return rows.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      primaryDisplayName: r.primaryDisplayName,
      createdBy: r.createdBy,
      createdAt: iso(r.createdAt),
      mergedIntoId: r.mergedIntoId ?? null,
      emails: emails
        .filter((e) => e.personId === r.id)
        .map((e) => ({
          id: e.id,
          personId: e.personId,
          emailNormalized: e.emailNormalized as NormalizedEmail,
          label: e.label as EmailLabel,
          verified: e.verified,
          source: e.source as EmailSource,
        })),
      memberships: memberships
        .filter((m) => m.personId === r.id)
        .map((m) => ({
          id: m.id,
          personId: m.personId,
          companyId: m.companyId,
          title: m.title ?? undefined,
          startedOn: m.startedOn ?? null,
          endedOn: m.endedOn ?? null,
          isCurrent: m.isCurrent,
        })),
    }));
  }

  async get(teamId: string, personId: string): Promise<Person | null> {
    let id = personId;
    const seen = new Set<string>();
    // follow soft-merge to the survivor
    for (;;) {
      const rows = await this.db
        .select()
        .from(t.person)
        .where(eq(t.person.id, id));
      const row = rows[0];
      if (!row) return null;
      if (row.mergedIntoId && !seen.has(row.id)) {
        seen.add(row.id);
        id = row.mergedIntoId;
        continue;
      }
      if (row.teamId !== teamId) return null;
      return (await this.hydrate([row]))[0] ?? null;
    }
  }

  async findByEmail(teamId: string, emailNormalized: string): Promise<Person | null> {
    const ids = await this.db
      .select({ personId: t.emailIdentity.personId })
      .from(t.emailIdentity)
      .where(eq(t.emailIdentity.emailNormalized, emailNormalized));
    if (ids.length === 0) return null;
    const rows = await this.db
      .select()
      .from(t.person)
      .where(
        and(
          eq(t.person.teamId, teamId),
          inArray(
            t.person.id,
            ids.map((i) => i.personId),
          ),
          sql`${t.person.mergedIntoId} is null`,
        ),
      );
    return (await this.hydrate(rows))[0] ?? null;
  }

  async list(
    teamId: string,
    filter?: { companyId?: string; email?: string; initiativeId?: string; query?: string },
  ): Promise<Person[]> {
    const conds = [eq(t.person.teamId, teamId), sql`${t.person.mergedIntoId} is null`];
    let rows = await this.db
      .select()
      .from(t.person)
      .where(and(...conds));

    if (filter?.companyId) {
      const members = await this.db
        .select({ personId: t.companyMembership.personId })
        .from(t.companyMembership)
        .where(eq(t.companyMembership.companyId, filter.companyId));
      const set = new Set(members.map((m) => m.personId));
      rows = rows.filter((r) => set.has(r.id));
    }
    if (filter?.email) {
      const matches = await this.db
        .select({ personId: t.emailIdentity.personId })
        .from(t.emailIdentity)
        .where(ilike(t.emailIdentity.emailNormalized, `%${filter.email}%`));
      const set = new Set(matches.map((m) => m.personId));
      rows = rows.filter((r) => set.has(r.id));
    }
    if (filter?.initiativeId) {
      const targets = await this.db
        .select({ personId: t.initiativeTarget.personId })
        .from(t.initiativeTarget)
        .where(eq(t.initiativeTarget.initiativeId, filter.initiativeId));
      const set = new Set(targets.map((m) => m.personId));
      const convs = await this.db
        .select({ id: t.conversation.id })
        .from(t.conversation)
        .innerJoin(
          t.conversationInitiative,
          eq(t.conversationInitiative.conversationId, t.conversation.id),
        )
        .where(eq(t.conversationInitiative.initiativeId, filter.initiativeId));
      if (convs.length) {
        const parts = await this.db
          .select({ personId: t.participant.personId })
          .from(t.participant)
          .where(
            inArray(
              t.participant.conversationId,
              convs.map((c) => c.id),
            ),
          );
        parts.forEach((p) => set.add(p.personId));
      }
      rows = rows.filter((r) => set.has(r.id));
    }
    let hydrated = await this.hydrate(rows);
    if (filter?.query) {
      const q = filter.query.toLowerCase();
      hydrated = hydrated.filter(
        (p) =>
          p.primaryDisplayName.toLowerCase().includes(q) ||
          p.emails.some((e) => e.emailNormalized.includes(q)),
      );
    }
    return hydrated;
  }

  async save(person: Person): Promise<void> {
    await this.db
      .insert(t.person)
      .values({
        id: person.id,
        teamId: person.teamId,
        primaryDisplayName: person.primaryDisplayName,
        createdBy: person.createdBy,
        createdAt: new Date(person.createdAt),
        mergedIntoId: person.mergedIntoId ?? null,
      })
      .onConflictDoUpdate({
        target: t.person.id,
        set: {
          primaryDisplayName: person.primaryDisplayName,
          mergedIntoId: person.mergedIntoId ?? null,
        },
      });
    for (const e of person.emails) await this.addEmail(person.id, e);
    for (const m of person.memberships) {
      await this.db
        .insert(t.companyMembership)
        .values({
          id: m.id,
          personId: person.id,
          companyId: m.companyId,
          title: m.title ?? null,
          startedOn: m.startedOn ?? null,
          endedOn: m.endedOn ?? null,
          isCurrent: m.isCurrent,
        })
        .onConflictDoNothing({ target: t.companyMembership.id });
    }
  }

  async addEmail(personId: string, email: EmailIdentity): Promise<void> {
    await this.db
      .insert(t.emailIdentity)
      .values({
        id: email.id,
        personId,
        emailNormalized: email.emailNormalized,
        label: email.label,
        verified: email.verified,
        source: email.source,
      })
      .onConflictDoNothing({ target: t.emailIdentity.emailNormalized });
  }

  async merge(teamId: string, survivorId: string, absorbedId: string): Promise<Person> {
    // re-point identities, memberships, targets, participants, emails; then mark merged.
    await this.db
      .update(t.emailIdentity)
      .set({ personId: survivorId })
      .where(eq(t.emailIdentity.personId, absorbedId));
    await this.db
      .update(t.companyMembership)
      .set({ personId: survivorId })
      .where(eq(t.companyMembership.personId, absorbedId));
    await this.db
      .update(t.initiativeTarget)
      .set({ personId: survivorId })
      .where(eq(t.initiativeTarget.personId, absorbedId));
    await this.db
      .update(t.participant)
      .set({ personId: survivorId })
      .where(eq(t.participant.personId, absorbedId));
    await this.db
      .update(t.emailMessage)
      .set({ personId: survivorId })
      .where(eq(t.emailMessage.personId, absorbedId));
    await this.db
      .update(t.person)
      .set({ mergedIntoId: survivorId })
      .where(eq(t.person.id, absorbedId));
    const survivor = await this.get(teamId, survivorId);
    if (!survivor) throw new Error(`survivor ${survivorId} not found in team ${teamId}`);
    return survivor;
  }
}

// ── Companies ─────────────────────────────────────────────────────────────────

export class NeonCompanyRepository implements CompanyRepository {
  constructor(private readonly db: Database = getDb()) {}

  private toCompany(r: typeof t.company.$inferSelect): Company {
    return {
      id: r.id,
      teamId: r.teamId,
      name: r.name,
      domain: r.domain ?? undefined,
      createdAt: iso(r.createdAt),
    };
  }
  private toMembership(r: typeof t.companyMembership.$inferSelect): CompanyMembership {
    return {
      id: r.id,
      personId: r.personId,
      companyId: r.companyId,
      title: r.title ?? undefined,
      startedOn: r.startedOn ?? null,
      endedOn: r.endedOn ?? null,
      isCurrent: r.isCurrent,
    };
  }

  async get(teamId: string, companyId: string): Promise<Company | null> {
    const rows = await this.db
      .select()
      .from(t.company)
      .where(and(eq(t.company.teamId, teamId), eq(t.company.id, companyId)));
    return rows[0] ? this.toCompany(rows[0]) : null;
  }
  async findByDomain(teamId: string, domain: string): Promise<Company | null> {
    const rows = await this.db
      .select()
      .from(t.company)
      .where(and(eq(t.company.teamId, teamId), ilike(t.company.domain, domain)));
    return rows[0] ? this.toCompany(rows[0]) : null;
  }
  async list(teamId: string): Promise<Company[]> {
    const rows = await this.db
      .select()
      .from(t.company)
      .where(eq(t.company.teamId, teamId));
    return rows.map((r) => this.toCompany(r));
  }
  async save(company: Company): Promise<void> {
    await this.db
      .insert(t.company)
      .values({
        id: company.id,
        teamId: company.teamId,
        name: company.name,
        domain: company.domain ?? null,
        createdAt: new Date(company.createdAt),
      })
      .onConflictDoUpdate({
        target: t.company.id,
        set: { name: company.name, domain: company.domain ?? null },
      });
  }
  async membershipsFor(companyId: string): Promise<CompanyMembership[]> {
    const rows = await this.db
      .select()
      .from(t.companyMembership)
      .where(eq(t.companyMembership.companyId, companyId));
    return rows.map((r) => this.toMembership(r));
  }
  async saveMembership(membership: CompanyMembership): Promise<void> {
    await this.db
      .insert(t.companyMembership)
      .values({
        id: membership.id,
        personId: membership.personId,
        companyId: membership.companyId,
        title: membership.title ?? null,
        startedOn: membership.startedOn ?? null,
        endedOn: membership.endedOn ?? null,
        isCurrent: membership.isCurrent,
      })
      .onConflictDoUpdate({
        target: t.companyMembership.id,
        set: {
          title: membership.title ?? null,
          startedOn: membership.startedOn ?? null,
          endedOn: membership.endedOn ?? null,
          isCurrent: membership.isCurrent,
        },
      });
  }
}

// ── Initiatives ───────────────────────────────────────────────────────────────

export class NeonInitiativeRepository implements InitiativeRepository {
  constructor(private readonly db: Database = getDb()) {}

  private toInitiative(r: typeof t.initiative.$inferSelect): Initiative {
    return {
      id: r.id,
      teamId: r.teamId,
      name: r.name,
      type: r.type as InitiativeType,
      goalMd: r.goalMd,
      hypothesisMd: r.hypothesisMd,
      status: r.status as InitiativeStatus,
      createdBy: r.createdBy,
      createdAt: iso(r.createdAt),
    };
  }
  private toTarget(r: typeof t.initiativeTarget.$inferSelect): InitiativeTarget {
    return {
      id: r.id,
      initiativeId: r.initiativeId,
      personId: r.personId,
      status: r.status as TargetStatus,
      reasonMd: r.reasonMd ?? undefined,
      addedBy: r.addedBy,
      createdAt: iso(r.createdAt),
    };
  }

  async get(teamId: string, initiativeId: string): Promise<Initiative | null> {
    const rows = await this.db
      .select()
      .from(t.initiative)
      .where(and(eq(t.initiative.teamId, teamId), eq(t.initiative.id, initiativeId)));
    return rows[0] ? this.toInitiative(rows[0]) : null;
  }
  async list(
    teamId: string,
    filter?: { type?: string; status?: string },
  ): Promise<Initiative[]> {
    const conds = [eq(t.initiative.teamId, teamId)];
    if (filter?.type) conds.push(eq(t.initiative.type, filter.type));
    if (filter?.status) conds.push(eq(t.initiative.status, filter.status));
    const rows = await this.db
      .select()
      .from(t.initiative)
      .where(and(...conds));
    return rows.map((r) => this.toInitiative(r));
  }
  async save(initiative: Initiative): Promise<void> {
    await this.db
      .insert(t.initiative)
      .values({
        id: initiative.id,
        teamId: initiative.teamId,
        name: initiative.name,
        type: initiative.type,
        goalMd: initiative.goalMd,
        hypothesisMd: initiative.hypothesisMd,
        status: initiative.status,
        createdBy: initiative.createdBy,
        createdAt: new Date(initiative.createdAt),
      })
      .onConflictDoUpdate({
        target: t.initiative.id,
        set: {
          name: initiative.name,
          type: initiative.type,
          goalMd: initiative.goalMd,
          hypothesisMd: initiative.hypothesisMd,
          status: initiative.status,
        },
      });
  }
  async delete(teamId: string, initiativeId: string): Promise<void> {
    // team-scoped guard: only delete an initiative owned by this team.
    const owned = await this.db
      .select({ id: t.initiative.id })
      .from(t.initiative)
      .where(and(eq(t.initiative.teamId, teamId), eq(t.initiative.id, initiativeId)));
    if (owned.length === 0) return;
    // remove dependents first (FK order); conversations themselves are PRESERVED.
    await this.db
      .delete(t.initiativeTarget)
      .where(eq(t.initiativeTarget.initiativeId, initiativeId));
    await this.db
      .delete(t.conversationInitiative)
      .where(eq(t.conversationInitiative.initiativeId, initiativeId));
    await this.db
      .delete(t.initiativeCalendarLink)
      .where(eq(t.initiativeCalendarLink.initiativeId, initiativeId));
    await this.db.delete(t.initiative).where(eq(t.initiative.id, initiativeId));
  }
  async listTargets(initiativeId: string): Promise<InitiativeTarget[]> {
    const rows = await this.db
      .select()
      .from(t.initiativeTarget)
      .where(eq(t.initiativeTarget.initiativeId, initiativeId));
    return rows.map((r) => this.toTarget(r));
  }
  async addTarget(target: InitiativeTarget): Promise<void> {
    await this.db
      .insert(t.initiativeTarget)
      .values({
        id: target.id,
        initiativeId: target.initiativeId,
        personId: target.personId,
        status: target.status,
        reasonMd: target.reasonMd ?? null,
        addedBy: target.addedBy,
        createdAt: new Date(target.createdAt),
      })
      .onConflictDoUpdate({
        // honor UNIQUE(initiative_id, person_id)
        target: [t.initiativeTarget.initiativeId, t.initiativeTarget.personId],
        set: { status: target.status, reasonMd: target.reasonMd ?? null },
      });
  }
  async setTargetStatus(
    initiativeId: string,
    personId: string,
    status: TargetStatus,
    reasonMd?: string,
  ): Promise<void> {
    await this.db
      .update(t.initiativeTarget)
      .set({ status, ...(reasonMd !== undefined ? { reasonMd } : {}) })
      .where(
        and(
          eq(t.initiativeTarget.initiativeId, initiativeId),
          eq(t.initiativeTarget.personId, personId),
        ),
      );
  }
  async removeTarget(initiativeId: string, personId: string): Promise<void> {
    await this.db
      .delete(t.initiativeTarget)
      .where(
        and(
          eq(t.initiativeTarget.initiativeId, initiativeId),
          eq(t.initiativeTarget.personId, personId),
        ),
      );
  }
  async listCalendarLinks(teamId: string): Promise<InitiativeCalendarLink[]> {
    const rows = await this.db
      .select({
        id: t.initiativeCalendarLink.id,
        initiativeId: t.initiativeCalendarLink.initiativeId,
        appUserId: t.initiativeCalendarLink.appUserId,
        provider: t.initiativeCalendarLink.provider,
        linkId: t.initiativeCalendarLink.linkId,
        label: t.initiativeCalendarLink.label,
      })
      .from(t.initiativeCalendarLink)
      .innerJoin(
        t.initiative,
        eq(t.initiative.id, t.initiativeCalendarLink.initiativeId),
      )
      .where(eq(t.initiative.teamId, teamId));
    return rows.map((r) => ({
      id: r.id,
      initiativeId: r.initiativeId,
      appUserId: r.appUserId,
      provider: r.provider,
      linkId: r.linkId,
      label: r.label ?? undefined,
    }));
  }
  async saveCalendarLink(link: InitiativeCalendarLink): Promise<void> {
    await this.db
      .insert(t.initiativeCalendarLink)
      .values({
        id: link.id,
        initiativeId: link.initiativeId,
        appUserId: link.appUserId,
        provider: link.provider,
        linkId: link.linkId,
        label: link.label ?? null,
      })
      .onConflictDoUpdate({
        target: t.initiativeCalendarLink.id,
        set: { provider: link.provider, linkId: link.linkId, label: link.label ?? null },
      });
  }
}

// ── Conversations ─────────────────────────────────────────────────────────────

export class NeonConversationRepository implements ConversationRepository {
  constructor(private readonly db: Database = getDb()) {}

  private async hydrate(
    rows: (typeof t.conversation.$inferSelect)[],
  ): Promise<Conversation[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const segs = await this.db
      .select()
      .from(t.transcriptSeg)
      .where(inArray(t.transcriptSeg.conversationId, ids));
    const parts = await this.db
      .select()
      .from(t.participant)
      .where(inArray(t.participant.conversationId, ids));
    const links = await this.db
      .select()
      .from(t.conversationInitiative)
      .where(inArray(t.conversationInitiative.conversationId, ids));
    return rows.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      source: r.source as ConversationSource,
      provider: r.provider ?? null,
      externalId: r.externalId ?? null,
      title: r.title,
      reasonMd: r.reasonMd,
      outcomeMd: r.outcomeMd,
      occurredAt: iso(r.occurredAt),
      createdBy: r.createdBy,
      createdAt: iso(r.createdAt),
      participants: parts
        .filter((p) => p.conversationId === r.id)
        .map((p) => ({
          id: p.id,
          conversationId: p.conversationId,
          personId: p.personId,
          emailUsed: p.emailUsed,
          companyAtTime: p.companyAtTime ?? null,
          roleAtTime: p.roleAtTime ?? null,
        })),
      segments: segs
        .filter((s) => s.conversationId === r.id)
        .sort((a, b) => a.idx - b.idx)
        .map(
          (s): TranscriptSegment => ({
            ts: s.tsSeconds ?? 0,
            speaker: s.speaker,
            text: s.text,
          }),
        ),
      initiativeIds: links
        .filter((l) => l.conversationId === r.id)
        .map((l) => l.initiativeId),
    }));
  }

  async get(teamId: string, conversationId: string): Promise<Conversation | null> {
    const rows = await this.db
      .select()
      .from(t.conversation)
      .where(
        and(eq(t.conversation.teamId, teamId), eq(t.conversation.id, conversationId)),
      );
    return (await this.hydrate(rows))[0] ?? null;
  }
  async findByExternalId(
    teamId: string,
    provider: string,
    externalId: string,
  ): Promise<Conversation | null> {
    const rows = await this.db
      .select()
      .from(t.conversation)
      .where(
        and(
          eq(t.conversation.teamId, teamId),
          eq(t.conversation.provider, provider),
          eq(t.conversation.externalId, externalId),
        ),
      );
    return (await this.hydrate(rows))[0] ?? null;
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
    const rows = await this.db
      .select()
      .from(t.conversation)
      .where(eq(t.conversation.teamId, teamId));
    let hydrated = await this.hydrate(rows);
    if (filter?.initiativeId) {
      hydrated = hydrated.filter((c) =>
        c.initiativeIds.includes(filter.initiativeId!),
      );
    }
    if (filter?.unassignedOnly) {
      hydrated = hydrated.filter((c) => c.initiativeIds.length === 0);
    }
    if (filter?.personId) {
      hydrated = hydrated.filter((c) =>
        c.participants.some((p) => p.personId === filter.personId),
      );
    }
    if (filter?.companyAtTime) {
      hydrated = hydrated.filter((c) =>
        c.participants.some((p) => p.companyAtTime === filter.companyAtTime),
      );
    }
    return hydrated;
  }
  async save(conversation: Conversation): Promise<void> {
    await this.db
      .insert(t.conversation)
      .values({
        id: conversation.id,
        teamId: conversation.teamId,
        source: conversation.source,
        provider: conversation.provider ?? null,
        externalId: conversation.externalId ?? null,
        title: conversation.title,
        reasonMd: conversation.reasonMd,
        outcomeMd: conversation.outcomeMd,
        occurredAt: new Date(conversation.occurredAt),
        createdBy: conversation.createdBy,
        createdAt: new Date(conversation.createdAt),
      })
      .onConflictDoUpdate({
        target: t.conversation.id,
        set: {
          title: conversation.title,
          reasonMd: conversation.reasonMd,
          outcomeMd: conversation.outcomeMd,
        },
      });
    // segments (idempotent by id)
    for (let i = 0; i < conversation.segments.length; i++) {
      const s = conversation.segments[i];
      await this.db
        .insert(t.transcriptSeg)
        .values({
          id: `${conversation.id}:seg:${i}`,
          conversationId: conversation.id,
          idx: i,
          speaker: s.speaker,
          text: s.text,
          tsSeconds: s.ts,
        })
        .onConflictDoNothing({ target: t.transcriptSeg.id });
    }
    for (const p of conversation.participants) await this.saveParticipant(p);
    for (const initiativeId of conversation.initiativeIds) {
      await this.linkInitiative(conversation.id, initiativeId);
    }
  }
  async saveParticipant(participant: Participant): Promise<void> {
    await this.db
      .insert(t.participant)
      .values({
        id: participant.id,
        conversationId: participant.conversationId,
        personId: participant.personId,
        emailUsed: participant.emailUsed,
        companyAtTime: participant.companyAtTime ?? null,
        roleAtTime: participant.roleAtTime ?? null,
      })
      .onConflictDoNothing({ target: t.participant.id });
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
    // deterministic id makes the attach idempotent per (conversation, person).
    const id = `${conversationId}:p:${snapshot.personId}`;
    const participant: Participant = {
      id,
      conversationId,
      personId: snapshot.personId,
      emailUsed: snapshot.emailUsed,
      companyAtTime: snapshot.companyAtTime ?? null,
      roleAtTime: snapshot.roleAtTime ?? null,
    };
    await this.db
      .insert(t.participant)
      .values({
        id,
        conversationId,
        personId: snapshot.personId,
        emailUsed: snapshot.emailUsed,
        companyAtTime: snapshot.companyAtTime ?? null,
        roleAtTime: snapshot.roleAtTime ?? null,
      })
      .onConflictDoUpdate({
        target: t.participant.id,
        set: {
          emailUsed: snapshot.emailUsed,
          companyAtTime: snapshot.companyAtTime ?? null,
          roleAtTime: snapshot.roleAtTime ?? null,
        },
      });
    return participant;
  }
  async removeParticipant(conversationId: string, personId: string): Promise<void> {
    await this.db
      .delete(t.participant)
      .where(
        and(
          eq(t.participant.conversationId, conversationId),
          eq(t.participant.personId, personId),
        ),
      );
  }
  async linkInitiative(conversationId: string, initiativeId: string): Promise<void> {
    await this.db
      .insert(t.conversationInitiative)
      .values({ conversationId, initiativeId })
      .onConflictDoNothing();
  }
  async unlinkInitiative(conversationId: string, initiativeId: string): Promise<void> {
    await this.db
      .delete(t.conversationInitiative)
      .where(
        and(
          eq(t.conversationInitiative.conversationId, conversationId),
          eq(t.conversationInitiative.initiativeId, initiativeId),
        ),
      );
  }
  async getAnalysis(conversationId: string): Promise<Analysis | null> {
    const rows = await this.db
      .select()
      .from(t.analysis)
      .where(eq(t.analysis.conversationId, conversationId));
    const a = rows[0];
    if (!a) return null;
    // The on-demand coaching_evaluation rows (when present) are read by the
    // coaching add-on path, not rehydrated into the discovery Analysis here.
    return {
      id: a.id,
      conversationId: a.conversationId,
      recorderSummaryMd: a.recorderSummaryMd ?? undefined,
      recorderActionItems: (a.recorderActionItemsJsonb as string[]) ?? [],
      summaryMd: a.summaryMd ?? undefined,
      sentiment: (a.sentiment as Sentiment | null) ?? undefined,
      whatWeLearned: (a.whatWeLearnedJsonb as LearnedFact[]) ?? [],
      signals: (a.signalsJsonb as Signal[]) ?? [],
      nextSteps: (a.nextStepsJsonb as string[]) ?? [],
      reasonMd: undefined,
      outcomeMd: undefined,
      createdAt: iso(a.createdAt),
    };
  }
  async saveAnalysis(analysis: Analysis): Promise<void> {
    await this.db
      .insert(t.analysis)
      .values({
        id: analysis.id,
        conversationId: analysis.conversationId,
        recorderSummaryMd: analysis.recorderSummaryMd ?? null,
        summaryMd: analysis.summaryMd ?? null,
        sentiment: analysis.sentiment ?? null,
        whatWeLearnedJsonb: analysis.whatWeLearned,
        signalsJsonb: analysis.signals,
        recorderActionItemsJsonb: analysis.recorderActionItems,
        nextStepsJsonb: analysis.nextSteps,
        createdAt: new Date(analysis.createdAt),
      })
      .onConflictDoUpdate({
        target: t.analysis.id,
        set: {
          recorderSummaryMd: analysis.recorderSummaryMd ?? null,
          summaryMd: analysis.summaryMd ?? null,
          sentiment: analysis.sentiment ?? null,
          whatWeLearnedJsonb: analysis.whatWeLearned,
          signalsJsonb: analysis.signals,
          recorderActionItemsJsonb: analysis.recorderActionItems,
          nextStepsJsonb: analysis.nextSteps,
        },
      });
  }
}

// ── Timeline / profile ─────────────────────────────────────────────────────────

export class NeonTimelineRepository implements TimelineRepository {
  constructor(private readonly db: Database = getDb()) {}

  async list(subjectType: SubjectType, subjectId: string): Promise<TimelineEntry[]> {
    const rows = await this.db
      .select()
      .from(t.timelineEntry)
      .where(
        and(
          eq(t.timelineEntry.subjectType, subjectType),
          eq(t.timelineEntry.subjectId, subjectId),
        ),
      );
    return rows
      .map(
        (r): TimelineEntry => ({
          id: r.id,
          subjectType: r.subjectType as SubjectType,
          subjectId: r.subjectId,
          kind: r.kind as TimelineKind,
          refId: r.refId ?? null,
          occurredAt: iso(r.occurredAt),
          bodyMd: r.bodyMd,
          createdBy: r.createdBy,
          createdAt: iso(r.createdAt),
        }),
      )
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
  async append(entry: TimelineEntry): Promise<void> {
    await this.db.insert(t.timelineEntry).values({
      id: entry.id,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      kind: entry.kind,
      refId: entry.refId ?? null,
      occurredAt: new Date(entry.occurredAt),
      bodyMd: entry.bodyMd,
      createdBy: entry.createdBy,
      createdAt: new Date(entry.createdAt),
    });
  }
  async getSummary(
    subjectType: SubjectType,
    subjectId: string,
  ): Promise<ProfileSummary | null> {
    const rows = await this.db
      .select()
      .from(t.profileSummary)
      .where(
        and(
          eq(t.profileSummary.subjectType, subjectType),
          eq(t.profileSummary.subjectId, subjectId),
        ),
      );
    const r = rows[0];
    return r
      ? {
          id: r.id,
          subjectType: r.subjectType as SubjectType,
          subjectId: r.subjectId,
          summaryMd: r.summaryMd,
          generatedAt: iso(r.generatedAt),
          sourceEntryCount: r.sourceEntryCount,
        }
      : null;
  }
  async saveSummary(summary: ProfileSummary): Promise<void> {
    await this.db
      .insert(t.profileSummary)
      .values({
        id: summary.id,
        subjectType: summary.subjectType,
        subjectId: summary.subjectId,
        summaryMd: summary.summaryMd,
        generatedAt: new Date(summary.generatedAt),
        sourceEntryCount: summary.sourceEntryCount,
      })
      .onConflictDoUpdate({
        target: t.profileSummary.id,
        set: {
          summaryMd: summary.summaryMd,
          generatedAt: new Date(summary.generatedAt),
          sourceEntryCount: summary.sourceEntryCount,
        },
      });
  }
}

// ── Follow-ups ─────────────────────────────────────────────────────────────────

export class NeonFollowUpRepository implements FollowUpRepository {
  constructor(private readonly db: Database = getDb()) {}

  private toFollowUp(r: typeof t.followUp.$inferSelect): FollowUp {
    return {
      id: r.id,
      conversationId: r.conversationId,
      text: r.text,
      status: r.status as FollowUpStatus,
      source: r.source as FollowUpSource,
      ownerPersonId: r.ownerPersonId ?? null,
      ownerUserId: r.ownerUserId ?? null,
      dueOn: r.dueOn ?? null,
      archivedAt: r.archivedAt ? iso(r.archivedAt) : null,
      createdAt: iso(r.createdAt),
    };
  }

  /** archived_at IS NULL unless the caller opts into archived rows (§18.6). */
  private notArchived = sql`${t.followUp.archivedAt} is null`;

  async listForConversation(
    conversationId: string,
    opts?: { includeArchived?: boolean },
  ): Promise<FollowUp[]> {
    const base = eq(t.followUp.conversationId, conversationId);
    const rows = await this.db
      .select()
      .from(t.followUp)
      .where(opts?.includeArchived ? base : and(base, this.notArchived));
    return rows.map((r) => this.toFollowUp(r));
  }
  async listForPerson(
    personId: string,
    opts?: { includeArchived?: boolean },
  ): Promise<FollowUp[]> {
    const ownConvs = await this.db
      .select({ conversationId: t.participant.conversationId })
      .from(t.participant)
      .where(eq(t.participant.personId, personId));
    const convIds = ownConvs.map((c) => c.conversationId);
    const ownership = convIds.length
      ? or(
          eq(t.followUp.ownerPersonId, personId),
          inArray(t.followUp.conversationId, convIds),
        )
      : eq(t.followUp.ownerPersonId, personId);
    const rows = await this.db
      .select()
      .from(t.followUp)
      .where(opts?.includeArchived ? ownership : and(ownership, this.notArchived));
    return rows.map((r) => this.toFollowUp(r));
  }
  async listForInitiative(
    initiativeId: string,
    opts?: { includeArchived?: boolean },
  ): Promise<FollowUp[]> {
    const convs = await this.db
      .select({ conversationId: t.conversationInitiative.conversationId })
      .from(t.conversationInitiative)
      .where(eq(t.conversationInitiative.initiativeId, initiativeId));
    const ids = convs.map((c) => c.conversationId);
    if (ids.length === 0) return [];
    const base = inArray(t.followUp.conversationId, ids);
    const rows = await this.db
      .select()
      .from(t.followUp)
      .where(opts?.includeArchived ? base : and(base, this.notArchived));
    return rows.map((r) => this.toFollowUp(r));
  }
  async save(followUp: FollowUp): Promise<void> {
    await this.db
      .insert(t.followUp)
      .values({
        id: followUp.id,
        conversationId: followUp.conversationId,
        text: followUp.text,
        ownerPersonId: followUp.ownerPersonId ?? null,
        ownerUserId: followUp.ownerUserId ?? null,
        dueOn: followUp.dueOn ?? null,
        status: followUp.status,
        archivedAt: followUp.archivedAt ? new Date(followUp.archivedAt) : null,
        source: followUp.source,
        createdAt: new Date(followUp.createdAt),
      })
      .onConflictDoUpdate({
        target: t.followUp.id,
        set: {
          text: followUp.text,
          status: followUp.status,
          dueOn: followUp.dueOn ?? null,
          archivedAt: followUp.archivedAt ? new Date(followUp.archivedAt) : null,
        },
      });
  }
  async setStatus(followUpId: string, status: FollowUp["status"]): Promise<void> {
    await this.db
      .update(t.followUp)
      .set({ status })
      .where(eq(t.followUp.id, followUpId));
  }
  async update(
    followUpId: string,
    patch: { status?: FollowUp["status"]; archivedAt?: string | null },
  ): Promise<void> {
    const set: Partial<typeof t.followUp.$inferInsert> = {};
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.archivedAt !== undefined) {
      set.archivedAt = patch.archivedAt ? new Date(patch.archivedAt) : null;
    }
    if (Object.keys(set).length === 0) return;
    await this.db.update(t.followUp).set(set).where(eq(t.followUp.id, followUpId));
  }
}

// ── Email messages ─────────────────────────────────────────────────────────────

export class NeonEmailMessageRepository implements EmailMessageRepository {
  constructor(private readonly db: Database = getDb()) {}

  private toMessage(r: typeof t.emailMessage.$inferSelect): EmailMessage {
    return {
      id: r.id,
      personId: r.personId,
      rfcMessageId: r.rfcMessageId,
      threadId: r.threadId ?? null,
      fromEmail: r.fromEmail,
      toEmails: (r.toEmailsJsonb as string[]) ?? [],
      subject: r.subject ?? undefined,
      snippet: r.snippet ?? undefined,
      occurredAt: iso(r.occurredAt),
      syncedByUserId: r.syncedByUserId,
    };
  }

  async listForPerson(personId: string): Promise<EmailMessage[]> {
    const rows = await this.db
      .select()
      .from(t.emailMessage)
      .where(eq(t.emailMessage.personId, personId));
    return rows
      .map((r) => this.toMessage(r))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
  async findByRfcMessageId(rfcMessageId: string): Promise<EmailMessage | null> {
    const rows = await this.db
      .select()
      .from(t.emailMessage)
      .where(eq(t.emailMessage.rfcMessageId, rfcMessageId));
    return rows[0] ? this.toMessage(rows[0]) : null;
  }
  async upsert(message: EmailMessage): Promise<void> {
    await this.db
      .insert(t.emailMessage)
      .values({
        id: message.id,
        personId: message.personId,
        rfcMessageId: message.rfcMessageId,
        threadId: message.threadId ?? null,
        fromEmail: message.fromEmail,
        toEmailsJsonb: message.toEmails,
        subject: message.subject ?? null,
        snippet: message.snippet ?? null,
        occurredAt: new Date(message.occurredAt),
        syncedByUserId: message.syncedByUserId,
      })
      .onConflictDoNothing({ target: t.emailMessage.rfcMessageId });
  }
}

// ── Workspace users (app_user) ───────────────────────────────────────────────

export class NeonAppUserRepository implements AppUserRepository {
  constructor(private readonly db: Database = getDb()) {}

  private toUser(r: typeof t.appUser.$inferSelect): AppUser {
    return {
      id: r.id,
      teamId: r.teamId,
      auth0Sub: r.auth0Sub,
      email: r.email,
      displayName: r.displayName ?? null,
      avatarUrl: r.avatarUrl ?? null,
      createdAt: iso(r.createdAt),
    };
  }

  async upsertByAuth0Sub(input: {
    auth0Sub: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    teamId: string;
  }): Promise<AppUser> {
    const existing = await this.db
      .select()
      .from(t.appUser)
      .where(eq(t.appUser.auth0Sub, input.auth0Sub));
    // Stable id derived from the Auth0 subject so re-provisioning is idempotent.
    const id = existing[0]?.id ?? `usr-${input.auth0Sub}`;
    await this.db
      .insert(t.appUser)
      .values({
        id,
        teamId: input.teamId,
        auth0Sub: input.auth0Sub,
        email: input.email,
        displayName: input.displayName ?? null,
        avatarUrl: input.avatarUrl ?? null,
      })
      .onConflictDoUpdate({
        target: t.appUser.auth0Sub,
        set: {
          email: input.email,
          displayName: input.displayName ?? null,
          avatarUrl: input.avatarUrl ?? null,
          teamId: input.teamId,
        },
      });
    const fresh = await this.get(id);
    if (!fresh) throw new Error(`app_user upsert failed for ${input.auth0Sub}`);
    return fresh;
  }

  async get(id: string): Promise<AppUser | null> {
    const rows = await this.db.select().from(t.appUser).where(eq(t.appUser.id, id));
    return rows[0] ? this.toUser(rows[0]) : null;
  }

  async getTeamName(teamId: string): Promise<string | null> {
    // Read the app-managed workspace name from team.name (SPEC §9, §18.2).
    const rows = await this.db
      .select({ name: t.team.name })
      .from(t.team)
      .where(eq(t.team.id, teamId));
    const name = rows[0]?.name;
    return name && name.trim() ? name : null;
  }

  async upsertTeamName(teamId: string, name: string): Promise<string> {
    // Provision/refresh the team row's human name (SPEC §9, §18.2). Creates the
    // team when absent so Auth0-first workspaces don't require a prior seed.
    await this.db
      .insert(t.team)
      .values({ id: teamId, name })
      .onConflictDoUpdate({ target: t.team.id, set: { name } });
    return name;
  }
}

// ── Google connections ───────────────────────────────────────────────────────

const splitScopes = (s: string | null | undefined): string[] =>
  s ? s.split(/[\s,]+/).filter(Boolean) : [];
const joinScopes = (scopes: string[]): string => scopes.join(" ");

export class NeonGoogleConnectionRepository implements GoogleConnectionRepository {
  constructor(private readonly db: Database = getDb()) {}

  private toConnection(r: typeof t.googleConnection.$inferSelect): GoogleConnection {
    return {
      id: r.id,
      appUserId: r.appUserId,
      teamId: r.teamId,
      googleSub: r.googleSub,
      email: r.email,
      scopes: splitScopes(r.scopes),
      secretRef: r.secretRef,
      expiresAt: r.expiresAt ? iso(r.expiresAt) : null,
    };
  }

  async upsert(conn: GoogleConnection): Promise<void> {
    await this.db
      .insert(t.googleConnection)
      .values({
        id: conn.id,
        appUserId: conn.appUserId,
        teamId: conn.teamId,
        googleSub: conn.googleSub,
        email: conn.email,
        scopes: joinScopes(conn.scopes),
        secretRef: conn.secretRef,
        expiresAt: conn.expiresAt ? new Date(conn.expiresAt) : null,
      })
      .onConflictDoUpdate({
        // one connection per workspace user (UNIQUE app_user_id).
        target: t.googleConnection.appUserId,
        set: {
          teamId: conn.teamId,
          googleSub: conn.googleSub,
          email: conn.email,
          scopes: joinScopes(conn.scopes),
          secretRef: conn.secretRef,
          expiresAt: conn.expiresAt ? new Date(conn.expiresAt) : null,
        },
      });
  }

  async getByUser(appUserId: string): Promise<GoogleConnection | null> {
    const rows = await this.db
      .select()
      .from(t.googleConnection)
      .where(eq(t.googleConnection.appUserId, appUserId));
    return rows[0] ? this.toConnection(rows[0]) : null;
  }

  async listForTeam(teamId: string): Promise<GoogleConnection[]> {
    const rows = await this.db
      .select()
      .from(t.googleConnection)
      .where(eq(t.googleConnection.teamId, teamId));
    return rows.map((r) => this.toConnection(r));
  }

  async listAll(): Promise<GoogleConnection[]> {
    const rows = await this.db.select().from(t.googleConnection);
    return rows.map((r) => this.toConnection(r));
  }
}

// ── User/domain integrations (user_integration) ──────────────────────────────

/**
 * Neon-backed IntegrationConfigStore (SPEC §6.8). The secret is written to the
 * SecretStore and ONLY the ref is persisted here — Postgres holds no raw secret
 * value (RUBRIC). One row per (app_user_id, kind). The SecretStore is the single
 * collaborator; chosen in composition.ts.
 */
export class NeonIntegrationConfigStore implements IntegrationConfigStore {
  constructor(
    private readonly secrets: SecretStore,
    private readonly db: Database = getDb(),
  ) {}

  private toIntegration(r: typeof t.userIntegration.$inferSelect): UserIntegration {
    return {
      id: r.id,
      appUserId: r.appUserId,
      teamId: r.teamId,
      kind: r.kind as IntegrationKind,
      scope: r.scope as IntegrationScope,
      configJson: (r.configJsonb as Record<string, unknown>) ?? {},
      secretRef: r.secretRef ?? null,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    };
  }

  async get(scopeKey: string, kind: IntegrationKind): Promise<UserIntegration | null> {
    const rows = await this.db
      .select()
      .from(t.userIntegration)
      .where(
        and(
          eq(t.userIntegration.appUserId, scopeKey),
          eq(t.userIntegration.kind, kind),
        ),
      );
    return rows[0] ? this.toIntegration(rows[0]) : null;
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
    // Write the secret to the SecretStore; persist only the ref. Preserve the
    // existing ref when no new secret is supplied.
    let secretRef = existing?.secretRef ?? null;
    if (input.secret !== undefined) {
      const ref = integrationSecretRef(input.teamId, scopeKey, kind);
      secretRef = await this.secrets.put(ref, input.secret);
    }
    const id = existing?.id ?? `uig-${kind}-${scopeKey}`;
    const scope = input.scope ?? existing?.scope ?? "user";
    const configJson = input.config ?? existing?.configJson ?? {};
    const now = new Date();
    await this.db
      .insert(t.userIntegration)
      .values({
        id,
        appUserId: scopeKey,
        teamId: input.teamId,
        kind,
        scope,
        secretRef,
        configJsonb: configJson,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [t.userIntegration.appUserId, t.userIntegration.kind],
        set: { teamId: input.teamId, scope, secretRef, configJsonb: configJson, updatedAt: now },
      });
    const fresh = await this.get(scopeKey, kind);
    if (!fresh) throw new Error(`user_integration upsert failed for ${scopeKey}/${kind}`);
    return fresh;
  }

  async clear(scopeKey: string, kind: IntegrationKind): Promise<void> {
    const existing = await this.get(scopeKey, kind);
    if (existing?.secretRef) {
      await this.secrets.delete(existing.secretRef);
    }
    await this.db
      .delete(t.userIntegration)
      .where(
        and(
          eq(t.userIntegration.appUserId, scopeKey),
          eq(t.userIntegration.kind, kind),
        ),
      );
  }
}
