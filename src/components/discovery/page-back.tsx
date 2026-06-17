import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Shared back link used across detail screens. */
export function PageBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
      <ChevronLeft className="h-4 w-4" /> {label}
    </Link>
  );
}
