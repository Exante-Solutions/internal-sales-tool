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
  /** false for the seeded demo team; true once real Auth0 login is wired. */
  isAuthenticated: boolean;
}
