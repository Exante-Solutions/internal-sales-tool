"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  Target,
  MessagesSquare,
  Users,
  Inbox,
  Dumbbell,
  Settings,
  LogOut,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  { href: "/", label: "Home", icon: Home },
  { href: "/initiatives", label: "Initiatives", icon: Target },
  { href: "/conversations", label: "Calls", icon: MessagesSquare },
  { href: "/people", label: "People", icon: Users },
];

/** Secondary destinations — desktop sidebar only (keeps the mobile bar to 4). */
const secondary = [
  { href: "/conversations?inbox=1", label: "Unassigned inbox", icon: Inbox },
  { href: "/team", label: "Team coaching", icon: Dumbbell },
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
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = navActive(pathname, search, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs",
                  active ? "text-white" : "text-neutral-500",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop: left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-neutral-800 bg-neutral-950/80 px-3 py-6 backdrop-blur lg:flex">
        <Link href="/" className="mb-1 flex items-center gap-2 px-2">
          <Target className="h-5 w-5 text-amber-400" />
          <span className="text-lg font-bold">Discovery</span>
        </Link>
        {/* Workspace name (region) — sourced from Session.workspaceName (§18.2). */}
        <p
          data-region="workspace-name"
          className="mb-6 truncate px-2 text-xs font-medium text-neutral-400"
          title={workspaceName}
        >
          {workspaceName}
        </p>

        <nav className="flex flex-col gap-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = navActive(pathname, search, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 border-t border-neutral-800 pt-4">
          <nav className="flex flex-col gap-1">
            {secondary.map(({ href, label, icon: Icon }) => {
              const active = navActive(pathname, search, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200",
                  )}
                >
                  <Icon className="h-4 w-4" />
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
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-lg">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <a
            href="/auth/logout"
            className="flex items-center gap-2.5 border-t border-neutral-800 px-3 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </a>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-2 text-left transition-colors hover:bg-neutral-900"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-region="user-avatar"
          src={user.avatarUri}
          alt={`${user.displayName} avatar`}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-full"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-neutral-100">
            {user.displayName}
          </span>
          <span
            data-region="user-email"
            className="block truncate text-xs text-neutral-500"
          >
            {user.email}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-neutral-500" />
      </button>
    </div>
  );
}
