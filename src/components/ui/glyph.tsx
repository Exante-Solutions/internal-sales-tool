import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "signal" | "positive" | "attention" | "muted" | "bone";

const tones: Record<Tone, string> = {
  signal: "text-[var(--signal)]",
  positive: "text-[var(--positive)]",
  attention: "text-[var(--attention)]",
  muted: "text-[var(--bone-dim)]",
  bone: "text-[var(--bone)]",
};

export function Glyph({
  children,
  tone = "signal",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-[var(--font-mono)] leading-none",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
