"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, LineChart, Users, BookOpen, ChevronRight, Zap } from "lucide-react";
import type { Session } from "@/domain/session";
import type { StoredCallMeta } from "@/domain/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RepHome } from "@/components/rep-home";

/**
 * Home menu (Feature 3) — the landing hub the user sees on arrival/login. Pick
 * where to go instead of being dropped into one screen. Identity comes from the
 * Session (seeded team until Auth0 is wired). Below the menu: your uploaded
 * calls, then the seeded-team explorer (RepHome).
 */
const destinations = [
  { href: "/calls/new", label: "Score a call", desc: "Upload or paste a transcript", icon: Upload, accent: "text-sky-300 bg-sky-500/15" },
  { href: "/progress", label: "Progress", desc: "Watch each skill climb", icon: LineChart, accent: "text-emerald-300 bg-emerald-500/15" },
  { href: "/team", label: "Team", desc: "Coach the team-wide gap", icon: Users, accent: "text-violet-300 bg-violet-500/15" },
  { href: "/playbook", label: "Playbook", desc: "Edit rubric & persona", icon: BookOpen, accent: "text-amber-300 bg-amber-500/15" },
];

export function HomeMenu({ session }: { session: Session }) {
  const [uploaded, setUploaded] = useState<StoredCallMeta[]>([]);

  useEffect(() => {
    fetch("/api/calls")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.calls && setUploaded(d.calls))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400" />
          <h1 className="text-2xl font-bold">CoachLoop</h1>
        </div>
        <p className="text-sm text-neutral-400">
          Welcome, {session.displayName}.{" "}
          {!session.isAuthenticated && <Badge variant="neutral">seeded team</Badge>}
        </p>
      </header>

      {/* Where to? */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {destinations.map(({ href, label, desc, icon: Icon, accent }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:border-neutral-700">
              <CardContent className="flex items-center gap-3 pt-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-100">{label}</p>
                  <p className="text-xs text-neutral-500">{desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-neutral-600" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Your uploaded calls */}
      {uploaded.length > 0 && (
        <div>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Your uploaded calls</h2>
          <div className="flex flex-col gap-2">
            {uploaded.map((c) => (
              <Link key={c.id} href={`/call/${c.id}`}>
                <Card className="transition-colors hover:border-neutral-700">
                  <CardContent className="flex items-center gap-3 pt-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-100">{c.prospect}</span>
                        <Badge variant="neutral" className="capitalize">{c.callType}</Badge>
                      </div>
                      <p className="text-xs text-neutral-500">{c.contact} · {c.date}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-neutral-600" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Seeded team explorer */}
      <div className="border-t border-neutral-900 pt-5">
        <RepHome />
      </div>
    </div>
  );
}
