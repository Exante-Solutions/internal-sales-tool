/**
 * AwsSecretsManagerAdapter — the live SecretStore backed by AWS Secrets Manager
 * (SPEC §6.7, §17). Per-user OAuth token bundles live here; Postgres stores only
 * the returned secret_ref (name/ARN). The AWS SDK client + its errors die here;
 * only domain strings cross out.
 *
 * Credentials: prefer the SDK's default credential provider chain, which honors
 * AWS_PROFILE (incl. SSO) and attached IAM roles — the local/dev path is
 * `AWS_PROFILE` + `aws sso login`. Explicit AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
 * are used only when both are present. Region is read from AWS_REGION when set,
 * otherwise resolved from the active profile/config by the SDK.
 *
 * Encryption: AWS_KMS_KEY_ID (CMK ARN/ID/alias), when set, binds the secret to
 * that key at CreateSecret time; rotations/puts reuse the bound key.
 *
 * This class name appears only here + composition.ts (CLAUDE.md law 6).
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  PutSecretValueCommand,
  DeleteSecretCommand,
  ResourceExistsException,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";
import type { SecretStore } from "@/domain/ports";

export class AwsSecretsManagerAdapter implements SecretStore {
  private readonly client: SecretsManagerClient;
  private readonly prefix: string;
  private readonly kmsKeyId?: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    // Structured secret-name root (SPEC §6.7, §17): /internal_tools/<APP_NAME>/.
    // Combined with the workspace-scoped caller ref (<workspaceId>/<userId>/…),
    // every secret is namespaced per app + workspace + user. Falls back to the
    // legacy flat AWS_SECRETS_PREFIX when APP_NAME is unset.
    const appName = env.APP_NAME?.trim();
    this.prefix = appName ? `/internal_tools/${appName}/` : (env.AWS_SECRETS_PREFIX ?? "");
    this.kmsKeyId = env.AWS_KMS_KEY_ID || undefined;

    // Prefer the SDK default credential chain — it honors AWS_PROFILE (incl. SSO)
    // and attached IAM roles. Use explicit keys only when both are present.
    const credentials =
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined;

    // Region from AWS_REGION when set; otherwise the SDK resolves it from the
    // active profile/config (e.g. an SSO profile's configured region).
    this.client = new SecretsManagerClient({
      ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
      ...(credentials ? { credentials } : {}),
    });
  }

  /**
   * Full secret name = optional prefix + the caller's ref, sanitized to the AWS
   * Secrets Manager name charset (alphanumeric + `-/_+=.@!`). Domain refs like
   * `google/<appUserId>` can carry an Auth0 sub (`auth0|abc`), and `|` is NOT a
   * legal name char — it would raise ValidationException. We map any disallowed
   * char to `-`. Idempotent (sanitizing an already-clean name is a no-op), so
   * put() can store the sanitized name and get() re-derives the same one.
   */
  private nameFor(ref: string): string {
    const full = this.prefix ? `${this.prefix}${ref}` : ref;
    return full.replace(/[^A-Za-z0-9/_+=.@!-]/g, "-");
  }

  /**
   * Create-or-update (idempotent). Returns the LOGICAL `ref` (what callers
   * persist as `secret_ref`), not the prefixed AWS name — so `get(ref)` maps it
   * through `nameFor` exactly once and the `/internal_tools/…` root is never
   * doubled.
   */
  async put(ref: string, value: string): Promise<string> {
    const Name = this.nameFor(ref);
    try {
      await this.client.send(
        new CreateSecretCommand({
          Name,
          SecretString: value,
          ...(this.kmsKeyId ? { KmsKeyId: this.kmsKeyId } : {}),
        }),
      );
    } catch (err) {
      if (err instanceof ResourceExistsException) {
        await this.client.send(new PutSecretValueCommand({ SecretId: Name, SecretString: value }));
      } else {
        throw err;
      }
    }
    return ref;
  }

  async get(ref: string): Promise<string | null> {
    try {
      const out = await this.client.send(
        new GetSecretValueCommand({ SecretId: this.nameFor(ref) }),
      );
      return out.SecretString ?? null;
    } catch (err) {
      if (err instanceof ResourceNotFoundException) return null;
      throw err;
    }
  }

  /** Server-side token refresh — rewrites the secret in place; returns the ref. */
  async rotate(ref: string, value: string): Promise<string> {
    await this.client.send(
      new PutSecretValueCommand({ SecretId: this.nameFor(ref), SecretString: value }),
    );
    return ref;
  }

  async delete(ref: string): Promise<void> {
    await this.client.send(
      new DeleteSecretCommand({ SecretId: this.nameFor(ref), ForceDeleteWithoutRecovery: true }),
    );
  }
}
