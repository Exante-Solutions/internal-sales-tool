import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "strong" | "needs_work" | "redo" | "neutral";

const styles: Record<Variant, string> = {
  strong: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  needs_work: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  redo: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  neutral: "bg-neutral-700/40 text-neutral-300 ring-neutral-600/40",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
