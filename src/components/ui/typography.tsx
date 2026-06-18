import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "muted" | "signal" | "positive" | "attention" | "bone";

const tones: Record<Tone, string> = {
  muted: "text-[var(--bone-dim)]",
  signal: "text-[var(--signal)]",
  positive: "text-[var(--positive)]",
  attention: "text-[var(--attention)]",
  bone: "text-[var(--bone)]",
};

export function Eyebrow({
  as: Comp = "span",
  tone = "muted",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  tone?: Tone;
}) {
  return (
    <Comp
      className={cn(
        "font-[var(--font-display)] text-[var(--text-eyebrow)] font-semibold uppercase tracking-[var(--track-eyebrow)]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Mono({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("font-[var(--font-mono)] font-normal tracking-normal", className)}
      {...props}
    />
  );
}

export function Serif({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "max-w-[var(--measure-prose)] font-[var(--font-serif)] text-[var(--text-prose)] leading-[var(--leading-prose)] text-[var(--bone)]",
        className,
      )}
      {...props}
    />
  );
}
