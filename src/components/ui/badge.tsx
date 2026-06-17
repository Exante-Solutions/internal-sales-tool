import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "strong" | "needs_work" | "redo" | "neutral";

const styles: Record<Variant, string> = {
  strong: "border-[var(--positive)] text-[var(--positive)]",
  needs_work: "border-[var(--attention)] text-[var(--attention)]",
  redo: "border-[var(--attention)] bg-[var(--panel-2)] text-[var(--attention)]",
  neutral: "border-[var(--grid)] text-[var(--bone-dim)]",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius)] border bg-transparent px-2 py-0.5 font-[var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.06em]",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({
  status = "proven",
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  status?: "proven" | "exploratory" | "neutral";
}) {
  const variant =
    status === "proven" ? "strong" : status === "exploratory" ? "needs_work" : "neutral";
  return (
    <Badge variant={variant} className={className} {...props}>
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "proven"
            ? "bg-[var(--positive)]"
            : status === "exploratory"
              ? "bg-[var(--attention)]"
              : "bg-[var(--bone-dim)]",
        )}
      />
      {children ?? (status === "proven" ? "proven" : status)}
    </Badge>
  );
}
