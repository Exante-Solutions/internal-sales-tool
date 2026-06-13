export const meta = {
  name: 'verify-scores',
  description: 'Adversarially verify the scoring closed-loop (score→flag→drill→re-score) against SPEC.md + RUBRIC.md. Reads `args` so it runs on a NEW rubric/call type with no script edits: review finds correctness/spec gaps, a skeptic refutes each one.',
  whenToUse: 'After adding or editing a rubric (e.g. a new call type) or touching the scorer/grader/rescorer. Pass args: { callType, rubricRef, transcript, focus } to scope it to the new rubric.',
  phases: [
    { title: 'Review', detail: 'one agent per loop node finds correctness/spec gaps' },
    { title: 'Verify', detail: 'skeptic refutes each finding against the code' },
  ],
}

// ── args (all optional — defaults run a full closed-loop review) ────────────
// Pass a string (treated as `focus`) or an object:
//   { repo, callType, rubricRef, transcript, focus }
// `callType`/`rubricRef`/`transcript` scope the review to a NEW rubric so this
// workflow runs unedited the moment someone adds, e.g., the Proposal/Close
// scorecards (SPEC.md §11) or any custom rubric.
const a = typeof args === 'string' ? { focus: args } : (args || {})
const REPO = a.repo || '/Users/vargas/personal/coachloop'
const CALL_TYPE = a.callType || null
const RUBRIC_REF = a.rubricRef || null
const TRANSCRIPT = a.transcript || null
const FOCUS = a.focus || null

const rubricScope = CALL_TYPE || RUBRIC_REF
  ? `\n\nNEW-RUBRIC SCOPE — verify the scoring path specifically for this rubric:\n${CALL_TYPE ? `- call type: "${CALL_TYPE}" (its rubric must be registered in ${REPO}/src/domain/rubric.ts: a RubricItem[] whose weights sum to EXACTLY 100, each with id/name/weight/anchorHigh/anchorLow, wired into RUBRICS + rubricFor + the CallType union).\n` : ''}${RUBRIC_REF ? `- rubric definition under review: ${RUBRIC_REF}\n` : ''}- Confirm the scorer (anthropic-scorer.ts) emits, for THIS rubric, an evaluation the canonical grader (grade.mjs validateEvaluation) ACCEPTS: weights sum 100, every item 1-5 with a grounded citation, score_100 = round(Σ(score×weight)÷5), band matches score_100 (NOT an unrounded sum — watch the 79.5-80 / 59.5-60 boundary if weights aren't all multiples of 5), weakest_item_id = max-leverage item. Flag any case where the scorer's own output would be rejected by its own grader.`
  : ''

const transcriptScope = TRANSCRIPT
  ? `\n\nTRANSCRIPT TO REASON OVER (segments may share a timestamp — a real quote in any segment at a ts must ground, per SPEC §8 transcript_seg.idx):\n${TRANSCRIPT}`
  : ''

const focusScope = FOCUS ? `\n\nEXTRA FOCUS FROM THE CALLER: ${FOCUS}` : ''

const COMMON = `Repo: ${REPO}. This is CoachLoop, a Next.js sales-call coaching app. The closed loop is: SCORE a transcript (Opus adversarial scorer) -> FLAG the highest-leverage weak skill -> DRILL it (voice role-play) -> RE-SCORE the drill -> show before/after delta.

Authoritative specs: ${REPO}/SPEC.md (esp. §3, §9 scoring four passes + gap selection + citation grounding, §10-11 rubrics) and ${REPO}/RUBRIC.md (acceptance assertions A-E). The pure grader is ${REPO}/lib/scoring/grade.mjs (single source of truth, used by ${REPO}/test/scorer.test.mjs). Rubrics: ${REPO}/src/domain/rubric.ts. Domain types: ${REPO}/src/domain/*. Use case: ${REPO}/src/application/coach-service.ts. Adapters: ${REPO}/src/infrastructure/anthropic-{scorer,rescorer,drill-scenario}.ts, fake-adapters.ts, composition.ts, llm.ts. Routes: ${REPO}/src/app/api/{score,rescore,drill}/**.

REPORT ONLY correctness and spec-faithfulness gaps ON THE CLOSED-LOOP PATH. NOT style, naming, formatting, perf, or test coverage. A finding must be a concrete behavior where the code contradicts SPEC.md/RUBRIC.md or is internally inconsistent (e.g. the scorer emits output its own grader would reject). Read the actual files. Cite file:line and the exact spec clause.${rubricScope}${transcriptScope}${focusScope}`

