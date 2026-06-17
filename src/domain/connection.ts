/**
 * Google connection domain (SPEC §6.4, §6.7, §8.1). A per-user OAuth data
 * connection to Google (Gmail + calendar). Tokens NEVER live here: Postgres
 * stores only `secretRef` (the AWS Secrets Manager ARN/name); the actual token
 * bundle is read through the SecretStore port. The SecretStore ref convention
 * for Google tokens is `<workspaceId>/<appUserId>/google` (the adapter prepends
 * the `/internal_tools/<APP_NAME>/` root).
 *
 * Plain domain type — no SDK, no framework, no ORM, no validator imports. The
 * vendor OAuth/token objects die at the adapter that produced them (CLAUDE.md
 * law 3); only this domain shape crosses into application/.
 */

/**
 * The canonical SecretStore ref for a user's Google token bundle (SPEC §6.7).
 * Workspace-scoped path `<workspaceId>/<appUserId>/google`; the adapter prepends
 * the `/internal_tools/<APP_NAME>/` root → `/internal_tools/<APP_NAME>/<workspaceId>/<appUserId>/google`.
 */
export function googleSecretRef(workspaceId: string, appUserId: string): string {
  return `${workspaceId}/${appUserId}/google`;
}

/** One connected Google account, owned by an AppUser inside a team. */
export interface GoogleConnection {
  id: string;
  /** The workspace user (app_user.id) who connected this account. */
  appUserId: string;
  /**
   * The team this connection's mailbox is queryable within. Denormalized from
   * the owning AppUser so the email-sync use case can enumerate connected
   * mailboxes for a team without a second lookup (SPEC §6.4).
   */
  teamId: string;
  /** Google's stable subject id for the connected account. */
  googleSub: string;
  /** The connected account's email address. */
  email: string;
  /** Granted OAuth scopes. */
  scopes: string[];
  /** AWS Secrets Manager ref (ARN/name) for the token bundle — by convention
   * `google/${appUserId}`. The token itself is never stored in Postgres. */
  secretRef: string;
  /** Access-token expiry (ISO), if known; refresh is handled at the adapter. */
  expiresAt?: string | null;
}
