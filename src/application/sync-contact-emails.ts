/**
 * SyncContactEmails use case (SPEC §6.4; RUBRIC J1-J5).
 *
 * On-demand only (no background sync): when a user opens a contact, pull that
 * person's email threads across ALL connected team mailboxes, dedupe shared
 * threads by RFC Message-ID, and persist them permanently as EmailMessages +
 * timeline entries — so the profile survives even if mailbox access later
 * changes. The person is matched by ANY of their email identities (spans all
 * addresses, RUBRIC C4).
 *
 * Tokens are read via the SecretStore (never inline). The vendor mail payload
 * dies at the GmailGateway adapter; only domain-shaped GmailThreadMessage /
 * EmailMessage cross into this use case.
 *
 * Imports domain + the pure dedupe lib only — no SDK, no framework, no ORM, no
 * validator.
 */

import type { EmailMessage, TimelineEntry } from "@/domain/profile";
import type {
  GmailGateway,
  GmailThreadMessage,
  PersonRepository,
  EmailMessageRepository,
  TimelineRepository,
  SecretStore,
  GoogleConnectionRepository,
} from "@/domain/ports";
import type { Session } from "@/domain/session";
import type { IdGenerator, Clock } from "./support";
import { dedupeMessages } from "../../lib/email/dedupe.mjs";

/** One connected team mailbox: whose it is + how to read its token. */
export interface ConnectedMailbox {
  /** The workspace user whose Google account this is. */
  mailboxUserId: string;
  /** SecretStore ref (ARN/name) for this user's OAuth token bundle. */
  secretRef: string;
}

export interface SyncResult {
  /** Newly persisted, deduped messages (excludes ones already stored). */
  persisted: EmailMessage[];
  /** Total deduped messages seen across all mailboxes (incl. pre-existing). */
  seen: number;
}

export class SyncContactEmails {
  constructor(
    private readonly people: PersonRepository,
    private readonly emails: EmailMessageRepository,
    private readonly timeline: TimelineRepository,
    private readonly gmail: GmailGateway,
    private readonly secrets: SecretStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    /** Connected-mailbox source (SPEC §6.4). Optional so the use case still
     * constructs offline/in tests without a connection repo; when present,
     * `sync` enumerates every connected team mailbox automatically. */
    private readonly connections?: GoogleConnectionRepository,
  ) {}

  /**
   * Resolve every connected mailbox in a team from `google_connection`
   * (SPEC §6.4). Each connection's `secretRef` reads its OAuth token bundle.
   */
  async mailboxesForTeam(teamId: string): Promise<ConnectedMailbox[]> {
    if (!this.connections) return [];
    const conns = await this.connections.listForTeam(teamId);
    return conns.map((c) => ({ mailboxUserId: c.appUserId, secretRef: c.secretRef }));
  }

  /**
   * @param mailboxes every connected team mailbox to query (SPEC §6.4 aggregate
   *   across all connected team mailboxes). When omitted, the connected team
   *   mailboxes are resolved from the GoogleConnectionRepository.
   */
  async sync(
    session: Session,
    personId: string,
    mailboxes?: ConnectedMailbox[],
  ): Promise<SyncResult> {
    const boxes = mailboxes ?? (await this.mailboxesForTeam(session.teamId));
    const person = await this.people.get(session.teamId, personId);
    if (!person) throw new Error(`person not found: ${personId}`);
    const personEmails = person.emails.map((e) => e.emailNormalized as string);

    // Pull from every connected mailbox, skipping those whose token is missing.
    const all: GmailThreadMessage[] = [];
    for (const box of boxes) {
      const token = await this.secrets.get(box.secretRef);
      if (!token) continue; // no usable credential → skip this mailbox (J4).
      const msgs = await this.gmail.fetchMessagesForEmails(
        personEmails,
        box.mailboxUserId,
        box.secretRef,
      );
      all.push(...msgs);
    }

    // Dedupe shared threads across mailboxes by RFC Message-ID (J2/J3).
    const deduped = dedupeMessages(all) as GmailThreadMessage[];

    const persisted: EmailMessage[] = [];
    const now = this.clock.nowIso();
    for (const m of deduped) {
      // Idempotent: a Message-ID already stored is not re-persisted (J5).
      const already = await this.emails.findByRfcMessageId(m.rfcMessageId);
      if (already) continue;

      const message: EmailMessage = {
        id: this.ids.next(),
        personId: person.id,
        rfcMessageId: m.rfcMessageId,
        threadId: m.threadId ?? null,
        fromEmail: m.fromEmail,
        toEmails: m.toEmails,
        subject: m.subject,
        snippet: m.snippet,
        occurredAt: m.occurredAt,
        syncedByUserId: m.mailboxUserId,
      };
      await this.emails.upsert(message);

      // Persist permanently to the person's append-only timeline (J1).
      const entry: TimelineEntry = {
        id: this.ids.next(),
        subjectType: "person",
        subjectId: person.id,
        kind: "email",
        refId: message.id,
        occurredAt: m.occurredAt,
        bodyMd: m.subject ? `**${m.subject}**\n\n${m.snippet ?? ""}` : (m.snippet ?? ""),
        createdBy: session.userId,
        createdAt: now,
      };
      await this.timeline.append(entry);

      persisted.push(message);
    }

    return { persisted, seen: deduped.length };
  }
}
