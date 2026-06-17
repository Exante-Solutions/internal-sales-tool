/**
 * Auth0 SDK client (server-only) — the single SDK boundary for login (SPEC §6.6,
 * §9, §17; RUBRIC J/K/L). @auth0/nextjs-auth0 v4: one Auth0Client instance owns
 * the /auth/* routes (mounted by middleware) and getSession(). It reads its
 * config from env — AUTH0_DOMAIN / AUTH0_CLIENT_ID / AUTH0_CLIENT_SECRET /
 * AUTH0_SECRET / APP_BASE_URL — so this module is import-only at module scope.
 *
 * Organizations (SPEC §9, §18.2): v4 does NOT auto-read an org env var, so when
 * AUTH0_ORGANIZATION is set we pass it through `authorizationParameters` to
 * scope login to that org. With the tenant's "Allow Organization Names in
 * Authentication API" toggle on, the ID token then carries `org_id` + `org_name`,
 * and `Auth0SessionGateway` upserts `org_name` onto `team.name`. Unset → a plain
 * (non-org) login, and the workspace name falls back to DEFAULT_TEAM_NAME.
 *
 * This is infrastructure: never import it from a domain/ or application/ file,
 * and never from a "use client" component (it reads server secrets).
 */

import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Constructed once per server process. With AUTH0_* unset the SDK throws only
// when a route actually touches it; middleware short-circuits /auth/* to the
// seeded path before that happens (see middleware.ts), so the offline/seeded
// build never instantiates against missing config at request time.
const organization = process.env.AUTH0_ORGANIZATION;
export const auth0 = new Auth0Client(
  organization ? { authorizationParameters: { organization } } : undefined,
);
