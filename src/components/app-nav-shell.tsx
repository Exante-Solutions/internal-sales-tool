import { Suspense } from "react";
import { buildSession } from "@/infrastructure/composition";
import { avatarDataUri, initialsFromEmail } from "@/lib/avatar";
import { AppNav, AppNavView, type NavUser } from "@/components/app-nav";

/**
 * Server wrapper that resolves the current Session and hands the nav its
 * identity (SPEC §18.3). Rendered in the root layout so every screen shares the
 * same chrome. When there is no session (live Auth0, pre-login) `current()`
 * throws — we still render the nav, just without the identity footer, so the
 * signed-out landing keeps its shell.
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
  } catch {
    // No session — leave user null; the nav renders without the identity footer.
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
