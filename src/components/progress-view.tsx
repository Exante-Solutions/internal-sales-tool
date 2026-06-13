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
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-sm text-neutral-400">Watch each skill climb across calls — the loop’s whole point.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {REPS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRepId(r.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              r.id === repId ? "border-white bg-white text-black" : "border-neutral-700 text-neutral-300",
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
              "flex-1 rounded-lg border py-2 text-sm capitalize",
              ct === callType ? "border-white bg-neutral-800 text-white" : "border-neutral-800 text-neutral-400",
            )}
          >
            {ct}
          </button>
        ))}
      </div>

      <Card>
        <ul className="divide-y divide-neutral-800">
          {items.map((it) => {
            const series = history.map((h) => h.scores[it.id]);
            const first = series[0];
            const last = series[series.length - 1];
            const delta = last - first;
            return (
              <li key={it.id} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <p className="text-sm text-neutral-100">{it.name}</p>
                  <p className="text-xs text-neutral-500">weight {it.weight}</p>
                </div>
                <Sparkline points={series} />
                <div className="w-12 text-right">
                  <span className="block text-sm font-semibold tabular-nums">{last}/5</span>
                  <span
                    className={cn(
                      "block text-[11px] tabular-nums",
                      delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-neutral-500",
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
