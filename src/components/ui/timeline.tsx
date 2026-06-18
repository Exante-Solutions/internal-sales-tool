import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Kind = "conversation" | "call" | "email" | "calendar" | "note";

const dot: Record<Kind, string> = {
  conversation: "bg-[var(--signal)]",
  call: "bg-[var(--signal)]",
  email: "border border-[var(--grid)] bg-[var(--panel)]",
  calendar: "border border-[var(--grid)] bg-[var(--panel)]",
  note: "bg-[var(--attention)]",
};

export function Timeline({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 pl-5 before:absolute before:bottom-1 before:left-[4px] before:top-1 before:w-px before:bg-[var(--grid)]",
        className,
      )}
      {...props}
    />
  );
}

export function TimelineEntry({
  kind,
  title,
  meta,
  children,
}: {
  kind: Kind;
  title?: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={cn("absolute -left-[19px] top-2 h-2.5 w-2.5 rounded-full", dot[kind])}
      />
      <div className="rounded-[var(--radius)] border border-[var(--grid)] bg-[var(--panel)] p-3">
        <div className="flex items-center gap-2">
          <Badge variant={kind === "note" ? "needs_work" : "neutral"}>{kind}</Badge>
          {title ? <span className="text-sm text-[var(--bone)]">{title}</span> : null}
          {meta ? (
            <span className="ml-auto font-[var(--font-mono)] text-[10px] text-[var(--bone-dim)]">
              {meta}
            </span>
          ) : null}
        </div>
        {children ? (
          <div className="mt-2 text-sm leading-relaxed text-[var(--bone-dim)]">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
