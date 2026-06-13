"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Target, Zap } from "lucide-react";
import { REPS, callsForRep, EVALUATIONS } from "@/data/seed";
import { leverage } from "@scoring";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { bandLabel } from "@/components/score-ring";
import { cn } from "@/lib/utils";

export function RepHome() {
  const [repId, setRepId] = useState(REPS[0].id);
  const calls = callsForRep(repId);
  const rep = REPS.find((r) => r.id === repId)!;

  // Highest-leverage gap across this rep's scored calls → the headline drill.
  const drillTarget = calls
    .map((c) => {
      const ev = EVALUATIONS[c.id];
      if (!ev) return null;
      const w = ev.items.find((i) => i.rubric_item_id === ev.weakest_item_id)!;
      return { call: c, ev, lev: leverage(w), skill: w.name };
    })
    .filter(Boolean)
    .sort((a, b) => b!.lev - a!.lev)[0];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400" />
          <h1 className="text-2xl font-bold">CoachLoop</h1>
        </div>
        <p className="text-sm text-neutral-400">Score → drill the gap → re-score.</p>
      </header>

      {/* Rep switcher (no login — seeded team) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {REPS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRepId(r.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
              r.id === repId
                ? "border-white bg-white text-black"
                : "border-neutral-700 text-neutral-300",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                r.id === repId ? "bg-black text-white" : "bg-neutral-800 text-neutral-300",
              )}
            >
              {r.initials}
            </span>
            {r.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Headline drill CTA */}
      {drillTarget && (
        <Link href={`/call/${drillTarget.call.id}/drill`}>
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <Target className="h-5 w-5 text-amber-300" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Drill your weakest skill</p>
                <p className="text-sm font-medium text-neutral-100">{drillTarget.skill}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-neutral-500" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Recent calls */}
      <div>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {rep.name.split(" ")[0]}’s recent calls
        </h2>
        {calls.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-neutral-400">
              No scored calls yet for {rep.name}. Try Alex Chen to see the full loop.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {calls.map((c) => {
              const ev = EVALUATIONS[c.id];
              return (
                <Link key={c.id} href={`/call/${c.id}`}>
                  <Card className="transition-colors hover:border-neutral-700">
                    <CardContent className="flex items-center gap-3 pt-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-100">{c.prospect}</span>
                          <Badge variant="neutral" className="capitalize">{c.callType}</Badge>
                        </div>
                        <p className="text-xs text-neutral-500">
                          {c.contact} · {c.contactRole} · {c.date}
                        </p>
                      </div>
                      {ev && (
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-bold tabular-nums">{ev.score_100}</span>
                          <Badge variant={ev.band}>{bandLabel[ev.band]}</Badge>
                        </div>
                      )}
                      <ChevronRight className="h-5 w-5 text-neutral-600" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
