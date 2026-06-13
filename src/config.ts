/**
 * CoachLoop — shared configuration & declared variables.
 *
 * Built during Claude Build Day (Anthropic + Cerebral Valley),
 * San Francisco, 2026-06-13. Open source under MIT.
 */

/** Hackathon metadata — single source of truth for "this was built at the event". */
export const HACKATHON = {
  name: "Claude Build Day",
  host: "Anthropic + Cerebral Valley",
  location: "Shack15, Ferry Building, San Francisco, CA",
  date: "2026-06-13",
  author: "Seb Vargas",
  github: "sebvargo",
} as const;

/** Anthropic model. Opus 4.8 is the target model for this build. */
export const MODEL = "claude-opus-4-8" as const;

/** Generation defaults for coaching responses. */
export const MAX_TOKENS = 2048;

/** Required server-side env vars. Fail fast if missing. */
export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("Missing ANTHROPIC_API_KEY — copy .env.example to .env.");
  }
  return key;
}
