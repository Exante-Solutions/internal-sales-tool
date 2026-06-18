import * as React from "react";
import { cn } from "@/lib/utils";

export function Chip({
  live = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { live?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-2.5 py-1 font-[var(--font-mono)] text-xs transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] disabled:cursor-default disabled:opacity-50",
        live
          ? "border-[var(--signal-deep)] text-[var(--signal)] hover:border-[var(--signal)] hover:text-[var(--bone)]"
          : "border-[var(--grid)] text-[var(--bone-dim)] hover:border-[var(--signal-deep)] hover:text-[var(--bone)]",
        className,
      )}
      {...props}
    >
      {live ? (
        <span aria-hidden="true" className="text-[var(--positive)]">
          ◍
        </span>
      ) : null}
      {children}
    </button>
  );
}
