/**
 * FakeGmailAdapter — the offline/test GmailGateway (SPEC §6.4). Returns
 * deterministic thread messages for a person's emails, simulating a cross-mailbox
 * pull: the SAME RFC Message-ID surfaces from more than one mailbox, so the use
 * case's dedupe (lib/email/dedupe) is exercised offline with no Google OAuth and
 * no AWS-stored tokens (CLAUDE.md law 7). Vendor objects never appear — it speaks
 * the domain GmailThreadMessage directly.
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import type { GmailGateway, GmailThreadMessage } from "@/domain/ports";
import { normalizeEmail } from "@/domain/person";

export class FakeGmailAdapter implements GmailGateway {
  /**
   * Deterministic threads for `emails`, attributed to the `mailboxUserId`'s
   * mailbox. The shared <thread-shared> message id is emitted from EVERY mailbox
   * so the caller's RFC-Message-ID dedupe collapses it to one (RUBRIC J2/J3).
   */
  async fetchMessagesForEmails(
    emails: string[],
    mailboxUserId: string,
    _secretRef: string,
  ): Promise<GmailThreadMessage[]> {
    const targets = emails.map(normalizeEmail).filter(Boolean);
    if (targets.length === 0) return [];
    const primary = targets[0];

    return [
      // Cross-mailbox shared message — same id from any mailbox → dedupes to one.
      {
        rfcMessageId: "<thread-shared@mail.example>",
        threadId: "t-shared",
        fromEmail: primary,
        toEmails: ["rep@seeded-team.example"],
        subject: "Re: following up on our call",
        snippet: "Thanks for the time today — here's what I promised to send over.",
        occurredAt: "2026-06-13T09:00:00Z",
        mailboxUserId,
      },
      // Mailbox-specific message so each mailbox contributes something unique.
      {
        rfcMessageId: `<thread-${mailboxUserId}@mail.example>`,
        threadId: `t-${mailboxUserId}`,
        fromEmail: "rep@seeded-team.example",
        toEmails: [primary],
        subject: "Quick question before next week",
        snippet: "One more thing on the reconciliation workflow you mentioned.",
        occurredAt: "2026-06-14T15:30:00Z",
        mailboxUserId,
      },
    ];
  }
}
