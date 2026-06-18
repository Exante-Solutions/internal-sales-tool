/** Tiny inline sparkline for a 1-5 score series. Pure SVG, no deps. */
export function Sparkline({ points, width = 96, height = 28 }: { points: number[]; width?: number; height?: number }) {
  if (points.length === 0) return null;
  const max = 5;
  const min = 1;
  const step = width / Math.max(1, points.length - 1);
  const y = (v: number) => height - ((v - min) / (max - min)) * (height - 4) - 2;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${y(p)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const up = last >= first;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={d}
        fill="none"
        className={up ? "stroke-[var(--positive)]" : "stroke-[var(--attention)]"}
        strokeWidth={1.5}
      />
      <circle
        cx={(points.length - 1) * step}
        cy={y(last)}
        r={2.5}
        className={up ? "fill-[var(--positive)]" : "fill-[var(--attention)]"}
      />
    </svg>
  );
}
