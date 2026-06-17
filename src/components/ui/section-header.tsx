import * as React from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/typography";

export function SectionHeader({
  title,
  meta,
  action,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-1", className)}>
      <div className="min-w-0">
        <Eyebrow as="h2" className="block truncate">
          {title}
        </Eyebrow>
        {meta ? (
          <div className="mt-1 font-[var(--font-mono)] text-[10px] text-[var(--bone-dim)]">
            {meta}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
