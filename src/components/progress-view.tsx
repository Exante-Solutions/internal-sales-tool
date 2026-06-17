"use client";

import { useState } from "react";
import { REPS, repProgress } from "@/data/seed";
import { RUBRICS, type CallType } from "@/domain/rubric";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/sparkline";
import { cn } from "@/lib/utils";

export function ProgressView() {
  const [repId, setRepId] = useState(REPS[0].id);
  const [callType, setCallType] = useState<CallType>("discovery");

  const history = repProgress(repId, callType);
  const items = RUBRICS[callType].items;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--bone)]">Progress</h1>
        <p className="text-sm text-[var(--bone-dim)]">Watch each skill climb across calls - the loop’s whole point.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {REPS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRepId(r.id)}
            className={cn(
              "shrink-0 rounded-[var(--radius)] border px-3 py-1.5 text-sm transition-colors",
              r.id === repId
                ? "border-[var(--signal)] bg-[var(--panel-2)] text-[var(--bone)]"
                : "border-[var(--grid)] text-[var(--bone-dim)] hover:text-[var(--bone)]",
            )}
          >
            {r.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
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

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {items.map((it) => {
          const series = history.map((h) => h.scores[it.id]);
          const first = series[0];
          const last = series[series.length - 1];
          const delta = last - first;
          return (
            <Card key={it.id}>
              <CardContent className="flex items-center gap-3 pt-4">
                <div className="flex-1">
                  <p className="text-sm text-[var(--bone)]">{it.name}</p>
                  <p className="font-[var(--font-mono)] text-xs text-[var(--bone-dim)]">weight {it.weight}</p>
                </div>
                <Sparkline points={series} />
                <div className="w-12 text-right">
                  <span className="block text-sm font-semibold tabular-nums">{last}/5</span>
                  <span
                    className={cn(
                      "block text-[11px] tabular-nums",
                      delta > 0
                        ? "text-[var(--positive)]"
                        : delta < 0
                          ? "text-[var(--attention)]"
                          : "text-[var(--bone-dim)]",
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
