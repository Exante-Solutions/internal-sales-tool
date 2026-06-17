import * as React from "react";
import { cn } from "@/lib/utils";
import { Glyph } from "@/components/ui/glyph";

export function ListRow({
  title,
  meta,
  leading,
  trailing,
  href,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const body = (
    <div className={cn("flex items-center gap-3 p-3", className)}>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--bone)]">{title}</div>
        {meta ? (
          <div className="truncate font-[var(--font-mono)] text-[11px] text-[var(--bone-dim)]">
            {meta}
          </div>
        ) : null}
      </div>
      {trailing ?? <Glyph tone="muted">→</Glyph>}
    </div>
  );

  if (!href) return body;

  return (
    <a href={href} className="block transition-colors hover:bg-[var(--panel-2)]">
      {body}
    </a>
  );
}
