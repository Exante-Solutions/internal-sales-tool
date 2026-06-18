import { cn } from "@/lib/utils";

/** Thin determinate progress bar (0-100). */
export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-[var(--radius)] border border-[var(--grid)] bg-[var(--void)]",
        className,
      )}
    >
      <div
        className="h-full rounded-[var(--radius)] bg-[var(--signal)] transition-all duration-[var(--dur-base)] ease-[var(--ease)]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
