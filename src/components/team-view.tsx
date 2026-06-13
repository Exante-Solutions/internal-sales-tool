"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { teamStats } from "@/data/seed";
import type { CallType } from "@/domain/rubric";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TeamView() {
  const [callType, setCallType] = useState<CallType>("discovery");
  const stats = teamStats(callType);
  // Team-wide gap = lowest average weighted by importance (max (5-avg)×weight).
  const teamGap = [...stats].sort((a, b) => (5 - b.avg) * b.weight - (5 - a.avg) * a.weight)[0];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-neutral-400">Per-rubric averages by call type — the gap a manager would coach.</p>
      </header>

      <div className="flex gap-2">
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

      <Card className="border-rose-500/30 bg-rose-500/5">
        <CardContent className="flex items-center gap-3 pt-4">
          <AlertTriangle className="h-5 w-5 text-rose-300" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">Team-wide gap</p>
            <p className="text-sm text-neutral-100">{teamGap.name}</p>
            <p className="text-xs text-neutral-500">team avg {teamGap.avg}/5 · weight {teamGap.weight}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <ul className="divide-y divide-neutral-800">
          {stats.map((s) => (
            <li key={s.itemId} className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="text-sm text-neutral-100">{s.name}</p>
                <p className="text-xs text-neutral-500">
                  ↑ {s.strongest.rep.split(" ")[0]} {s.strongest.score} · ↓ {s.weakest.rep.split(" ")[0]} {s.weakest.score}
                </p>
              </div>
              <Badge variant={s.avg >= 4 ? "strong" : s.avg >= 3 ? "needs_work" : "redo"}>{s.avg}/5</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
