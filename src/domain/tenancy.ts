/**
 * Tenancy — the workspace boundary (SPEC §6.6, §9, §17). The Discovery Workspace
 * is a single shared team in this build: Auth0 provisioning attaches every signed-in
 * user to DEFAULT_TEAM_ID, and the seed creates that one team row with the same id,
 * so seeded and live identities resolve to the same workspace scope.
 *
 * `AppUser` is the workspace-side identity row (mirrors SPEC §8.1 app_user),
 * minted from an Auth0 subject. It is a plain domain type — no SDK, no framework,
 * no ORM, no validator imports.
 */

/**
 * The single shared workspace id. Stable string so the seed, Auth0 provisioning,
 * and every team-scoped query agree on one workspace. Intentionally equals the
 * seeded session's teamId (lib/auth/session.mjs::SEEDED_SESSION.teamId) so the
 * offline/seeded path and live Auth0 users resolve to the SAME workspace scope —
 * a provisioned user sees the seeded demo data, not an empty silo. (When a real
 * Auth0 org is wired, org_id can override this per-tenant.)
 */
export const DEFAULT_TEAM_ID = "seeded-team";

/** Human-readable name for the seeded DEFAULT_TEAM_ID row. */
export const DEFAULT_TEAM_NAME = "Discovery Workspace";

/**
 * A workspace user (SPEC §8.1 app_user). Provisioned from an Auth0 subject and
 * attached to a team. The Google connection + calendar links hang off `id`.
 */
export interface AppUser {
  id: string;
  teamId: string;
  /** The Auth0 `sub` — the stable external identity key (UNIQUE). */
  auth0Sub: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
}