const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          node: { type: 'string', enum: ['score', 'flag', 'drill', 'rescore', 'cross-cutting'] },
          file: { type: 'string' },
          line: { type: 'string' },
          severity: { type: 'string', enum: ['breaks-loop', 'wrong-result', 'minor'] },
          spec_ref: { type: 'string' },
          explanation: { type: 'string' },
          repro: { type: 'string', description: 'concrete input/values that trigger the bug' },
        },
        required: ['title', 'node', 'file', 'line', 'severity', 'spec_ref', 'explanation', 'repro'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    real: { type: 'boolean', description: 'true only if the bug genuinely exists and contradicts spec or is internally inconsistent' },
    reasoning: { type: 'string' },
    corrected_severity: { type: 'string', enum: ['breaks-loop', 'wrong-result', 'minor', 'not-a-bug'] },
  },
  required: ['real', 'reasoning', 'corrected_severity'],
}

const DIMS = [
  { key: 'score', prompt: `Focus: the SCORE node. anthropic-scorer.ts + score/route.ts + grade.mjs validateEvaluation, for the rubric under review. Check: does the scorer ever emit an evaluation its OWN grader (validateEvaluation) would reject? Pay attention to score_100 rounding vs band derivation (scorer rounds score_100; grader must band off the same rounded value — band-boundary mismatch at 79.5-80 / 59.5-60 when weights aren't all multiples of 5). Citation grounding: multiple segments can share a ts (grade.mjs/anthropic-scorer must check EVERY segment at that ts, not last-wins). Weakest-item consistency. The 4-pass/adversarial flow vs SPEC §9.` },
  { key: 'flag', prompt: `Focus: the FLAG/gap-selection node. selectWeakest + leverage in grade.mjs, coach-service.fumbledMoment. Check: leverage = (5-score)*weight per SPEC §9; deterministic tie-break; does fumbledMoment pick the SAME item as weakest_item_id (and does the /api/rescore path enforce that on seeded evals that never ran validateEvaluation?); rep_line/prospect_line derivation correctness (forward-search fallback can put the rep's own line into prospect_line on a trailing rep-cited moment); before_1_5 sourced honestly from the original item score.` },
  { key: 'drill', prompt: `Focus: the DRILL node. anthropic-drill-scenario.ts, app/api/drill/** routes, components/voice-drill.tsx + drill-client.tsx. Check: scenario re-stages the flagged moment for the RIGHT item; recovery is tied to the drilled item's 5/5 anchor (not a hardcoded skill-specific heuristic); seeded vs live recovery detection; N-turn cap end condition (SPEC §7 default 6); the drill transcript that flows to re-score is the real drilled item.` },
  { key: 'rescore', prompt: `Focus: the RE-SCORE node. anthropic-rescorer.ts + rescore/route.ts + grade.mjs validateRescore + coach-service.rescore + delta-card.tsx. Check: scoped to ONE item (RUBRIC D1); before_1_5 == original item score (D2); delta_points_100 == (after-before)*weight/5 (D3); a NEGATIVE delta must not render as a positive "+gain" (D4); does the rescorer emit something validateRescore rejects; rounding of after_1_5; the route rebuilds fumbledMoment deterministically so drilled_item_id matches.` },
  { key: 'cross', prompt: `Focus: CROSS-CUTTING math/consistency. Compare grade.mjs (the runtime grader) against the scorer/rescorer adapters for any formula or rounding divergence. Compare fake-adapters.ts vs the real adapters for loop-shape parity. Check band thresholds, weight-sum, score_100 formula all agree across grade.mjs, anthropic-scorer.ts, rubric.ts, SPEC §9, RUBRIC B1-B3 — for the rubric under review.` },
]

const reviewed = await pipeline(
  DIMS,
  (d) => agent(`${COMMON}\n\n${d.prompt}`, { label: `review:${d.key}`, phase: 'Review', schema: FINDING_SCHEMA }),
  (res, d) => {
    const findings = (res && res.findings) || []
    if (!findings.length) return []
    return parallel(findings.map((f) => () =>
      agent(`${COMMON}\n\nA reviewer claims this closed-loop bug. Try HARD to refute it by reading the actual code. It is NOT real if the code actually handles the case, if a downstream guard catches it, or if it's style/coverage not correctness. Default to real=false unless you can confirm the contradicting behavior with file:line evidence.\n\nCLAIM: ${f.title}\nNODE: ${f.node}\nFILE: ${f.file}:${f.line}\nSPEC: ${f.spec_ref}\nWHY: ${f.explanation}\nREPRO: ${f.repro}`,
        { label: `verify:${d.key}:${f.title.slice(0, 30)}`, phase: 'Verify', schema: VERDICT_SCHEMA })
        .then((v) => ({ ...f, verdict: v }))
    ))
  }
)

const confirmed = reviewed.flat().filter(Boolean)
  .filter((f) => f.verdict && f.verdict.real && f.verdict.corrected_severity !== 'not-a-bug')

const rank = { 'breaks-loop': 0, 'wrong-result': 1, 'minor': 2 }
confirmed.sort((a, b) => (rank[a.verdict.corrected_severity] ?? 3) - (rank[b.verdict.corrected_severity] ?? 3))

return { scope: { callType: CALL_TYPE, rubricRef: RUBRIC_REF, focus: FOCUS }, confirmed_count: confirmed.length, confirmed }
