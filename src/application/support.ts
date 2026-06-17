/**
 * Small application-support interfaces. The use cases must construct domain
 * entities (which carry ids + timestamps) while staying pure and offline-
 * testable (CLAUDE.md law 7): a use case asks an injected `IdGenerator` /
 * `Clock` rather than reaching for `crypto`/`Date` directly, so a test pins
 * deterministic ids + time with no globals. Concretes are wired at the
 * composition root; fakes drive the offline run.
 *
 * These are dependency interfaces, not vendor types — no SDK/framework/zod here.
 */

/** Source of unique ids for new domain entities. */
export interface IdGenerator {
  next(): string;
}

/** Source of the current wall-clock time (ISO 8601). */
export interface Clock {
  nowIso(): string;
}
