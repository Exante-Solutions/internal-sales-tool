/**
 * Team-gap selection — pure, dependency-free (Feature 4, SPEC §22).
 *
 * The single source of truth for "which rubric item is the team's
 * highest-leverage gap" = max((5 − avg) × weight). Mirrors the per-rep
 * selectWeakest math in lib/scoring/grade.mjs, lifted to team averages. Used by
 * the team view AND the team-coach adapter so "assign a drill" always points at
 * the right skill (RUBRIC F4-1/F4-2). Deterministic tie-break: higher weight,
 * then lower itemId.
 */

/** @param {{avg:number, weight:number}} stat */
export function teamLeverage(stat) {
  return (5 - stat.avg) * stat.weight;
}

/**
 * @param {{itemId:number, name:string, avg:number, weight:number}[]} stats
 * @returns the highest-leverage team stat (the team gap / assigned-drill target)
 */
export function selectTeamGap(stats) {
  return (stats ?? []).reduce((best, s) => {
    if (best === null) return s;
    const ls = teamLeverage(s);
    const lb = teamLeverage(best);
    if (ls > lb) return s;
    if (ls === lb && s.weight > best.weight) return s;
    if (ls === lb && s.weight === best.weight && s.itemId < best.itemId) return s;
    return best;
  }, /** @type {any} */ (null));
}
