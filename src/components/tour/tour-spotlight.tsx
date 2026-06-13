"use client";

import { useEffect, useState } from "react";

/**
 * Glow-ring spotlight (Feature 5). Finds [data-tour="<targetId>"] on the current
 * page, scrolls it into view, and draws a non-blocking amber ring around it.
 * Polls briefly because the target may mount after a route change (or async
 * load); degrades to nothing if the target never appears (e.g. the re-score
 * delta before a drill is run) — the caption in the bubble still carries the step.
 */
type Rect = { top: number; left: number; width: number; height: number };

export function TourSpotlight({ targetId }: { targetId: string }) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    let raf = 0;
    let tries = 0;
    let cleanup = () => {};
    setRect(null);

    const measure = (el: Element) => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const tick = () => {
      const el = document.querySelector(`[data-tour="${targetId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const update = () => measure(el);
        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        cleanup = () => {
          window.removeEventListener("scroll", update, true);
          window.removeEventListener("resize", update);
        };
        return;
      }
      if (tries++ < 150) raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [targetId]);

  if (!rect) return null;
  const pad = 8;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-40 rounded-xl ring-2 ring-amber-400 transition-all duration-300"
      style={{
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        boxShadow: "0 0 0 4px rgba(251, 191, 36, 0.25), 0 0 24px 4px rgba(251, 191, 36, 0.2)",
      }}
    />
  );
}
