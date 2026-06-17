"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ChevronRight, ChevronDown, Loader2, Target } from "lucide-react";
import { teamStats, teamItemScores } from "@/data/seed";
import { RUBRICS, type CallType } from "@/domain/rubric";
import type { TeamCoachingAction } from "@/domain/team";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Team view (Feature 4) — organized by the rubric: call type → the rubric for
 * that call type → people. The agentic coaching action (who needs what + assign
 * a drill) is the hero, above the metrics, so it reads as coaching, not a
 * dashboard. Reflows wider on desktop.
 */
export function TeamView() {
  const [callType, setCallType] = useState<CallType>("discovery");
  const [action, setAction] = useState<TeamCoachingAction | null>(null);
  const [loadingAction, setLoadingAction] = useState(true);
  const [openItem, setOpenItem] = useState<number | null>(null);

  const stats = teamStats(callType);

  useEffect(() => {
    let alive = true;
    setLoadingAction(true);
    setAction(null);
    setOpenItem(null);
    fetch(`/api/team/coach?callType=${callType}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setAction(d?.action ?? null))
      .catch(() => {})
      .finally(() => alive && setLoadingAction(false));
    return () => {
      alive = false;
    };
  }, [callType]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-neutral-400">
          How is the team doing on this call type against its rubric — and who to coach next.
        </p>
      </header>

      <div className="flex gap-2 lg:max-w-md">
        {(["discovery", "demo"] as CallType[]).map((ct) => (
          <button
            key={ct}
            onClick={() => setCallType(ct)}
            className={cn(
              "flex-1 rounded-lg border py-2 text-sm capitalize",
              ct === callType ? "border-white bg-neutral-800 text-white" : "border-neutral-800 text-neutral-400",
            )}
          >
            {ct}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
      {/* HERO: the agentic coaching action (who needs what + assign a drill) */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
        <CardContent className="flex flex-col gap-3 pt-4">
          <div className="flex items-center gap-2 text-amber-300">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Coaching action</span>
          </div>

          {loadingAction || !action ? (
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the team’s scorecard…
            </div>
          ) : (
            <>
              <p className="text-sm font-medium leading-relaxed text-neutral-100">{action.headline}</p>
              <div className="flex flex-col gap-2">
                {action.recommendations.map((rec) => (
                  <div
                    key={rec.repId}
                    className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-100">{rec.repName}</p>
                      <p className="text-xs leading-relaxed text-neutral-400">{rec.why}</p>
                    </div>
                    {rec.drillCallId ? (
                      <Link href={`/call/${rec.drillCallId}/drill?skillId=${rec.itemId}`}>
                        <Button size="sm" className="shrink-0">
                          <Target className="h-3.5 w-3.5" /> Assign drill
                        </Button>
                      </Link>
                    ) : (
                      <Badge variant="neutral">no call yet</Badge>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* The rubric breakdown — tap an item to see how each person is doing */}
      <div>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {callType} rubric · {stats.length} items · weighted /100
        </h2>
        <Card>
          <ul className="divide-y divide-neutral-800">
            {stats.map((s) => {
              const open = openItem === s.itemId;
              const people = open ? [...teamItemScores(callType, s.itemId)].sort((a, b) => a.score - b.score) : [];
              return (
                <li key={s.itemId}>
                  <button
                    onClick={() => setOpenItem(open ? null : s.itemId)}
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-neutral-800/40"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-neutral-100">{s.name}</p>
                      <p className="text-xs text-neutral-500">weight {s.weight}</p>
                    </div>
                    <Badge variant={s.avg >= 4 ? "strong" : s.avg >= 3 ? "needs_work" : "redo"}>{s.avg}/5</Badge>
                  </button>

                  {open && (
                    <div className="flex flex-col gap-1.5 px-3 pb-3 pl-10">
                      {people.map((p) => (
                        <div key={p.repId} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs text-neutral-300">{p.repName.split(" ")[0]}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                p.score >= 4 ? "bg-emerald-400" : p.score === 3 ? "bg-amber-400" : "bg-rose-400",
                              )}
                              style={{ width: `${(p.score / 5) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-neutral-400">{p.score}/5</span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      </div>
    </div>
  );
}
