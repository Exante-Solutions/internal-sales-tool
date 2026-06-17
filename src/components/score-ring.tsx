import type { Band } from "@/domain/grading";
import { cn } from "@/lib/utils";

const bandColor: Record<Band, string> = {
  strong: "text-[var(--positive)]",
  needs_work: "text-[var(--attention)]",
  redo: "text-[var(--attention)]",
};
const bandStroke: Record<Band, string> = {
  strong: "stroke-[var(--positive)]",
  needs_work: "stroke-[var(--attention)]",
  redo: "stroke-[var(--attention)]",
};

export const bandLabel: Record<Band, string> = {
  strong: "Strong",
  needs_work: "Needs work",
  redo: "Redo",
};

export function ScoreRing({ score, band, size = 132 }: { score: number; band: Band; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="fill-none stroke-[var(--grid)]" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={cn("fill-none", bandStroke[band])}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("font-[var(--font-mono)] text-4xl tabular-nums", bandColor[band])}>{score}</span>
        <span className="font-[var(--font-mono)] text-xs text-[var(--bone-dim)]">/ 100</span>
      </div>
    </div>
  );
}
