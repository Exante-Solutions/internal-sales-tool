/**
 * GET /api/connections/google/start (SPEC §6.4, §9). Begin the per-user Google
 * data-connection OAuth (a data integration, NOT sign-in): build the Google
 * consent URL with Gmail-read + calendar-read + openid/email scopes and redirect
 * the browser there. `access_type=offline` + `prompt=consent` force a refresh
 * token so server-side token refresh (and on-demand email sync) keep working.
 *
 * The current workspace user is provisioned from the Session (Auth0 sub, or the
 * seeded user offline) into app_user, and its stable id is carried in the OAuth
 * `state` so the callback knows whose connection + secret (`google/${appUserId}`)
 * to write. The googleapis OAuth2 vendor object is built and consumed here only.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";

/** Gmail read + calendar read + the identity scopes that name the account. */
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
];

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUrl = process.env.GOOGLE_OAUTH_REDIRECT_URL;
  if (!clientId || !clientSecret || !redirectUrl) {
    return NextResponse.json(
      { error: "Google connection is not configured (GOOGLE_CLIENT_ID/SECRET/GOOGLE_OAUTH_REDIRECT_URL)" },
      { status: 503 },
    );
  }

  // Resolve the workspace user for the current session; its id is what we carry
  // in `state` and what scopes the per-user secret ref `google/${appUserId}`.
  // Connecting Google requires a logged-in user — if there's no session yet,
  // send them through login first and return here (instead of a raw 500).
  let session;
  try {
    session = await buildSession().current();
  } catch {
    const base = process.env.APP_BASE_URL ?? "";
    return NextResponse.redirect(
      `${base}/auth/login?returnTo=${encodeURIComponent("/api/connections/google/start")}`,
    );
  }
  // The session user is ALREADY provisioned by buildSession().current(); use its
  // id directly as `state`. (Re-provisioning here with session.userId as the
  // auth0Sub would double-prefix the id, e.g. usr-usr-auth0|….)
  const appUserId = session.userId;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
    state: appUserId,
  });

  return NextResponse.redirect(url);
}
