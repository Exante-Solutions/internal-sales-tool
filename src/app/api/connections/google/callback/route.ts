/**
 * GET /api/connections/google/callback (SPEC §6.4, §6.7, §9). The Google OAuth
 * redirect target — its path MUST equal GOOGLE_OAUTH_REDIRECT_URL
 * (http://localhost:3000/api/connections/google/callback). Exchanges the code
 * for a token bundle, names the connected account (sub + email from the id_token),
 * stores the token bundle via SecretStore.put(`google/${appUserId}`) (the
 * AWS_KMS_KEY_ID-encrypted path), and upserts the google_connection row through
 * the GoogleConnectionRepository — Postgres holds only the secret_ref, never a
 * token. Then redirects back to the workspace.
 *
 * The googleapis OAuth2 vendor objects (Credentials, TokenPayload) die here;
 * only the domain GoogleConnection + a plain token-bundle JSON string cross out.
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServices, buildSession } from "@/infrastructure/composition";
import { googleSecretRef, type GoogleConnection } from "@/domain/connection";
import { DEFAULT_TEAM_ID } from "@/domain/tenancy";

export const runtime = "nodejs";

/** Where the user lands after connecting — back in Settings (BUG_FIX B4). */
function backTo(req: NextRequest, status: string): URL {
  const base = process.env.APP_BASE_URL ?? req.nextUrl.origin;
  const url = new URL("/settings", base);
  url.searchParams.set("google", status);
  return url;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUrl = process.env.GOOGLE_OAUTH_REDIRECT_URL;
  if (!clientId || !clientSecret || !redirectUrl) {
    return NextResponse.json(
      { error: "Google connection is not configured" },
      { status: 503 },
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) return NextResponse.redirect(backTo(req, "denied"));
  if (!code || !state) return NextResponse.redirect(backTo(req, "error"));

  const svc = getServices();

  // OAuth-linking CSRF defense (C4.1): require the browser finishing consent to
  // be the SAME workspace user named in `state`. Without this an attacker can
  // start the flow with their own `state`, have a victim complete Google consent,
  // and attach the victim's mailbox tokens to the attacker's user. The session is
  // the source of truth (not trusted from `state`); a missing session is rejected,
  // and a `state` that doesn't match the live session.userId is a forged/replayed
  // link. /start sets state = session.userId, so the legitimate user always matches.
  let session;
  try {
    session = await buildSession().current();
  } catch {
    return NextResponse.redirect(backTo(req, "error"));
  }
  if (state !== session.userId) return NextResponse.redirect(backTo(req, "error"));

  // Resolve the workspace identity for the SESSION user. In Auth0 mode the row
  // was already provisioned by buildSession().current(), so this returns it. In
  // seeded mode the demo user ("seeded-team-user") is never persisted, so there's
  // no row — we fall back to the SESSION as the source of truth (its userId/teamId
  // ARE the workspace identity) so seeded connect succeeds instead of redirecting
  // google=error. The connection id/appUserId stays the exact session.userId — no
  // id re-derivation — matching what /start minted into `state`.
  const appUser = await svc.appUsers.get(session.userId);
  const appUserId = appUser?.id ?? session.userId;
  const teamId = appUser?.teamId || session.teamId || DEFAULT_TEAM_ID;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);

  let googleSub: string;
  let email: string;
  let scopes: string[];
  let expiresAt: string | null;
  let tokenBundleJson: string;
  try {
    const { tokens } = await oauth2.getToken(code);

    // Name the connected account from the id_token (we asked for openid+email);
    // fall back to the userinfo endpoint if the id_token is absent.
    let sub: string | undefined;
    let acctEmail: string | undefined;
    if (tokens.id_token) {
      const ticket = await oauth2.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
      const payload = ticket.getPayload();
      sub = payload?.sub;
      acctEmail = payload?.email ?? undefined;
    }
    if (!sub || !acctEmail) {
      oauth2.setCredentials(tokens);
      const info = await google.oauth2({ version: "v2", auth: oauth2 }).userinfo.get();
      sub = sub ?? info.data.id ?? undefined;
      acctEmail = acctEmail ?? info.data.email ?? undefined;
    }
    if (!sub || !acctEmail) return NextResponse.redirect(backTo(req, "error"));

    googleSub = sub;
    email = acctEmail;
    scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
    expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
    // The full bundle (incl. refresh_token) is the only thing that touches the
    // SecretStore; it never enters Postgres. Shape matches GoogleGmailAdapter.
    tokenBundleJson = JSON.stringify({
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      scope: tokens.scope ?? undefined,
      token_type: tokens.token_type ?? undefined,
    });
  } catch {
    return NextResponse.redirect(backTo(req, "error"));
  }

  // Store the token bundle (AWS_KMS_KEY_ID-encrypted when configured); persist
  // only the returned ref. Path: <workspaceId>/<appUserId>/google under the
  // adapter's /internal_tools/<APP_NAME>/ root.
  const ref = googleSecretRef(teamId, appUserId);
  const secretRef = await svc.secrets.put(ref, tokenBundleJson);

  const conn: GoogleConnection = {
    id: appUserId, // one connection per workspace user
    appUserId,
    teamId,
    googleSub,
    email,
    scopes,
    secretRef,
    expiresAt,
  };
  await svc.connections.upsert(conn);

  return NextResponse.redirect(backTo(req, "connected"));
}
