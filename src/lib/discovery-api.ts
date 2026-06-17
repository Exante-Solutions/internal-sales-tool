/**
 * Thin client-side fetch helpers + view types for the Discovery Workspace UI
 * (SPEC §10, §11). These mirror the domain shapes the API routes return; the UI
 * stays resilient if a route is not yet wired (returns null on non-OK / network
 * error) so screens still render their structural regions (RUBRIC M).
 *
 * This is presentation glue only — no SDK, no domain rules. Validation lives at
 * the route edge (Zod); the domain types live under src/domain.
 */

export type Json = Record<string, unknown>;

/** GET helper: returns parsed JSON or null (never throws) so UI degrades. */
export async function getJson<T = unknown>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** POST/PATCH/DELETE helper: returns parsed JSON or null. */
export async function sendJson<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T | null> {
  try {
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) return null;
    const text = await r.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return null;
  }
}

// ── View shapes (loose, presentation-oriented) ───────────────────────────────

export interface InitiativeView {
  id: string;
  name: string;
  type: string;
  status: string;
  goalMd?: string;
  hypothesisMd?: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  source: string;
  occurredAt?: string;
  reasonMd?: string;
  outcomeMd?: string;
  initiativeIds?: string[];
  participantNames?: string[];
}

export interface PersonListItem {
  id: string;
  primaryDisplayName: string;
  emails?: { emailNormalized: string; label?: string }[];
  currentCompany?: string | null;
}

export interface TargetView {
  id?: string;
  personId: string;
  personName?: string;
  status: string;
  reasonMd?: string;
}

export interface PeopleViewRow {
  personId: string;
  personName?: string;
  targeted: boolean;
  engaged: boolean;
  status?: string;
}

export interface FollowUpView {
  id: string;
  text: string;
  status: "open" | "done";
  source?: string;
  dueOn?: string | null;
  ownerName?: string | null;
  /** ISO timestamp when archived (SPEC §18.6); null/absent = not archived. */
  archivedAt?: string | null;
}

/** Lifecycle state derived from status + archivedAt for the UI (SPEC §18.6). */
export function followUpState(f: { status: string; archivedAt?: string | null }): "open" | "done" | "archived" {
  if (f.archivedAt) return "archived";
  return f.status === "done" ? "done" : "open";
}

export interface TimelineEntryView {
  id: string;
  kind: string;
  occurredAt: string;
  bodyMd: string;
}

export interface ProfileSummaryView {
  summaryMd: string;
  generatedAt?: string;
  sourceEntryCount?: number;
}

export interface MembershipView {
  companyId: string;
  companyName?: string;
  title?: string | null;
  startedOn?: string | null;
  endedOn?: string | null;
  isCurrent?: boolean;
}

export interface ParticipantView {
  personId: string;
  personName?: string;
  emailUsed: string;
  companyAtTime?: string | null;
  companyName?: string | null;
  roleAtTime?: string | null;
}

export interface TranscriptSeg {
  ts: number;
  speaker: string;
  text: string;
}

/**
 * An email *identity* row (a normalized address owned by a person). Returned by
 * `GET /api/people/[id]` under the `emails` key — rendered as EMAIL IDENTITIES.
 * Distinct from {@link EmailMessage} (a synced message), returned under
 * `emailMessages` (BF9).
 */
export interface EmailIdentityView {
  id?: string;
  emailNormalized: string;
  label?: string;
  verified?: boolean;
}

/**
 * A synced email *message* (one mailbox copy). Returned by
 * `GET /api/people/[id]` under the `emailMessages` key — NOT under `emails`
 * (that key holds {@link EmailIdentityView} identity rows) (BF9).
 */
export interface EmailMessage {
  id: string;
  personId: string;
  rfcMessageId: string;
  threadId?: string | null;
  fromEmail: string;
  toEmails: string[];
  subject?: string;
  snippet?: string;
  occurredAt: string;
  syncedByUserId: string;
}

/** Outreach statuses (SPEC §8.1 initiative_target.status), for the UI control. */
export const TARGET_STATUSES = [
  "to_contact",
  "contacted",
  "responded",
  "engaged",
  "passed",
] as const;

export const INITIATIVE_TYPES = [
  "market",
  "use_case",
  "persona",
  "workflow",
  "org",
] as const;

export const INITIATIVE_STATUSES = ["active", "paused", "done"] as const;

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ");
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
