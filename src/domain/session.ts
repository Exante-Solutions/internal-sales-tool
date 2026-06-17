/**
 * Session domain type (Feature 3, SPEC §21). Identifies the current user/team
 * so calls + progress can be scoped to them. A SeededSessionGateway returns the
 * demo team today; an Auth0SessionGateway drops in behind the same port later.
 * No SDK/framework imports.
 */

export interface Session {
  userId: string;
  displayName: string;
  teamId: string;
  /**
   * The human workspace name shown in the nav (SPEC §9, §18.2). Sourced from
   * Auth0 (org_name / a custom claim) and upserted onto team.name during
   * provisioning; falls back to DEFAULT_TEAM_NAME for the seeded/offline path.
   */
  workspaceName: string;
  /** The signed-in user's email (shown in the sidebar user menu, §18.3). */
  email?: string;
  /** false for the seeded demo team; true once real Auth0 login is wired. */
  isAuthenticated: boolean;
}
