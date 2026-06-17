import * as React from "react";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-[var(--radius)] border border-[var(--grid)] bg-[var(--void)] px-3 text-sm text-[var(--bone)] outline-none transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] placeholder:text-[var(--bone-dim)] focus:border-[var(--signal)] disabled:opacity-50";

export const Field = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("h-10", fieldClass, className)} {...props} />
  ),
);
Field.displayName = "Field";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn("h-10 capitalize", fieldClass, className)} {...props} />
  ),
);
Select.displayName = "Select";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("min-h-24 py-2", fieldClass, className)} {...props} />
));
Textarea.displayName = "Textarea";
