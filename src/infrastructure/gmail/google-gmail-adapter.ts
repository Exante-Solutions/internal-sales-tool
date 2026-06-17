/**
 * GoogleGmailAdapter — the live GmailGateway (SPEC §6.4). On-demand, per-contact
 * pull from ONE connected mailbox; the use case fans this across every team
 * mailbox and dedupes by RFC Message-ID. There is NO background sync — this is
 * only ever called when a user opens a contact. Per-user OAuth tokens are read
 * via the SecretStore (never inline), then the Gmail vendor objects die here:
 * only domain GmailThreadMessage values cross out (CLAUDE.md law 2/3).
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import type { GmailGateway, GmailThreadMessage } from "@/domain/ports";
import type { SecretStore } from "@/domain/ports";
import { normalizeEmail } from "@/domain/person";

/** The token bundle shape we persist in the SecretStore at OAuth callback. */
interface GoogleTokenBundle {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}

export class GoogleGmailAdapter implements GmailGateway {
  constructor(
    private readonly secrets: SecretStore,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async fetchMessagesForEmails(
    emails: string[],
    mailboxUserId: string,
    secretRef: string,
  ): Promise<GmailThreadMessage[]> {
    const targets = emails.map(normalizeEmail).filter(Boolean);
    if (targets.length === 0) return [];

    const gmail = await this.clientFor(secretRef);
    // Gmail search: any of the person's emails as from/to. Vendor query string.
    const query = targets.map((e) => `from:${e} OR to:${e}`).join(" OR ");

    const list = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 50,
    });

    const ids = (list.data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id);
    const out: GmailThreadMessage[] = [];
    for (const id of ids) {
      const full = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["Message-ID", "From", "To", "Subject", "Date"],
      });
      const msg = this.toDomain(full.data, mailboxUserId);
      if (msg) out.push(msg);
    }
    return out;
  }

  /** Build an authed Gmail client from the per-user token bundle in the store. */
  private async clientFor(secretRef: string): Promise<gmail_v1.Gmail> {
    const raw = await this.secrets.get(secretRef);
    if (!raw) throw new Error(`no Google token bundle for secret_ref ${secretRef}`);
    const bundle = JSON.parse(raw) as GoogleTokenBundle;

    const oauth2 = new google.auth.OAuth2(
      this.env.GOOGLE_CLIENT_ID,
      this.env.GOOGLE_CLIENT_SECRET,
      this.env.GOOGLE_OAUTH_REDIRECT_URL,
    );
    oauth2.setCredentials({
      access_token: bundle.access_token,
      refresh_token: bundle.refresh_token,
      expiry_date: bundle.expiry_date,
      scope: bundle.scope,
      token_type: bundle.token_type,
    });
    // Server-side refresh rewrites the secret so the next pull stays authed.
    oauth2.on("tokens", (tokens) => {
      const next: GoogleTokenBundle = {
        ...bundle,
        access_token: tokens.access_token ?? bundle.access_token,
        refresh_token: tokens.refresh_token ?? bundle.refresh_token,
        expiry_date: tokens.expiry_date ?? bundle.expiry_date,
        scope: tokens.scope ?? bundle.scope,
        token_type: tokens.token_type ?? bundle.token_type,
      };
      void this.secrets.rotate(secretRef, JSON.stringify(next));
    });
    return google.gmail({ version: "v1", auth: oauth2 });
  }

  /** Translate a Gmail metadata message into the domain contract (or null). */
  private toDomain(
    data: gmail_v1.Schema$Message,
    mailboxUserId: string,
  ): GmailThreadMessage | null {
    const headers = data.payload?.headers ?? [];
    const header = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;

    const rfcMessageId = header("Message-ID");
    if (!rfcMessageId) return null;

    const fromEmail = normalizeEmail(extractEmail(header("From")) ?? "");
    const toEmails = (header("To") ?? "")
      .split(",")
      .map((p) => normalizeEmail(extractEmail(p) ?? ""))
      .filter(Boolean);
    const dateHeader = header("Date");
    const occurredAt = dateHeader
      ? new Date(dateHeader).toISOString()
      : data.internalDate
        ? new Date(Number(data.internalDate)).toISOString()
        : new Date().toISOString();

    return {
      rfcMessageId,
      threadId: data.threadId ?? undefined,
      fromEmail,
      toEmails,
      subject: header("Subject"),
      snippet: data.snippet ?? undefined,
      occurredAt,
      mailboxUserId,
    };
  }
}

/** Pull the bare address out of a "Name <addr@x>" header value. */
function extractEmail(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim();
}
