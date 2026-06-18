import Link from "next/link";
import { Glyph } from "@/components/ui/glyph";

/** Shared back link used across detail screens. */
export function PageBack({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 font-[var(--font-mono)] text-xs text-[var(--bone-dim)] hover:text-[var(--bone)]"
    >
      <Glyph tone="muted">←</Glyph> {label}
    </Link>
  );
}
