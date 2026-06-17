import { Target } from "lucide-react";

/**
 * Signed-out landing (SPEC §6.6; RUBRIC J). Shown only in live Auth0 mode when
 * there is no session yet. A single affordance links to the SDK login route
 * (/auth/login). In seeded mode this never renders — the seeded session is
 * always present, so the demo needs no login.
 *
 * Plain <a> (not next/link) so the browser performs a full navigation to the
 * Auth0 middleware route rather than a client-side transition.
 */
export function SignedOut() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-800">
        <Target className="size-6 text-neutral-100" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Discovery Workspace</h1>
        <p className="max-w-xs text-sm text-neutral-400">
          Sign in to score discovery calls, drill the gaps, and re-score.
        </p>
      </div>
      <a
        href="/auth/login"
        className="inline-flex h-10 items-center justify-center rounded-md bg-neutral-100 px-6 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
      >
        Sign in
      </a>
    </div>
  );
}
