import * as React from "react";
import { cn } from "@/lib/utils";

export function Avatar({
  initials,
  accent = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  initials: string;
  accent?: "neutral" | "signal" | "positive" | "attention";
}) {
  const accentClass =
    accent === "signal"
      ? "border-[var(--signal)] text-[var(--signal)]"
      : accent === "positive"
        ? "border-[var(--positive)] text-[var(--positive)]"
        : accent === "attention"
          ? "border-[var(--attention)] text-[var(--attention)]"
          : "border-[var(--grid)] text-[var(--bone-dim)]";

  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius)] border bg-[var(--panel-2)] font-[var(--font-mono)] text-[10px] font-medium uppercase",
        accentClass,
        className,
      )}
      {...props}
    >
      {initials}
    </div>
  );
}
