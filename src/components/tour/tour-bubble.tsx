"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "./tour-provider";

/**
 * The persistent coach bubble (Feature 5). Bottom sheet on mobile (thumb zone,
 * above the bottom nav), floating card bottom-right on desktop.
 */
export function TourBubble() {
  const tour = useTour();
  if (!tour?.active || !tour.step) return null;
  const { index, total, step, next, back, skip } = tour;
  const last = index === total - 1;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:px-0 lg:pb-0">
      <div className="mx-auto max-w-md rounded-2xl border border-amber-500/40 bg-neutral-900/95 p-4 shadow-xl backdrop-blur lg:w-96">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            Guided tour · {index + 1} of {total}
          </span>
          <button onClick={skip} aria-label="Skip tour" className="text-neutral-500 hover:text-neutral-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-neutral-100">{step.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-300">{step.body}</p>
        <div className="mt-3 flex items-center gap-2">
          {index > 0 && (
            <Button variant="secondary" size="sm" onClick={back}>
              Back
            </Button>
          )}
          <Button size="sm" className="flex-1" onClick={next}>
            {last ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
