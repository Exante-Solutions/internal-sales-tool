/**
 * Settings (SPEC §18.1, route /settings) — the per-user integrations & permissions
 * home. Server component: resolves the current session, provisions/reads the
 * workspace user, and computes connected state for each integration, then renders
 * the rows. Regions:
 *   - settings-email      → Gmail per-user OAuth (§6.4), connected/disconnected.
 *   - settings-calendar   → Google Calendar scope state (same consent, §6.4).
 *   - settings-circleback → the user's OWN Circleback secret (PUT/DELETE, §6.8).
 *
 * Connected state comes from google_connection (scopes) + IntegrationConfigStore;
 * the stored Circleback secret is never read back, only its presence. All state
 * is computed here and the only interactive piece (the Circleback form) is a
 * client island. Each async section carries a data-empty-state for its
 * disconnected case (RUBRIC §S / §18.4).
 */

import Link from "next/link";
import { Mail, CalendarDays, Mic, Building2, ExternalLink, Check } from "lucide-react";
import { getServices, buildSession } from "@/infrastructure/composition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignedOut } from "@/components/signed-out";
import { SettingsCircleback } from "@/components/settings-circleback";
import { SettingsWorkspace } from "@/components/settings-workspace";
import { connectionState } from "../../../lib/settings/connection-state.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Live Auth0 mode throws when there's no session — show the signed-out CTA.
  let session;
  try {
    session = await buildSession().current();
  } catch {
    return <SignedOut />;
  }

  const svc = getServices();

  // The session user is already provisioned by Auth0SessionGateway.current(), and
  // session.userId IS the provisioned app_user.id (`usr-auth0|…`). Re-provisioning
  // here re-prefixed the id (`usr-usr-auth0|…`, BUG_FIX B8), creating a new user
  // whose google_connection was empty → always "Not connected". Read the per-user
  // Google connection (keyed by app_user.id) directly off session.userId.
  const connection = await svc.connections.getByUser(session.userId);
  const scopes = connection?.scopes ?? [];
  // Tolerant scope matching (BUG_FIX B1): Google returns full-URL scopes plus
  // openid/email/profile; match by gmail.readonly / calendar.readonly suffix.
  const { gmailConnected, calendarConnected } = connectionState(scopes);

  // Circleback connected = a stored user_integration row exists. The secret
  // itself is never read here, only the presence of the config (scopeKey = userId).
  const circleback = await svc.integrations.get(session.userId, "circleback");
  const circlebackConnected = circleback !== null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-neutral-400">
          Per-user integrations &amp; permissions for {session.email ?? session.displayName}.
        </p>
      </header>

      {/* ── Workspace name (app-managed) ─────────────────────────────────── */}
      <section data-region="settings-workspace" className="flex flex-col gap-3">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">Workspace</h2>
                <p className="text-sm text-neutral-400">
                  The workspace name shown in the nav. It is managed here, not by your
                  identity provider — rename it any time.
                </p>
              </div>
            </div>

            <SettingsWorkspace name={session.workspaceName} />
          </CardContent>
        </Card>
      </section>

      {/* ── Email access (Gmail) ─────────────────────────────────────────── */}
      <section data-region="settings-email" className="flex flex-col gap-3">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-sky-400" />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">Email access</h2>
                <p className="text-sm text-neutral-400">
                  Connect Gmail (read-only) so a contact&apos;s threads sync on demand across your team&apos;s mailboxes.
                </p>
              </div>
              {gmailConnected ? (
                <Badge variant="neutral" className="gap-1 text-emerald-400">
                  <Check className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="neutral">Not connected</Badge>
              )}
            </div>

            {gmailConnected ? (
              <>
                <p className="text-sm text-neutral-400">
                  Connected as <span className="text-neutral-200">{connection?.email}</span>.
                </p>
                <div className="flex items-center gap-2">
                  <Link href="/api/connections/google/disconnect">
                    <Button size="sm" variant="secondary">Disconnect</Button>
                  </Link>
                  <Link href="/api/connections/google/start">
                    <Button size="sm" variant="ghost">Reconnect Google</Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p data-empty-state className="text-sm text-neutral-400">
                  Email is not connected yet. Gmail read access lets the workspace pull a
                  person&apos;s message history when you open their profile. Connect to enable it.
                </p>
                <div>
                  <Link href="/api/connections/google/start">
                    <Button size="sm" variant="primary">Connect Gmail</Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Calendar access (Google Calendar) ────────────────────────────── */}
      <section data-region="settings-calendar" className="flex flex-col gap-3">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 text-amber-400" />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">Calendar access</h2>
                <p className="text-sm text-neutral-400">
                  Connect Google Calendar (read-only) so booked meetings map onto your initiatives.
                </p>
              </div>
              {calendarConnected ? (
                <Badge variant="neutral" className="gap-1 text-emerald-400">
                  <Check className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="neutral">Not connected</Badge>
              )}
            </div>

            {calendarConnected ? (
              <>
                <p className="text-sm text-neutral-400">
                  Calendar scope granted on <span className="text-neutral-200">{connection?.email}</span>.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/api/connections/google/disconnect">
                    <Button size="sm" variant="secondary">Disconnect</Button>
                  </Link>
                  <Link href="/api/connections/google/start">
                    <Button size="sm" variant="ghost">Reconnect Google</Button>
                  </Link>
                  <span className="text-xs text-neutral-500">
                    Email and calendar share one Google consent.
                  </span>
                </div>
              </>
            ) : (
              <>
                <p data-empty-state className="text-sm text-neutral-400">
                  Calendar is not connected yet. Granting calendar read access lets booked
                  meetings attach to the right initiative automatically. Connect to enable it.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/api/connections/google/start">
                    <Button size="sm" variant="primary">Connect Calendar</Button>
                  </Link>
                  <span className="text-xs text-neutral-500">
                    Email and calendar share one Google consent.
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Circleback (per-user secret) ─────────────────────────────────── */}
      <section data-region="settings-circleback" className="flex flex-col gap-3">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="flex items-start gap-3">
              <Mic className="mt-0.5 h-5 w-5 text-violet-400" />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">Circleback</h2>
                <p className="text-sm text-neutral-400">
                  Use your own Circleback secret so recordings ingest under your account. The
                  secret is stored encrypted and never shown again — there is no shared key.
                </p>
              </div>
              <a
                href="https://circleback.ai"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-neutral-500 hover:text-neutral-300"
              >
                <span className="inline-flex items-center gap-1">
                  Docs <ExternalLink className="h-3 w-3" />
                </span>
              </a>
            </div>

            {!circlebackConnected && (
              <p data-empty-state className="text-sm text-neutral-400">
                No Circleback secret on file. Add yours to let your own recordings flow into
                the workspace. Enter the secret below to connect.
              </p>
            )}

            <SettingsCircleback connected={circlebackConnected} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
