"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOUR_STEPS } from "@tour-steps";
import { TourBubble } from "./tour-bubble";
import { TourSpotlight } from "./tour-spotlight";

/**
 * Guided-tour state (Feature 5, SPEC §24). Mounted once in layout.tsx so it
 * survives route changes; drives navigation through the real loop screens and
 * renders the coach bubble + glow ring. Auto-starts on first visit (localStorage
 * flag), replayable via useTour().start(). No server state.
 */
export interface TourStep {
  id: string;
  path: string;
  target: string;
  title: string;
  body: string;
}

interface TourApi {
  active: boolean;
  index: number;
  total: number;
  step: TourStep | null;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
}

const STEPS = TOUR_STEPS as TourStep[];
const SEEN_KEY = "coachloop:tour:v1:done";

const TourCtx = createContext<TourApi | null>(null);
export function useTour(): TourApi | null {
  return useContext(TourCtx);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState(-1);
  const active = index >= 0 && index < STEPS.length;
  const step = active ? STEPS[index] : null;

  const goTo = useCallback(
    (i: number) => {
      if (i < 0) return;
      if (i >= STEPS.length) {
        setIndex(-1);
        try {
          localStorage.setItem(SEEN_KEY, "1");
        } catch {}
        return;
      }
      setIndex(i);
      if (STEPS[i].path !== pathname) router.push(STEPS[i].path);
    },
    [pathname, router],
  );

  const start = useCallback(() => goTo(0), [goTo]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const back = useCallback(() => goTo(Math.max(0, index - 1)), [goTo, index]);
  const skip = useCallback(() => {
    setIndex(-1);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);

  // Auto-start on first visit (client only).
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setIndex(0);
    } catch {}
  }, []);

  return (
    <TourCtx.Provider value={{ active, index, total: STEPS.length, step, start, next, back, skip }}>
      {children}
      {active && step && <TourSpotlight key={step.id} targetId={step.target} />}
      {active && step && <TourBubble />}
    </TourCtx.Provider>
  );
}
