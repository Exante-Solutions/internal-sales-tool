import { ArrowRight, TrendingUp } from "lucide-react";
import type { Rescore } from "@/domain/coaching";
import { Card, CardContent } from "@/components/ui/card";

function pip(score: number, filled: boolean) {
  return (
    <span
      key={score}
      className={filled ? "h-2.5 w-2.5 rounded-full bg-white" : "h-2.5 w-2.5 rounded-full bg-neutral-700"}
    />
  );
}

/** The credibility moment: before → after on the drilled skill + points added. */
export function DeltaCard({ rescore }: { rescore: Rescore }) {
  return (
    <Card data-tour="rescore-delta" className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="flex items-center gap-2 text-emerald-300">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Drill result — {rescore.skill}</span>
        </div>

        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl font-bold tabular-nums text-neutral-400">{rescore.before_1_5}</span>
            <span className="text-[11px] text-neutral-500">before</span>
          </div>
          <ArrowRight className="h-5 w-5 text-neutral-600" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl font-bold tabular-nums text-emerald-400">{rescore.after_1_5}</span>
            <span className="text-[11px] text-neutral-500">after</span>
          </div>
          <div className="ml-2 flex flex-col items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-2">
            <span className="text-2xl font-bold tabular-nums text-emerald-300">+{rescore.delta_points_100}</span>
            <span className="text-[11px] text-emerald-200/70">pts to call</span>
          </div>
        </div>

        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => pip(s, s <= rescore.after_1_5))}
        </div>

        <blockquote className="rounded-lg bg-neutral-900/60 p-3 text-xs italic text-neutral-300">
          “{rescore.cite_quote}”
        </blockquote>
        <p className="text-xs leading-relaxed text-neutral-400">{rescore.rationale}</p>
      </CardContent>
    </Card>
  );
}
