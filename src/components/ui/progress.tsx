import { cn } from "@/lib/utils";

/** Thin determinate progress bar (0-100). */
export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-neutral-800", className)}>
      <div
        className="h-full rounded-full bg-white transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
