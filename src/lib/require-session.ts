/**
 * requireSession — the single server-side gate for authenticated page routes.
 *
 * Resolves the current Session (Auth0SessionGateway provisions the team + app_user
 * on first login, see auth0-session.ts). When there is genuinely NO Auth0 session
 * it performs a hard server redirect to the SDK login route (/auth/login) instead
 * of rendering a signed-out interstitial — "no team or user → go to login". Any
 * OTHER failure (e.g. a DB error mid-provision) is re-thrown so a real outage
 * surfaces as an error rather than masquerading as "logged out".
 *
 * In seeded mode current() always resolves, so this never redirects — the demo
 * needs no login. Server-only: it reads the session and calls next/navigation's
 * redirect(), so never import it from a "use client" component.
 */

import { redirect } from "next/navigation";
import type { Session } from "@/domain/session";
import { buildSession } from "@/infrastructure/composition";

/**
 * True only for the "no Auth0 session" signal Auth0SessionGateway throws before
 * touching any collaborator — a genuinely signed-out request, as opposed to a
 * provisioning/DB failure that must surface rather than send the user to login.
 */
function isMissingSessionError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("no Auth0 session");
}

export async function requireSession(): Promise<Session> {
  try {
    return await buildSession().current();
  } catch (err) {
    // redirect() throws NEXT_REDIRECT (its return type is `never`), so control
    // never falls through to the re-throw on the signed-out path.
    if (isMissingSessionError(err)) redirect("/auth/login");
    throw err;
  }
}
