/**
 * Conversation domain (SPEC §3, §6.1, §8.1). A Conversation is the atomic
 * external-interaction record — source-agnostic (recorded, pasted, or manually
 * logged). A Participant freezes the affiliation snapshot (email used + company
 * + role at conversation time) so a pre-move call stays under the old company
 * (RUBRIC D3/D4). The IncomingRecording is the normalized inbound contract that
 * paste uses now and the deferred recorder webhook reuses (SPEC §6.1).
 * No SDK, no framework, no ORM, no validator imports.
 */

import type { TranscriptSegment } from "./coaching";

/** SPEC §8.1 conversation.source. */
export const CONVERSATION_SOURCES = ["recorder", "pasted", "manual"] as const;
export type ConversationSource = (typeof CONVERSATION_SOURCES)[number];

/**
 * A Person's involvement in a Conversation with the affiliation snapshot frozen
 * at conversation time. `companyAtTime` reflects the employer THEN, not now.
 */
export interface Participant {
  id: string;
  conversationId: string;
  personId: string;
  /** The exact email identity used in this conversation. */
  emailUsed: string;
  /** Company id in effect when the conversation occurred (frozen snapshot). */
  companyAtTime?: string | null;
  /** Title/role in effect at conversation time. */
  roleAtTime?: string | null;
}

export interface Conversation {
  id: string;
  teamId: string;
  source: ConversationSource;
  /** Recorder/integration provider, when source = recorder. */
  provider?: string | null;
  /** Provider's id for idempotent upsert; UNIQUE(provider, externalId). */
  externalId?: string | null;
  title: string;
  /** Markdown: why this conversation happened. */
  reasonMd: string;
  /** Markdown: how it went / what came of it. */
  outcomeMd: string;
  occurredAt: string;
  createdBy: string;
  createdAt: string;
  participants: Participant[];
  segments: TranscriptSegment[];
  /** Initiative ids this conversation is linked to (many-to-many). */
  initiativeIds: string[];
}

/** A participant as it arrives on the wire, before identity resolution. */
export interface IncomingParticipant {
  name: string;
  email: string;
}

/**
 * The normalized inbound recording contract (SPEC §6.1). Used by the paste path
 * now and the deferred Circleback/Fathom webhooks later. Idempotent upsert is
 * keyed by (provider, externalId) when present.
 */
export interface IncomingRecording {
  externalId?: string;
  occurredAt: string;
  participants: IncomingParticipant[];
  transcriptSegments: TranscriptSegment[];
  recorderSummary?: string;
  recorderActionItems: string[];
}
