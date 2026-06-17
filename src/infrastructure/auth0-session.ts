/**
 * Auth0SessionGateway — the live SessionGateway (SPEC §6.6, §9; RUBRIC J/K/L).
 * Reads the current Auth0 session and translates the vendor SessionData/User
 * into the domain Session (CLAUDE.md law 2/3 — the Auth0 user object dies here).
 *
 * On each request it PROVISIONS the workspace identity: the Auth0 subject is
 * upserted into the app_user row via AppUserRepository.upsertByAuth0Sub, attached
 * to the single shared DEFAULT_TEAM_ID workspace, and the returned app_user id
 * becomes the domain userId. So Auth0-provisioned users and the seeded demo
 * resolve to ONE workspace (DEFAULT_TEAM_ID), and downstream rows (Google
 * connection, calendar links) hang off a stable app_user id, not the raw sub.
 *
 * The workspace name is APP-MANAGED (SPEC §9, §18.2): it is read from the DB
 * (team.name) and surfaced on the session. Login provisioning seeds it ONCE
 * when the team has no name yet (using the optional, guarded org/claim source
 * if present, else DEFAULT_TEAM_NAME) and otherwise NEVER overwrites it — a
 * Settings rename (PATCH /api/settings/workspace) is the source of truth.
 *
 * The SeededSessionGateway is retained as the offline/test fallback; the
 * composition root selects this only when AUTH0_* env is configured.
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import { auth0 } from "@/lib/auth0";
import type { SessionGateway, AppUserRepository } from "@/domain/ports";
import type { Session } from "@/domain/session";
import { DEFAULT_TEAM_ID, DEFAULT_TEAM_NAME } from "@/domain/tenancy";

export class Auth0SessionGateway implements SessionGateway {
  // The AppUserRepository is the only collaborator; the Auth0 SDK is reached via
  // the shared `auth0` client (the SDK boundary). Wired in composition.ts.
  constructor(private readonly appUsers: AppUserRepository) {}

  /**
   * Resolve the optional, guarded SEED name for a brand-new workspace (SPEC §9,
   * §18.2). Only consulted when the team has no name yet — never an unconditional
   * per-login overwrite. Returns `org_name` when Auth0 Organizations is enabled
   * (AUTH0_ORGANIZATION), else the claim named by AUTH0_WORKSPACE_NAME_CLAIM,
   * else null (caller falls back to DEFAULT_TEAM_NAME). The Auth0 user object is
   * a bag of ID-token claims; it dies here (CLAUDE.md law 3).
   */
  private resolveWorkspaceName(claims: Record<string, unknown>): string | null {
    if (process.env.AUTH0_ORGANIZATION) {
      const orgName = claims["org_name"];
      if (typeof orgName === "string" && orgName.trim()) return orgName.trim();
    }

    const claimName = process.env.AUTH0_WORKSPACE_NAME_CLAIM;
    if (claimName) {
      const v = claims[claimName];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  }

  async current(): Promise<Session> {
    const session = await auth0.getSession();
    if (!session) {
      throw new Error("no Auth0 session for the current request");
    }
    const user = session.user;
    const displayName = user.name ?? user.nickname ?? user.email ?? user.sub;

    // Provision the workspace identity (idempotent): upsert by Auth0 sub into
    // the single shared workspace. The returned app_user id is the domain userId.
    const appUser = await this.appUsers.upsertByAuth0Sub({
      auth0Sub: user.sub,
      email: user.email ?? "",
      displayName,
      avatarUrl: user.picture ?? null,
      teamId: DEFAULT_TEAM_ID,
    });

    // The workspace name is APP-MANAGED (SPEC §9, §18.2): read it from the DB and
    // surface it. Seed a name ONCE when the team has none yet (guarded org/claim
    // source if present, else DEFAULT_TEAM_NAME); NEVER overwrite an existing name.
    let workspaceName = await this.appUsers.getTeamName(DEFAULT_TEAM_ID);
    if (!workspaceName) {
      const seed =
        this.resolveWorkspaceName(user as unknown as Record<string, unknown>) ??
        DEFAULT_TEAM_NAME;
      workspaceName = await this.appUsers.upsertTeamName(DEFAULT_TEAM_ID, seed);
    }

    return {
      userId: appUser.id,
      displayName: appUser.displayName ?? displayName,
      teamId: DEFAULT_TEAM_ID,
      workspaceName,
      email: appUser.email ?? user.email ?? undefined,
      isAuthenticated: true,
    };
  }
}
