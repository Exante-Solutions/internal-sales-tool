import { Suspense } from "react";
import { authMode, buildSession } from "@/infrastructure/composition";
import { avatarDataUri, initialsFromEmail } from "@/lib/avatar";
import { AppNav, AppNavView, type NavUser } from "@/components/app-nav";

/**
 * True only for the "no Auth0 session" signal thrown by Auth0SessionGateway
 * before it touches any collaborator. Lets us tell a genuinely signed-out
 * request apart from a real failure (DB error while provisioning, etc.), which
 * must surface rather than masquerade as a sign-in prompt.
 */
function isMissingSessionError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("no Auth0 session");
}

/**
 * Server wrapper that resolves the current Session and hands the nav its
 * identity (SPEC §18.3). Rendered in the root layout so every screen shares the
 * same chrome.
 *
 * Signed-out handling is CENTRALIZED here (3425177912): in live Auth0 mode a
 * missing session means the whole workspace is locked, so the shell renders the
 * sign-in prompt and suppresses the Discovery nav for EVERY screen — not just
 * Home/Settings. In seeded mode the session always resolves, so the app renders
 * normally. Any non-missing-session error (e.g. a DB failure while provisioning)
 * is re-thrown rather than masked as signed-out.
 */
export async function AppNavShell() {
  let workspaceName = "Discovery Workspace";
  let user: NavUser | null = null;

  try {
    const session = await buildSession().current();
    workspaceName = session.workspaceName || workspaceName;
    const email = session.email ?? "";
    if (email) {
      user = {
        email,
        displayName: session.displayName || email,
        avatarUri: avatarDataUri(email),
        initials: initialsFromEmail(email),
      };
    } else {
      // Authenticated seeded/demo session with no email on file: still show the
      // user menu (Settings/Logout) keyed off the display name so the chrome is
      // complete and the regions resolve.
      const displayName = session.displayName || "Workspace user";
      user = {
        email: displayName,
        displayName,
        avatarUri: avatarDataUri(displayName),
        initials: initialsFromEmail(displayName),
      };
    }
  } catch (err) {
    // In live Auth0 mode a missing session means the workspace is locked: render
    // NO Discovery nav so signed-out users never see the full chrome (the page
    // body renders its own sign-in prompt). Re-throw anything that is not a
    // genuine missing session so real failures aren't masked. In seeded mode the
    // session always resolves, so a throw here is always a real error → re-throw.
    if (authMode() === "auth0" && isMissingSessionError(err)) {
      return null;
    }
    throw err;
  }

  // AppNav reads useSearchParams() for query-aware active state (B11); a Suspense
  // boundary keeps that client hook from opting every page out of static
  // rendering. The fallback renders the hook-free <AppNavView> (empty search) so
  // even fully-static pages (/_not-found) prerender without a CSR bailout.
  return (
    <Suspense fallback={<AppNavView workspaceName={workspaceName} user={user} pathname="" search="" />}>
      <AppNav workspaceName={workspaceName} user={user} />
    </Suspense>
  );
}
