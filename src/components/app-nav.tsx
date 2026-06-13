"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Upload, LineChart, Users, BookOpen, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Responsive primary nav (Feature 0). One component, two layouts:
 * a thumb-friendly bottom bar on mobile (lg:hidden) and a persistent left
 * sidebar on desktop (hidden lg:flex). Mobile experience is unchanged.
 */
const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calls/new", label: "Calls", icon: Upload },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/team", label: "Team", icon: Users },
  { href: "/playbook", label: "Playbook", icon: BookOpen },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile: bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
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
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <Zap className="h-5 w-5 text-amber-400" />
          <span className="text-lg font-bold">CoachLoop</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
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
      </aside>
    </>
  );
}
