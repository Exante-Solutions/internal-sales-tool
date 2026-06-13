/**
 * Guided-tour step list — pure, dependency-free (Feature 5, SPEC §24).
 *
 * Single source of truth for the onboarding tour: the ordered steps that mirror
 * the 1-minute demo (score → cited moment → coach prep → drill → re-score →
 * team assign-a-drill). The React TourProvider renders these; the fixture test
 * grades order + coverage (RUBRIC F5). Routed through the SEEDED discovery call
 * so the tour never depends on a live webhook. No DOM, no framework here.
 *
 * Each step:
 *  - id     stable key
 *  - path   the route the step lives on
 *  - target data-tour attribute of the element to glow (null = caption only)
 *  - title  short heading shown in the coach bubble
 *  - body   the caption (mirrors the demo voiceover beat)
 */

export const SEED_CALL_ID = "call-northwind-disco";

export const TOUR_STEPS = [
  {
    id: "welcome",
    path: "/",
    target: "home-loop",
    title: "Welcome to CoachLoop",
    body: "The coaching loop in 30 seconds: score a real call, drill the weakest moment, watch the score move.",
  },
  {
    id: "score",
    path: `/call/${SEED_CALL_ID}`,
    target: "call-score",
    title: "Every call, auto-scored",
    body: "Each call is scored against your rubric — a /100 and a band. Process quality, not vibes.",
  },
  {
    id: "cite",
    path: `/call/${SEED_CALL_ID}`,
    target: "scorecard",
    title: "Every score cites a moment",
    body: "Tap any scorecard item and the transcript jumps to the exact quote it came from. Evidence-bound feedback.",
  },
  {
    id: "weakest",
    path: `/call/${SEED_CALL_ID}`,
    target: "weakest-skill",
    title: "Your highest-leverage gap",
    body: "It flags the one weakness that costs the most — here, the pain was never quantified. Tap to practice it.",
  },
  {
    id: "drill",
    path: `/call/${SEED_CALL_ID}/drill`,
    target: "coach-prep",
    title: "Practice, don't just read",
    body: "A quick coach prep, then an AI prospect (Claude is the brain) re-creates the exact moment — without telegraphing the skill.",
  },
  {
    id: "rescore",
    path: `/call/${SEED_CALL_ID}/drill`,
    target: "rescore-delta",
    title: "The loop closes",
    body: "Score the drill on that one skill. The bar moves — before → after, plus the points it adds to the call. Measured gain.",
  },
  {
    id: "team",
    path: "/team",
    target: "assign-drill",
    title: "Coaching at team scale",
    body: "A manager sees the team's gap and assigns the right drill to the right rep — coaching, not a dashboard.",
  },
];

/** Routes the tour is allowed to visit (used by the test to catch typo'd paths). */
export const TOUR_ROUTES = ["/", `/call/${SEED_CALL_ID}`, `/call/${SEED_CALL_ID}/drill`, "/team"];
