"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Target, Quote } from "lucide-react";
import type { Evaluation, Transcript } from "@/domain/coaching";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreRing, bandLabel } from "@/components/score-ring";
import { cn, formatTs } from "@/lib/utils";

function scoreDot(score: number) {
  if (score >= 4) return "bg-emerald-400";
  if (score === 3) return "bg-amber-400";
  return "bg-rose-400";
}

export function EvalView({ evaluation, transcript }: { evaluation: Evaluation; transcript: Transcript }) {
  const [activeTs, setActiveTs] = useState<number | null>(null);
  const segRefs = useRef<Record<number, HTMLDivElement | null>>({});

  function jumpTo(ts: number) {
    setActiveTs(ts);
    segRefs.current[ts]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const weakest = evaluation.items.find((i) => i.rubric_item_id === evaluation.weakest_item_id)!;

  return (
    <div className="flex flex-col gap-5">
      {/* Headline + score */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-4 text-center">
          <ScoreRing score={evaluation.score_100} band={evaluation.band} />
          <Badge variant={evaluation.band}>{bandLabel[evaluation.band]}</Badge>
          <p className="text-sm font-medium text-neutral-200">{evaluation.headline}</p>
          <p className="text-xs leading-relaxed text-neutral-400">{evaluation.deal_vs_process_note}</p>
        </CardContent>
      </Card>

      {/* The one coaching theme → drill */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex flex-col gap-3 pt-4">
          <div className="flex items-center gap-2 text-amber-300">
            <Target className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Your highest-leverage gap</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-100">{weakest.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-300">{evaluation.coaching_theme}</p>
          </div>
          <Link href={`/call/${evaluation.call_id}/drill`}>
            <Button size="lg" className="w-full">
              Drill this skill
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Scorecard — tap an item to jump the transcript */}
      <div>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Scorecard</h2>
        <Card>
          <ul className="divide-y divide-neutral-800">
            {evaluation.items.map((item) => (
              <li key={item.rubric_item_id}>
                <button
                  onClick={() => jumpTo(item.cite_ts_seconds)}
                  className={cn(
                    "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-neutral-800/50",
                    item.rubric_item_id === evaluation.weakest_item_id && "bg-amber-500/5",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", scoreDot(item.score_1_5))} />
                  <span className="flex-1">
                    <span className="block text-sm text-neutral-100">{item.name}</span>
                    <span className="block text-xs text-neutral-500">{item.rationale}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-neutral-200">{item.score_1_5}/5</span>
                    <span className="block text-[11px] tabular-nums text-sky-400">@ {formatTs(item.cite_ts_seconds)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Transcript */}
      <div>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Transcript</h2>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            {transcript.segments.map((seg) => {
              const isRep = /rep/i.test(seg.speaker);
              const active = seg.ts === activeTs;
              return (
                <div
                  key={seg.ts}
                  ref={(el) => {
                    segRefs.current[seg.ts] = el;
                  }}
                  className={cn(
                    "rounded-lg p-2 transition-colors",
                    active && "bg-sky-500/15 ring-1 ring-sky-500/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[11px] font-semibold", isRep ? "text-sky-300" : "text-neutral-400")}>
                      {seg.speaker}
                    </span>
                    <span className="text-[11px] tabular-nums text-neutral-600">{formatTs(seg.ts)}</span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-200">{seg.text}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* citation footnote */}
      <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[11px] text-neutral-600">
        <Quote className="h-3 w-3" />
        Every score cites a real moment — tap any item to jump there.
      </p>
    </div>
  );
}
