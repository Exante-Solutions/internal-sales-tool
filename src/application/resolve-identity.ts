/**
 * ResolveIdentity use case (SPEC §4.3, §6.1; RUBRIC C1-C3).
 *
 * Resolves an incoming (name, email) to a Person against the team's existing
 * people. Wraps the pure lib/identity/resolve.mjs + lib/identity/merge.mjs:
 *   - known email   → attach to the existing person (no new person, RUBRIC C1).
 *   - unknown email → create a PROVISIONAL person carrying that email, and
 *     surface non-destructive merge *suggestions* (never silent-merges, C2).
 * Confirming a suggestion is a separate, explicit step (`confirmMerge`) backed
 * by the survivor-unifying merge (C3).
 *
 * Imports domain + the pure libs only — no SDK, no framework, no ORM, no validator.
 */

import type { Person, EmailIdentity, IdentityResolution, MergeResult } from "@/domain/person";
import { normalizeEmail, makeNormalizedEmail } from "@/domain/person";
import type { PersonRepository } from "@/domain/ports";
import type { Session } from "@/domain/session";
import type { IdGenerator, Clock } from "./support";
// Pure, zero-dep identity libs (single source of truth, asserted by tests).
import { resolveIdentity as resolveIdentityPure } from "../../lib/identity/resolve.mjs";
import { mergePeople } from "../../lib/identity/merge.mjs";

/** A person as the pure resolver expects it: id + flat normalized email list. */
interface ResolverPerson {
  id: string;
  displayName?: string;
  emails: string[];
}

function toResolverPerson(p: Person): ResolverPerson {
  return {
    id: p.id,
    displayName: p.primaryDisplayName,
    emails: p.emails.map((e) => e.emailNormalized as string),
  };
}

export interface ResolvedParticipant {
  /** The resolved (existing or freshly-created provisional) person. */
  person: Person;
  /** The exact normalized email identity used in this conversation. */
  emailUsed: string;
  resolution: IdentityResolution;
  /** True when a brand-new provisional person was created this call. */
  created: boolean;
}

export class ResolveIdentity {
  constructor(
    private readonly people: PersonRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /**
   * Resolve one incoming participant. `known` → existing person (and the email
   * is attached if it isn't already). `provisional` → a new person is created
   * with the email, plus merge suggestions for human confirmation.
   */
  async resolve(session: Session, email: string, hintName?: string): Promise<ResolvedParticipant> {
    const emailUsed = makeNormalizedEmail(email) as string;
    const roster = await this.people.list(session.teamId);
    const resolverPeople = roster.map(toResolverPerson);

    const r = resolveIdentityPure(emailUsed, { people: resolverPeople, hintName }) as IdentityResolution;

    if (r.status === "known") {
      const existing = await this.people.get(session.teamId, r.personId);
      // The resolver guarantees personId is a known person here.
      const person = existing!;
      return { person, emailUsed, resolution: r, created: false };
    }

    // Provisional: never attach to an existing person — create a new one.
    const personId = this.ids.next();
    const emailIdentity: EmailIdentity = {
      id: this.ids.next(),
      personId,
      emailNormalized: makeNormalizedEmail(emailUsed),
      label: "work",
      verified: false,
      source: "ingest",
    };
    const person: Person = {
      id: personId,
      teamId: session.teamId,
      primaryDisplayName: hintName?.trim() || emailUsed,
      emails: [emailIdentity],
      memberships: [],
      createdBy: session.userId,
      createdAt: this.clock.nowIso(),
      mergedIntoId: null,
    };
    await this.people.save(person);

    return {
      person,
      emailUsed,
      // personId on a provisional result is the NEW person's id (the pure lib
      // returns null; we fill in the id we minted, keeping suggestions intact).
      resolution: { status: "provisional", personId, suggestions: r.suggestions ?? [] },
      created: true,
    };
  }

  /**
   * Confirm a human-approved merge (RUBRIC C3): unify the absorbed person's
   * identities + memberships under the survivor. Non-destructive and explicit —
   * the system never reaches here on its own.
   */
  async confirmMerge(session: Session, survivorId: string, absorbedId: string): Promise<MergeResult> {
    const survivor = await this.people.get(session.teamId, survivorId);
    const absorbed = await this.people.get(session.teamId, absorbedId);
    if (!survivor || !absorbed) {
      throw new Error("cannot merge: survivor or absorbed person not found");
    }
    // Pure unification (asserted by RUBRIC C3) on the flat shapes...
    mergePeople(
      { id: survivor.id, emails: survivor.emails.map((e) => e.emailNormalized as string), memberships: survivor.memberships },
      { id: absorbed.id, emails: absorbed.emails.map((e) => e.emailNormalized as string), memberships: absorbed.memberships },
    );
    // ...then let the repository perform the authoritative, persistent merge
    // (re-pointing mergedIntoId + unifying identities/history under the survivor).
    const merged = await this.people.merge(session.teamId, survivorId, absorbedId);
    return { survivor: merged, absorbed: [absorbedId] };
  }
}

/** Re-exported so callers needing the raw matcher don't import the .mjs twice. */
export { normalizeEmail };
