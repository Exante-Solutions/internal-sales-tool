import type { Band } from "@/domain/grading";
import { cn } from "@/lib/utils";

const bandColor: Record<Band, string> = {
  strong: "text-emerald-400",
  needs_work: "text-amber-400",
  redo: "text-rose-400",
};
const bandStroke: Record<Band, string> = {
  strong: "stroke-emerald-400",
  needs_work: "stroke-amber-400",
  redo: "stroke-rose-400",
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
        <circle cx={size / 2} cy={size / 2} r={r} className="fill-none stroke-neutral-800" strokeWidth={10} />
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
        <span className={cn("text-4xl font-bold tabular-nums", bandColor[band])}>{score}</span>
        <span className="text-xs text-neutral-500">/ 100</span>
      </div>
    </div>
  );
}
