/**
 * Team coaching-action skeleton — pure, dependency-free (Feature 4, SPEC §22).
 *
 * Deterministically picks WHO needs the drill on the team's gap item (worst
 * scorers first) and what to assign. The Opus adapter only enriches the prose
 * (headline + why); the targets (itemId, repId) come from here so "assign a
 * drill" can never point at the wrong skill (RUBRIC F4-2). Tested directly.
 */

/**
 * @param {{itemId:number, name:string}} gap  the team gap (from selectTeamGap)
 * @param {{repId:string, repName:string, score:number, drillCallId?:string}[]} perRepScores  per-rep score on the gap item
 * @param {number} [limit]
 */
export function buildRecommendations(gap, perRepScores, limit = 3) {
  return [...(perRepScores ?? [])]
    .sort((a, b) => a.score - b.score || a.repId.localeCompare(b.repId))
    .slice(0, limit)
    .map((p) => ({
      repId: p.repId,
      repName: p.repName,
      skill: gap.name,
      itemId: gap.itemId,
      why: `Lowest on "${gap.name}" at ${p.score}/5 — the team's highest-leverage gap. One focused drill moves the team number most here.`,
      drillCallId: p.drillCallId,
    }));
}
