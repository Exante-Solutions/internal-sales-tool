import type { Rescore } from "@/domain/coaching";
import { Card, CardContent } from "@/components/ui/card";
import { Glyph } from "@/components/ui/glyph";

function pip(score: number, filled: boolean) {
  return (
    <span
      key={score}
      className={filled ? "h-2.5 w-2.5 rounded-[var(--radius)] bg-[var(--positive)]" : "h-2.5 w-2.5 rounded-[var(--radius)] bg-[var(--grid)]"}
    />
  );
}

/** The credibility moment: before → after on the drilled skill + points added. */
export function DeltaCard({ rescore }: { rescore: Rescore }) {
  return (
    <Card accent="positive">
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="flex items-center gap-2 text-[var(--positive)]">
          <Glyph tone="positive">◍</Glyph>
          <span className="text-xs font-semibold uppercase tracking-wide">Drill result · {rescore.skill}</span>
        </div>

        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="font-[var(--font-mono)] text-3xl tabular-nums text-[var(--bone-dim)]">{rescore.before_1_5}</span>
            <span className="font-[var(--font-mono)] text-[11px] text-[var(--bone-dim)]">before</span>
          </div>
          <Glyph tone="muted">→</Glyph>
          <div className="flex flex-col items-center gap-1">
            <span className="font-[var(--font-mono)] text-3xl tabular-nums text-[var(--positive)]">{rescore.after_1_5}</span>
            <span className="font-[var(--font-mono)] text-[11px] text-[var(--bone-dim)]">after</span>
          </div>
          <div className="ml-2 flex flex-col items-center gap-1 rounded-[var(--radius)] border border-[var(--positive)] bg-[var(--panel-2)] px-3 py-2">
            <span className="font-[var(--font-mono)] text-2xl tabular-nums text-[var(--positive)]">+{rescore.delta_points_100}</span>
            <span className="font-[var(--font-mono)] text-[11px] text-[var(--bone-dim)]">pts to call</span>
          </div>
        </div>

        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => pip(s, s <= rescore.after_1_5))}
        </div>

        <blockquote className="rounded-[var(--radius)] border border-[var(--grid)] bg-[var(--void)] p-3 font-[var(--font-serif)] text-sm italic text-[var(--bone)]">
          “{rescore.cite_quote}”
        </blockquote>
        <p className="text-xs leading-relaxed text-[var(--bone-dim)]">{rescore.rationale}</p>
      </CardContent>
    </Card>
  );
}
