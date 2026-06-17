/**
 * User/domain-level integration config (SPEC §6.8, §18.1). A generalized record
 * for integrations whose credentials are per-user or per-domain — not a single
 * shared app secret. Circleback is the first `kind`; future integrations are a
 * new `kind` + a Settings row, not a schema change.
 *
 * The integration's SECRET never lives here: it is written to the SecretStore
 * (AWS Secrets Manager, §6.7) and only its `secretRef` is persisted; Postgres
 * holds no raw secret value. Plain domain type — no SDK, no framework, no ORM,
 * no validator imports.
 */

/** Known integration kinds (open-ended; Circleback first). */
export const INTEGRATION_KINDS = ["circleback"] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number] | (string & {});

/** Whether the config is scoped to one user or the whole domain/team. */
export const INTEGRATION_SCOPES = ["user", "domain"] as const;
export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

/**
 * The SecretStore ref convention for an integration's per-user secret.
 * Workspace-scoped path `<workspaceId>/<appUserId>/integrations/<kind>`; the
 * adapter prepends the `/internal_tools/<APP_NAME>/` root.
 */
export function integrationSecretRef(
  workspaceId: string,
  appUserId: string,
  kind: IntegrationKind,
): string {
  return `${workspaceId}/${appUserId}/integrations/${kind}`;
}

/**
 * One stored integration config row (SPEC §8.1 user_integration). UNIQUE on
 * (appUserId, kind). `secretRef` is the SecretStore handle, never the secret.
 */
export interface UserIntegration {
  id: string;
  /** The workspace user this config belongs to (UNIQUE with `kind`). */
  appUserId: string;
  /** Denormalized team scope, so domain-scoped lookups don't need a join. */
  teamId: string;
  kind: IntegrationKind;
  scope: IntegrationScope;
  /** Non-secret config (free-form per kind). */
  configJson: Record<string, unknown>;
  /** AWS Secrets Manager ref for the secret material, or null if none stored. */
  secretRef?: string | null;
  createdAt: string;
  updatedAt: string;
}
