/**
 * Person domain — the ROOT entity (SPEC §3, §4, §8.1). A Person has many email
 * identities, a history of company memberships, and participates in many
 * conversations. EmailIdentity carries a normalized value object (case/whitespace
 * folded) so it is the deterministic join key for ingestion + email sync.
 *
 * The normalization rule lives with the data it guards (CLAUDE.md law 4) via a
 * smart constructor; it mirrors lib/identity/email.mjs::normalizeEmail and the
 * identity-resolution shapes in lib/identity/resolve.mjs. No SDK, no framework,
 * no ORM, no validator imports.
 */

import type { CompanyMembership } from "./company";

export type EmailLabel = "work" | "personal" | "former" | "other";
export type EmailSource = "ingest" | "manual" | "gmail" | "calendar" | "other";

/**
 * A normalized email string — branded so a raw, un-normalized string can't be
 * mistaken for one at the type level. Construct only via `makeNormalizedEmail`.
 */
export type NormalizedEmail = string & { readonly __brand: "NormalizedEmail" };

/** Thrown when a value cannot be a valid email. */
export class InvalidEmailError extends Error {
  constructor(public readonly value: string) {
    super(`not a valid email: "${value}"`);
    this.name = "InvalidEmailError";
  }
}

/**
 * Deterministic normalization: trim + lowercase. Folds case and surrounding
 * whitespace so `"  John.Doe@Acme.COM "` and `"john.doe@acme.com"` are equal.
 * Pure; identical semantics to lib/identity/email.mjs::normalizeEmail (C5).
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Smart constructor for the branded value object. Validates a minimal shape
 * (`local@domain`) and returns the normalized, branded form, else throws.
 */
export function makeNormalizedEmail(raw: string): NormalizedEmail {
  const normalized = normalizeEmail(raw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new InvalidEmailError(raw);
  }
  return normalized as NormalizedEmail;
}

/** An email address attributed to a Person (the ingestion + sync join key). */
export interface EmailIdentity {
  id: string;
  personId: string;
  /** Normalized form (DB-unique); produced by `makeNormalizedEmail`. */
  emailNormalized: NormalizedEmail;
  label: EmailLabel;
  verified: boolean;
  source: EmailSource;
}

/** The Person root. `mergedIntoId` implements soft-merge: queries follow it. */
export interface Person {
  id: string;
  teamId: string;
  primaryDisplayName: string;
  emails: EmailIdentity[];
  memberships: CompanyMembership[];
  createdBy: string;
  createdAt: string;
  /** Set when this person was merged away; resolution follows to the survivor. */
  mergedIntoId?: string | null;
}

/** Resolution outcome for an incoming email (SPEC §4.3, RUBRIC C1/C2). */
export type IdentityStatus = "known" | "provisional";

/**
 * A non-destructive suggestion that an incoming (provisional) identity may be
 * the same human as an existing person. Surfaced for human confirmation — the
 * system NEVER silent-merges (RUBRIC C2/C6).
 */
export interface MergeSuggestion {
  /** The existing person this incoming identity might belong to. */
  personId: string;
  /** 0..1 heuristic confidence (name match, domain match, etc.). */
  confidence?: number;
  /** Human-readable why-we-suggest-this. */
  reason?: string;
}

/**
 * Result of resolving an incoming email to a person (mirrors the plain object
 * returned by lib/identity/resolve.mjs::resolveIdentity).
 * - `known`     → the email already belongs to `personId`.
 * - `provisional` → unknown email; `personId` is a NEW provisional id and
 *   `suggestions` may point at existing people to merge with.
 */
export interface IdentityResolution {
  status: IdentityStatus;
  personId: string;
  /** Present for provisional results; never auto-applied. */
  suggestions?: MergeSuggestion[];
}

/** Outcome of confirming a merge: the survivor absorbing another person. */
export interface MergeResult {
  /** The survivor person, now carrying both sets of identities + memberships. */
  survivor: Person;
  /** The id(s) merged away (their records point to the survivor). */
  absorbed: string[];
}
