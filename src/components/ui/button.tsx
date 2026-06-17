import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "default" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "border-[var(--signal)] bg-[var(--signal-deep)] text-[var(--bone)] hover:border-[var(--signal)] hover:bg-[var(--signal)] hover:text-[var(--void)]",
  secondary:
    "border-[var(--grid)] bg-[var(--panel-2)] text-[var(--signal)] hover:border-[var(--signal-deep)] hover:bg-[var(--panel)] hover:text-[var(--bone)]",
  ghost:
    "border-[var(--grid)] bg-transparent text-[var(--signal)] hover:border-[var(--signal-deep)] hover:bg-[var(--panel)] hover:text-[var(--bone)]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[11px]",
  default: "h-10 px-4 text-xs",
  lg: "h-12 px-5 text-sm",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    glyph?: React.ReactNode;
    glyphRight?: React.ReactNode;
  }
>(({ className, variant = "primary", size = "default", glyph, glyphRight, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border font-[var(--font-display)] font-semibold uppercase tracking-[0.12em] transition-[background,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease)] disabled:pointer-events-none disabled:opacity-40",
      variants[variant],
      sizes[size],
      className,
    )}
    {...props}
  >
    {glyph ? (
      <span aria-hidden="true" className="font-[var(--font-mono)]">
        {glyph}
      </span>
    ) : null}
    {children}
    {glyphRight ? (
      <span aria-hidden="true" className="font-[var(--font-mono)]">
        {glyphRight}
      </span>
    ) : null}
  </button>
));
Button.displayName = "Button";
