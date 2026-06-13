/**
 * CoachLoop scoring grader — pure, dependency-free.
 *
 * Single source of truth for the scoring invariants the product must uphold.
 * Used by the fixture test (test/scorer.test.mjs) today and importable by the
 * Next.js app once the Opus 4.8 scorer is wired in. No Anthropic call here:
 * this validates the SHAPE and INTEGRITY of a scorer's output, not its taste.
 *
 * Rubric mechanics (faithful to SPEC.md §9): each item scored 1-5, weights
 * sum to 100, score_100 = Σ(score × weight) ÷ 5. Bands: 80+ strong,
 * 60-79 needs_work, <60 redo. Drill target = highest leverage = (5-score)×weight.
 */

export const BANDS = /** @type {const} */ (["strong", "needs_work", "redo"]);

/** @param {number} score100 */
export function bandFor(score100) {
  if (score100 >= 80) return "strong";
  if (score100 >= 60) return "needs_work";
  return "redo";
}

/** @param {{score_1_5:number, weight:number}[]} items */
export function computeScore100(items) {
  const weighted = items.reduce((sum, i) => sum + i.score_1_5 * i.weight, 0);
  return weighted / 5;
}

/** @param {{score_1_5:number, weight:number}} item */
export function leverage(item) {
  return (5 - item.score_1_5) * item.weight;
}

/**
 * Highest-leverage item = the "one coaching theme" / drill target.
 * Ties break to the higher weight, then the lower item id (deterministic).
 * @param {{rubric_item_id:number, score_1_5:number, weight:number}[]} items
 */
export function selectWeakest(items) {
  return items.reduce((best, i) => {
    if (best === null) return i;
    const li = leverage(i);
    const lb = leverage(best);
    if (li > lb) return i;
    if (li === lb && i.weight > best.weight) return i;
    if (li === lb && i.weight === best.weight && i.rubric_item_id < best.rubric_item_id) return i;
    return best;
  }, /** @type {any} */ (null));
}

function isInt1to5(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

/**
 * Grade a full evaluation against the transcript it claims to cite.
 * Returns { ok, errors }. Every failure is a human-readable string.
 *
 * @param {{
 *   score_100:number, band:string, weakest_item_id:number,
 *   items:{rubric_item_id:number, name?:string, weight:number, score_1_5:number,
 *          cite_ts_seconds:number|null, cite_quote:string}[]
 * }} evaluation
 * @param {{segments:{ts:number, speaker:string, text:string}[]}} transcript
 */
export function validateEvaluation(evaluation, transcript) {
  const errors = [];
  const items = evaluation.items ?? [];

  // transcript index: ts -> ALL texts at that ts (for citation grounding).
  // Multiple segments can share a timestamp (SPEC §8 transcript_seg has a
  // per-row idx; second-granularity pastes routinely put two utterances in the
  // same second). A ts->text Map would be last-wins and shadow the first
  // segment, so a REAL quote from it would fail grounding. Index every segment.
  const segByTs = new Map();
  for (const s of transcript.segments) {
    const texts = segByTs.get(s.ts);
    if (texts) texts.push(s.text);
    else segByTs.set(s.ts, [s.text]);
  }

  // weights must sum to 100
  const weightSum = items.reduce((s, i) => s + i.weight, 0);
  if (weightSum !== 100) {
    errors.push(`rubric weights sum to ${weightSum}, expected 100`);
  }

  for (const item of items) {
    const id = item.rubric_item_id;

    if (!isInt1to5(item.score_1_5)) {
      errors.push(`item ${id}: score ${item.score_1_5} is not an integer 1-5`);
    }

    // CITATION GROUNDING — every score must point at a real transcript moment
    if (item.cite_ts_seconds === null || item.cite_ts_seconds === undefined) {
      errors.push(`item ${id}: missing timestamp citation`);
    } else if (!segByTs.has(item.cite_ts_seconds)) {
      errors.push(`item ${id}: cites timestamp ${item.cite_ts_seconds}s which is not in the transcript`);
    } else if (!String(item.cite_quote ?? "").trim()) {
      errors.push(`item ${id}: missing cited quote`);
    } else if (!segByTs.get(item.cite_ts_seconds).some((t) => t.includes(item.cite_quote))) {
      errors.push(`item ${id}: cited quote not found at timestamp ${item.cite_ts_seconds}s (hallucinated citation)`);
    }
  }

  // score + band consistency
  const computed = computeScore100(items);
  if (Math.round(computed) !== evaluation.score_100) {
    errors.push(`score_100 is ${evaluation.score_100} but items compute to ${Math.round(computed)}`);
  }
  const expectedBand = bandFor(computed);
  if (evaluation.band !== expectedBand) {
    errors.push(`band is "${evaluation.band}" but score ${Math.round(computed)} maps to "${expectedBand}"`);
  }

  // weakest skill flagged correctly
  const weakest = selectWeakest(items);
  if (weakest && weakest.rubric_item_id !== evaluation.weakest_item_id) {
    errors.push(`weakest_item_id is ${evaluation.weakest_item_id} but highest-leverage item is ${weakest.rubric_item_id}`);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Grade a drill re-score: scoped to ONE item, before matches the original,
 * delta is computed correctly.
 *
 * @param {{drilled_item_id:number, before_1_5:number, after_1_5:number,
 *          weight:number, delta_points_100:number}} drill
 * @param {{items:{rubric_item_id:number, weight:number, score_1_5:number}[]}} originalEvaluation
 */
export function validateRescore(drill, originalEvaluation) {
  const errors = [];
  const original = originalEvaluation.items.find((i) => i.rubric_item_id === drill.drilled_item_id);

  if (!original) {
    errors.push(`drilled_item_id ${drill.drilled_item_id} is not in the original evaluation`);
    return { ok: false, errors };
  }
  if (drill.weight !== original.weight) {
    errors.push(`drill weight ${drill.weight} does not match original item weight ${original.weight}`);
  }
  if (drill.before_1_5 !== original.score_1_5) {
    errors.push(`before score ${drill.before_1_5} does not match original item score ${original.score_1_5}`);
  }
  if (!isInt1to5(drill.after_1_5)) {
    errors.push(`after score ${drill.after_1_5} is not an integer 1-5`);
  }
  const expectedDelta = ((drill.after_1_5 - drill.before_1_5) * drill.weight) / 5;
  if (drill.delta_points_100 !== expectedDelta) {
    errors.push(`delta_points_100 is ${drill.delta_points_100} but (after-before)×weight÷5 = ${expectedDelta}`);
  }

  return { ok: errors.length === 0, errors };
}
