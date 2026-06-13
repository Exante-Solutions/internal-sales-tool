/**
 * Session/auth fallback logic — pure, dependency-free (Feature 3, SPEC §21).
 * Single source of truth for the seeded identity and the auth-mode decision, so
 * the demo fallback (no Auth0 → seeded team) is testable offline (RUBRIC F3).
 * The TS SeededSessionGateway + composition import these.
 */

export const SEEDED_SESSION = {
  userId: "seeded-team-user",
  displayName: "Demo team",
  teamId: "seeded-team",
  isAuthenticated: false,
};

/** "auth0" only when a tenant is configured; "seeded" otherwise (the demo
 * fallback — a missing login can never break the app). */
export function authMode(env = {}) {
  return env.AUTH0_DOMAIN && env.AUTH0_CLIENT_ID ? "auth0" : "seeded";
}
