import * as React from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/typography";

export function StatTile({
  label,
  value,
  attention = false,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  attention?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-[var(--grid)] bg-[var(--panel)] p-[13px_15px]",
        attention && "border-l-2 border-l-[var(--attention)]",
        className,
      )}
    >
      <Eyebrow>{label}</Eyebrow>
      <div
        className={cn(
          "mt-2 font-[var(--font-mono)] text-[30px] leading-none text-[var(--bone)]",
          attention && "text-[var(--attention)]",
        )}
      >
        {value}
      </div>
    </div>
  );
}
