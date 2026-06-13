/**
 * Rubrics — the gradeable scorecards, faithful to SPEC.md §10 (verbatim weights
 * and anchors). Pure data + types: no SDK, no framework. Weights sum to 100 per
 * call type (enforced by the grader and the fixture test).
 */

export type CallType = "discovery" | "demo";

export interface RubricItem {
  /** 1-based position in the scorecard; stable id used across evals & drills. */
  id: number;
  name: string;
  weight: number;
  /** 5/5 anchor — what excellent looks like. */
  anchorHigh: string;
  /** 1/5 anchor — what poor looks like. */
  anchorLow: string;
}

export interface Rubric {
  callType: CallType;
  version: string;
  /** Talk-to-listen guidance shown in the playbook. */
  talkRatioNote: string;
  /** Item id that is the highest-signal criterion for this call type. */
  highestSignalItemId: number;
  items: RubricItem[];
}

export const DISCOVERY_RUBRIC: Rubric = {
  callType: "discovery",
  version: "discovery-v1",
  talkRatioNote: "Talk-to-listen target 43:57 (rep:prospect). Question target 11+, well spread.",
  highestSignalItemId: 3,
  items: [
    { id: 1, name: "Agenda set + buy-in", weight: 5, anchorHigh: "Explicit agenda signposted, buyer confirms", anchorLow: "Launched into pitch, no agenda" },
    { id: 2, name: "Question depth & spread (target 11+)", weight: 15, anchorHigh: "11+ targeted questions across past/present/future", anchorLow: "Under 6, front/back-loaded" },
    { id: 3, name: "Pain quantified in $ or days", weight: 20, anchorHigh: "Got a number — DSO, FTE hours, $ at risk/written off", anchorLow: "\"Yeah, it's a problem\" (qualitative only)" },
    { id: 4, name: "Economic Buyer named", weight: 10, anchorHigh: "EB confirmed by name + role + approval process probed", anchorLow: "EB assumed/skipped/unmentioned" },
    { id: 5, name: "Champion test", weight: 10, anchorHigh: "Contact volunteered stakeholders, named names, shared frustration", anchorLow: "Single contact, no internal pull" },
    { id: 6, name: "Multi-thread setup", weight: 10, anchorHigh: "Surfaced 2+ names; committee mapped", anchorLow: "One contact, no committee map" },
    { id: 7, name: "Talk ratio 40–46% rep", weight: 10, anchorHigh: "In band, no monologue >2 min", anchorLow: "Above 60% / under 30%; or monologue >2 min" },
    { id: 8, name: "Implication question landed", weight: 10, anchorHigh: "SPIN Implication → buyer named a consequence number", anchorLow: "No future-state question, or no buyer number" },
    { id: 9, name: "Next step locked", weight: 10, anchorHigh: "Specific date + attendees (incl. EB) + agenda", anchorLow: "\"Let's reconnect next week\"" },
  ],
};

export const DEMO_RUBRIC: Rubric = {
  callType: "demo",
  version: "demo-v1",
  talkRatioNote: "Talk-to-listen inverts: target 55–65% rep. Rep drives structure, invites reaction at checkpoints.",
  highestSignalItemId: 1,
  items: [
    { id: 1, name: "Anchored to prior discovery", weight: 20, anchorHigh: "Referenced buyer's exact words/data, quoted back", anchorLow: "Generic demo, no anchors" },
    { id: 2, name: "Tell-Show-Tell structure", weight: 15, anchorHigh: "Context → Capability → Impact arc each capability", anchorLow: "Feature dump, no structure" },
    { id: 3, name: "Customized data (logo, realistic numbers)", weight: 10, anchorHigh: "Prospect's logo + realistic numbers", anchorLow: "Generic Acme Corp data" },
    { id: 4, name: "Interactive checkpoints (every 5–7 min)", weight: 10, anchorHigh: "\"Is this how it happens today?\" cadence", anchorLow: "Monologue, no check-ins" },
    { id: 5, name: "ROI moment tied to buyer-named outcome", weight: 15, anchorHigh: "Capability tied to a quantified buyer-named outcome", anchorLow: "\"And then we have this dashboard\"" },
    { id: 6, name: "Objection invitation (proactive)", weight: 10, anchorHigh: "Proactively surfaced 1+ objection", anchorLow: "Reactive only" },
    { id: 7, name: "Pricing timing (40–49 min, 3–4 mentions)", weight: 5, anchorHigh: "Discussed 40–49 min in, 3–4 mentions", anchorLow: "Avoided entirely or front-loaded" },
    { id: 8, name: "Talk ratio 55–65% rep", weight: 5, anchorHigh: "In band, no monologue >2 min", anchorLow: "Above 80% / under 40%; or monologue >4 min" },
    { id: 9, name: "Firm future commit", weight: 10, anchorHigh: "Next step with EB or champion+sponsor on calendar", anchorLow: "\"I'll send the deck over\"" },
  ],
};

export const RUBRICS: Record<CallType, Rubric> = {
  discovery: DISCOVERY_RUBRIC,
  demo: DEMO_RUBRIC,
};

export function rubricFor(callType: CallType): Rubric {
  return RUBRICS[callType];
}
