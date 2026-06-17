import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title,
  children,
  action,
  region,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  region?: string;
}) {
  return (
    <Card data-empty-state={region}>
      <CardContent className="flex flex-col items-start gap-2 pt-[var(--s2)]">
        <p className="text-sm font-medium text-[var(--bone)]">{title}</p>
        {children ? (
          <div className="text-xs leading-relaxed text-[var(--bone-dim)]">{children}</div>
        ) : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
