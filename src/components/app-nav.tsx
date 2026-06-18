"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Glyph } from "@/components/ui/glyph";
import { navActive } from "../../lib/nav/active.mjs";

/**
 * Responsive primary nav, shadcn-sidebar-style (SPEC §18.3, RUBRIC M5/Q-suite).
 * One component, two layouts: a thumb-friendly bottom bar on mobile (lg:hidden)
 * and a persistent left sidebar on desktop (hidden lg:flex). The sidebar footer
 * carries workspace identity — workspace name, the user's email + a lightweight
 * generated avatar — and a user menu (Settings, Logout). The Discovery nouns are
 * primary; the coaching add-on (Team / drill) stays reachable via the sidebar.
 *
 * Identity is resolved server-side and passed in by <AppNavShell>. When no user
 * is signed in (live Auth0, pre-login) `user` is null and the identity footer is
 * omitted — the nav still renders so the signed-out landing keeps its chrome.
 */

export interface NavUser {
  email: string;
  displayName: string;
  avatarUri: string;
  initials: string;
}

const tabs = [
  { href: "/", label: "Home", glyph: "◧" },
  { href: "/initiatives", label: "Initiatives", glyph: "◎" },
  { href: "/conversations", label: "Calls", glyph: "❝" },
  { href: "/people", label: "People", glyph: "◔" },
];

/** Secondary destinations — desktop sidebar only (keeps the mobile bar to 4). */
const secondary = [
  { href: "/conversations?inbox=1", label: "Unassigned inbox", glyph: "⌅" },
  { href: "/team", label: "Team coaching", glyph: "▰" },
];

export function AppNav({
  workspaceName,
  user,
}: {
  workspaceName: string;
  user: NavUser | null;
}) {
  const pathname = usePathname();
  // Query string drives the query-aware active split between the Calls tab
  // (`/conversations`) and the Unassigned inbox (`/conversations?inbox=1`).
  const search = useSearchParams().toString();
  return <AppNavView workspaceName={workspaceName} user={user} pathname={pathname} search={search} />;
}

/**
 * Presentational nav — pure props, no router hooks (BUG_FIX B11). Splitting the
 * `useSearchParams()` read into the thin <AppNav> wrapper lets the Suspense
 * fallback render this directly (with an empty `search`), so the client-search
 * bailout can't break static prerendering of `/_not-found` et al.
 */
export function AppNavView({
  workspaceName,
  user,
  pathname,
  search,
}: {
  workspaceName: string;
  user: NavUser | null;
  pathname: string;
  search: string;
}) {
  return (
    <>
      {/* Mobile: bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--grid)] bg-[var(--panel)] lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {tabs.map(({ href, label, glyph }) => {
            const active = navActive(pathname, search, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 border-t-2 border-transparent font-[var(--font-mono)] text-[10px] uppercase tracking-[0.06em] transition-colors",
                  active
                    ? "border-[var(--signal)] bg-[var(--panel-2)] text-[var(--bone)]"
                    : "text-[var(--bone-dim)] hover:text-[var(--bone)]",
                )}
              >
                <Glyph tone={active ? "signal" : "muted"} className="text-base">
                  {glyph}
                </Glyph>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-[var(--grid)] bg-[var(--panel)] px-3 py-5 lg:flex">
        <Link href="/" className="mb-1 flex items-center gap-2 px-2">
          <Glyph tone="signal" className="text-base">
            ◎
          </Glyph>
          <span className="font-[var(--font-display)] text-[17px] font-semibold lowercase tracking-[var(--track-title)] text-[var(--bone)]">
            coachloop
          </span>
        </Link>
        {/* Workspace name (region) — sourced from Session.workspaceName (§18.2). */}
        <p
          data-region="workspace-name"
          className="mb-6 truncate px-2 font-[var(--font-mono)] text-[10px] text-[var(--bone-dim)]"
          title={workspaceName}
        >
          {workspaceName}
        </p>

        <nav className="flex flex-col gap-1">
          {tabs.map(({ href, label, glyph }) => {
            const active = navActive(pathname, search, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border-[var(--signal)] bg-[var(--panel-2)] text-[var(--bone)]"
                    : "text-[var(--bone-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--bone)]",
                )}
              >
                <Glyph tone={active ? "signal" : "muted"} className="w-4">
                  {glyph}
                </Glyph>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 border-t border-[var(--grid)] pt-4">
          <nav className="flex flex-col gap-1">
            {secondary.map(({ href, label, glyph }) => {
              const active = navActive(pathname, search, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "border-[var(--attention)] bg-[var(--panel-2)] text-[var(--bone)]"
                      : "text-[var(--bone-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--bone)]",
                  )}
                >
                  <Glyph tone={active ? "attention" : "muted"} className="w-4">
                    {glyph}
                  </Glyph>
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User identity + menu (§18.3) — pinned to the sidebar footer. */}
        {user && <UserMenu user={user} />}
      </aside>
    </>
  );
}

/**
 * The sidebar footer user menu (region `user-menu`). Shows the avatar (region
 * `user-avatar`) and email (region `user-email`), and toggles a popover with
 * Settings (→ /settings) and Logout (→ /auth/logout). Logout is a plain <a> so
 * the browser performs a full navigation to the Auth0 SDK route.
 */
function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} data-region="user-menu" className="relative mt-auto pt-4">
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-[var(--radius)] border border-[var(--grid)] bg-[var(--panel)]">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--bone-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--bone)]"
          >
            <Glyph>⚙</Glyph>
            Settings
          </Link>
          <a
            href="/auth/logout"
            className="flex items-center gap-2.5 border-t border-[var(--grid)] px-3 py-2.5 text-sm text-[var(--bone-dim)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--bone)]"
          >
            <Glyph>↺</Glyph>
            Logout
          </a>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-[var(--radius)] border border-[var(--grid)] bg-[var(--panel-2)] px-2.5 py-2 text-left transition-colors hover:border-[var(--signal-deep)] hover:bg-[var(--panel)]"
      >
        <Avatar
          data-region="user-avatar"
          initials={user.initials}
          accent="signal"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--bone)]">
            {user.displayName}
          </span>
          <span
            data-region="user-email"
            className="block truncate font-[var(--font-mono)] text-[10px] text-[var(--bone-dim)]"
          >
            {user.email}
          </span>
        </span>
        <Glyph tone="muted">↕</Glyph>
      </button>
    </div>
  );
}
