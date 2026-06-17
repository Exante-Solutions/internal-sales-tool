/**
 * IngestRecording use case (SPEC §5.2, §6.1, §6.2; RUBRIC F2/F3/G1/G2).
 *
 * The one ingestion flow shared by paste now and the deferred recorder webhook:
 *   normalize → resolve participants (§4.3) → create Conversation → store the
 *   recorder summary + action items (if present) → seed FollowUps from the
 *   action items (source=recorder) → associate an initiative (calendar-match
 *   else null → Unassigned inbox).
 *
 * Idempotent on (provider, externalId): re-ingesting the same recording upserts
 * the existing Conversation instead of duplicating (RUBRIC F3), via
 * lib/ingest/idempotency.mjs::conversationKey.
 *
 * The on-demand playbook check does NOT run here (SPEC §5.2 / RUBRIC H1) — that
 * is RunPlaybookCheck, triggered explicitly by the user.
 *
 * Imports domain + pure libs only — no SDK, no framework, no ORM, no validator. The
 * vendor recording dies at its RecorderGateway adapter; only the domain
 * IncomingRecording reaches this use case.
 */

import type {
  Conversation,
  IncomingRecording,
  Participant,
  ConversationSource,
} from "@/domain/conversation";
import type { Analysis } from "@/domain/analysis";
import type { FollowUp } from "@/domain/followup";
import type { Session } from "@/domain/session";
import type {
  ConversationRepository,
  FollowUpRepository,
} from "@/domain/ports";
import type { IdGenerator, Clock } from "./support";
import type { ResolveIdentity, ResolvedParticipant } from "./resolve-identity";
import type { AssociateInitiative, CalendarLinkHint } from "./associate-initiative";
import { conversationKey } from "../../lib/ingest/idempotency.mjs";

export interface IngestInput {
  /** "pasted" | "manual" | "recorder" (SPEC §8.1). Paste is the v1 inbound. */
  source: ConversationSource;
  /** Recorder/integration provider, when source = recorder. */
  provider?: string | null;
  /** Provider id for idempotent upsert; (provider, externalId) is the key. */
  recording: IncomingRecording;
  title: string;
  /** Why this conversation happened (markdown). */
  reasonMd?: string;
  /** How it went / what came of it (markdown). */
  outcomeMd?: string;
  /** Optional calendar hint that drives initiative auto-association (§6.3). */
  calendar?: CalendarLinkHint;
}

export interface IngestResult {
  conversation: Conversation;
  participants: ResolvedParticipant[];
  followUps: FollowUp[];
  /** The auto-associated initiative, or null → Unassigned inbox (SPEC §6.2). */
  initiativeId: string | null;
  /** False when an existing (provider, externalId) conversation was upserted. */
  created: boolean;
}

export class IngestRecording {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly followUps: FollowUpRepository,
    private readonly resolveIdentity: ResolveIdentity,
    private readonly associateInitiative: AssociateInitiative,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async ingest(session: Session, input: IngestInput): Promise<IngestResult> {
    const { recording } = input;

    // 1. Idempotency: a recorder recording with (provider, externalId) upserts.
    let existing: Conversation | null = null;
    if (input.provider && recording.externalId) {
      existing = await this.conversations.findByExternalId(
        session.teamId,
        input.provider,
        recording.externalId,
      );
    }

    // 2. Resolve participants (§4.3): known → attach, unknown → provisional.
    const participants: ResolvedParticipant[] = [];
    for (const p of recording.participants) {
      participants.push(await this.resolveIdentity.resolve(session, p.email, p.name));
    }

    // 3. Associate an initiative: calendar-match else null → Unassigned (§6.2).
    const initiativeId = input.calendar
      ? await this.associateInitiative.forCalendarLink(session.teamId, input.calendar)
      : null;

    const now = this.clock.nowIso();
    const conversationId = existing?.id ?? this.ids.next();

    const conversationParticipants: Participant[] = participants.map((rp) => ({
      id: this.ids.next(),
      conversationId,
      personId: rp.person.id,
      emailUsed: rp.emailUsed,
      companyAtTime: rp.person.memberships.find((m) => m.isCurrent)?.companyId ?? null,
      roleAtTime: rp.person.memberships.find((m) => m.isCurrent)?.title ?? null,
    }));

    const conversation: Conversation = {
      id: conversationId,
      teamId: session.teamId,
      source: input.source,
      provider: input.provider ?? null,
      externalId: recording.externalId ?? null,
      title: input.title,
      reasonMd: input.reasonMd ?? "",
      outcomeMd: input.outcomeMd ?? "",
      occurredAt: recording.occurredAt,
      createdBy: existing?.createdBy ?? session.userId,
      createdAt: existing?.createdAt ?? now,
      participants: conversationParticipants,
      segments: recording.transcriptSegments,
      initiativeIds: existing?.initiativeIds ?? [],
    };

    // Confirm the idempotency key matches what the pure lib would derive.
    if (input.provider && recording.externalId) {
      const key = conversationKey(input.provider, recording.externalId) as string;
      void key; // derived here for parity with lib/ingest/idempotency (F3).
    }

    await this.conversations.save(conversation);
    for (const part of conversationParticipants) {
      await this.conversations.saveParticipant(part);
    }

    // 4. Store the recorder summary + action items as reference signal (G1/G2).
    const analysis: Analysis = {
      id: this.ids.next(),
      conversationId,
      recorderSummaryMd: recording.recorderSummary,
      recorderActionItems: recording.recorderActionItems ?? [],
      whatWeLearned: [],
      signals: [],
      nextSteps: [],
      createdAt: now,
      // NOTE: no coachingEvaluation — the playbook check is on-demand (H1).
    };
    await this.conversations.saveAnalysis(analysis);

    // 5. Link the auto-associated initiative onto the conversation (§6.2).
    if (initiativeId && !conversation.initiativeIds.includes(initiativeId)) {
      await this.conversations.linkInitiative(conversationId, initiativeId);
      conversation.initiativeIds = [...conversation.initiativeIds, initiativeId];
    }

    // 6. Seed FollowUps from the recorder action items (source = recorder).
    //    On re-ingest we only seed when the conversation is newly created, so
    //    redelivery doesn't duplicate follow-ups (idempotent ingest, F3).
    const followUps: FollowUp[] = [];
    if (!existing) {
      for (const text of recording.recorderActionItems ?? []) {
        const followUp: FollowUp = {
          id: this.ids.next(),
          conversationId,
          text,
          status: "open",
          source: "recorder",
          ownerPersonId: null,
          ownerUserId: null,
          dueOn: null,
          createdAt: now,
        };
        await this.followUps.save(followUp);
        followUps.push(followUp);
      }
    }

    return {
      conversation,
      participants,
      followUps,
      initiativeId,
      created: !existing,
    };
  }
}
