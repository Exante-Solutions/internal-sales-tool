/**
 * Edge middleware — mounts the Auth0 v4 auth routes (SPEC §6.6, §9; RUBRIC J/K/L).
 *
 * @auth0/nextjs-auth0 v4 has NO route handler files: the SDK's /auth/login,
 * /auth/callback, /auth/logout, and /auth/profile endpoints are served by
 * auth0.middleware(req). We delegate to it so login works end-to-end.
 *
 * Offline/seeded fallback (CLAUDE.md "fakes keep the loop alive"): when AUTH0_*
 * is unset, authMode() === "seeded" and we DO NOT touch the Auth0 client at all
 * (constructing it against missing config would throw). The app then runs on the
 * SeededSessionGateway and L1/L2 stay green. A missing tenant never breaks the app.
 *
 * Public/unauthenticated routes (webhooks, health) are NOT gated here — the SDK
 * middleware only owns the /auth/* prefix and otherwise passes the request
 * through; per-route authorization stays the route's job (it calls the Session
 * port). So webhook + health endpoints remain reachable without a login.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authMode } from "@auth-session";
import { auth0 } from "@/lib/auth0";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // Seeded mode: no Auth0 tenant configured. Pass every request through
  // untouched so the seeded session powers the app with no login.
  if (authMode(process.env) !== "auth0") {
    return NextResponse.next();
  }
  // Live mode: hand /auth/* (and session refresh) to the Auth0 SDK; it returns
  // NextResponse.next() for non-auth paths, so other routes pass through.
  return auth0.middleware(req);
}

export const config = {
  // Run on everything EXCEPT Next internals and static assets. The /auth/*
  // routes must be matched here for login to work; webhooks/health pass through.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
