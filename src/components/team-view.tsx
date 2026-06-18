"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { teamStats, teamItemScores } from "@/data/seed";
import { RUBRICS, type CallType } from "@/domain/rubric";
import type { TeamCoachingAction } from "@/domain/team";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Glyph } from "@/components/ui/glyph";
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
        <h1 className="text-2xl font-semibold text-[var(--bone)]">Team</h1>
        <p className="text-sm text-[var(--bone-dim)]">
          How is the team doing on this call type against its rubric - and who to coach next.
        </p>
      </header>

      <div className="flex gap-2 lg:max-w-md">
        {(["discovery", "demo"] as CallType[]).map((ct) => (
          <button
            key={ct}
            onClick={() => setCallType(ct)}
            className={cn(
              "flex-1 rounded-[var(--radius)] border py-2 text-sm capitalize transition-colors",
              ct === callType
                ? "border-[var(--signal)] bg-[var(--panel-2)] text-[var(--bone)]"
                : "border-[var(--grid)] text-[var(--bone-dim)] hover:text-[var(--bone)]",
            )}
          >
            {ct}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
      {/* HERO: the agentic coaching action (who needs what + assign a drill) */}
      <Card accent="attention">
        <CardContent className="flex flex-col gap-3 pt-4">
          <div className="flex items-center gap-2 text-[var(--attention)]">
            <Glyph tone="attention">◍</Glyph>
            <span className="text-xs font-semibold uppercase tracking-wide">Coaching action</span>
          </div>

          {loadingAction || !action ? (
            <div className="flex items-center gap-2 text-sm text-[var(--bone-dim)]">
              <Glyph className="animate-spin">⟳</Glyph> Reading the team’s scorecard…
            </div>
          ) : (
            <>
              <p className="text-sm font-medium leading-relaxed text-[var(--bone)]">{action.headline}</p>
              <div className="flex flex-col gap-2">
                {action.recommendations.map((rec) => (
                  <div
                    key={rec.repId}
                    className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--grid)] bg-[var(--void)] p-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--bone)]">{rec.repName}</p>
                      <p className="text-xs leading-relaxed text-[var(--bone-dim)]">{rec.why}</p>
                    </div>
                    {rec.drillCallId ? (
                      <Link href={`/call/${rec.drillCallId}/drill?skillId=${rec.itemId}`}>
                        <Button size="sm" className="shrink-0">
                          <Glyph>⌖</Glyph> Assign drill
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
                      <Glyph tone="muted">↓</Glyph>
                    ) : (
                      <Glyph tone="muted">→</Glyph>
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-[var(--bone)]">{s.name}</p>
                      <p className="font-[var(--font-mono)] text-xs text-[var(--bone-dim)]">weight {s.weight}</p>
                    </div>
                    <Badge variant={s.avg >= 4 ? "strong" : s.avg >= 3 ? "needs_work" : "redo"}>{s.avg}/5</Badge>
                  </button>

                  {open && (
                    <div className="flex flex-col gap-1.5 px-3 pb-3 pl-10">
                      {people.map((p) => (
                        <div key={p.repId} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs text-[var(--bone-dim)]">{p.repName.split(" ")[0]}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-[var(--radius)] bg-[var(--grid)]">
                            <div
                              className={cn(
                                "h-full rounded-[var(--radius)]",
                                p.score >= 4 ? "bg-[var(--positive)]" : "bg-[var(--attention)]",
                              )}
                              style={{ width: `${(p.score / 5) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right font-[var(--font-mono)] text-xs tabular-nums text-[var(--bone-dim)]">{p.score}/5</span>
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
