import * as React from "react";
import { cn } from "@/lib/utils";

type Accent = "neutral" | "signal" | "positive" | "attention";

const accents: Record<Accent, string> = {
  neutral: "border-l-[var(--grid)] hover:border-[var(--grid)]",
  signal: "border-l-[var(--signal)] hover:border-[var(--signal-deep)]",
  positive: "border-l-[var(--positive)] hover:border-[var(--positive)]",
  attention: "border-l-[var(--attention)] hover:border-[var(--attention)]",
};

export function Card({
  accent = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { accent?: Accent }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-l-2 border-[var(--grid)] bg-[var(--panel)] transition-[background,border-color] duration-[var(--dur-fast)] ease-[var(--ease)] hover:bg-[var(--panel-2)]",
        accents[accent],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-[var(--s2)]", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-[var(--font-display)] text-[var(--text-h3)] font-semibold leading-[var(--leading-snug)] text-[var(--bone)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-[var(--s2)] pt-0", className)} {...props} />;
}
