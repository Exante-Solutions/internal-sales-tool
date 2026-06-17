/**
 * AddParticipant use case (BUG_FIX B2; SPEC §7 affiliation snapshot).
 *
 * A conversation's participants are normally frozen from the transcript. This is
 * the manual path: attach a tracked Person to a conversation and FREEZE their
 * affiliation snapshot at conversation time — which email they used and which
 * company employed them THEN (RUBRIC D3/D4). The snapshot is computed by the pure
 * lib `participantSnapshot` (membershipAt under the hood); later company moves
 * never rewrite this row.
 *
 * Pure orchestration: imports domain + ports + the pure snapshot lib only. No SDK,
 * no framework, no ORM, no validator.
 */

import type { Person } from "@/domain/person";
import type { Participant } from "@/domain/conversation";
import type { Session } from "@/domain/session";
import type {
  ConversationRepository,
  PersonRepository,
} from "@/domain/ports";
import { participantSnapshot } from "../../lib/conversation/snapshot.mjs";

export class AddParticipant {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly people: PersonRepository,
  ) {}

  /**
   * Attach `personId` to `conversationId`, snapshotting their primary email and
   * current-membership company at the conversation's occurredAt.
   */
  async add(
    session: Session,
    conversationId: string,
    personId: string,
  ): Promise<Participant> {
    const conversation = await this.conversations.get(session.teamId, conversationId);
    if (!conversation) throw new Error(`conversation not found: ${conversationId}`);

    const person = await this.people.get(session.teamId, personId);
    if (!person) throw new Error(`person not found: ${personId}`);

    // The snapshot lib speaks plain objects (emails: string[], memberships[]);
    // adapt the domain Person at this boundary. A manual add has no call-specific
    // address, so pass a deterministic preferred email (a verified identity, else
    // the first) rather than relying on the snapshot's first-email fallback —
    // which is wrong for multi-identity people.
    const snapshot = participantSnapshot(
      personViewForSnapshot(person),
      conversation.occurredAt,
      preferredEmailFor(person),
    ) as { emailUsed?: string; companyAtTime: string | null };

    return this.conversations.addParticipant(conversationId, {
      personId,
      emailUsed: snapshot.emailUsed ?? "",
      companyAtTime: snapshot.companyAtTime,
      roleAtTime: roleAt(person, conversation.occurredAt),
    });
  }
}

/**
 * Deterministic email for a manual add (no call address to read). Prefer a
 * verified identity; otherwise the first email. Returns undefined only when the
 * person has no emails, letting the snapshot fall back harmlessly.
 */
function preferredEmailFor(person: Person): string | undefined {
  const verified = person.emails.find((e) => e.verified);
  const chosen = verified ?? person.emails[0];
  return chosen ? (chosen.emailNormalized as unknown as string) : undefined;
}

/** Domain Person → the plain shape participantSnapshot/membershipAt expect. */
function personViewForSnapshot(person: Person): {
  emails: string[];
  memberships: Person["memberships"];
} {
  return {
    emails: person.emails.map((e) => e.emailNormalized as unknown as string),
    memberships: person.memberships,
  };
}

/** Title from the membership current at the conversation time, if any. */
function roleAt(person: Person, occurredAtISO: string): string | null {
  const day = String(occurredAtISO ?? "").slice(0, 10);
  const matches = person.memberships.filter((m) => {
    const start = m.startedOn ? String(m.startedOn).slice(0, 10) : null;
    const end = m.endedOn ? String(m.endedOn).slice(0, 10) : null;
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
  if (matches.length === 0) return null;
  const best = matches.reduce((b, m) =>
    (m.startedOn ?? "") > (b.startedOn ?? "") ? m : b,
  );
  return best.title ?? null;
}
