# BUILT-TODAY — CoachLoop Batch 2

Additive feature batch on top of the closed loop. **No change to the core domain
or the Evaluation write model** (`src/domain/coaching.ts` + `lib/scoring/grade.mjs`
are byte-for-byte unchanged — pinned by blob hash in `verify.sh`). Everything new
is a port at the edge or a read/synthesis layer, with a deterministic fake behind
every gateway so the whole app runs offline with no keys.

## Feature 0 — Responsive (mobile **and** desktop)
- `src/components/app-nav.tsx` (new): one nav, two layouts — bottom tab bar on
  mobile, persistent left sidebar on desktop (`lg:`). Replaces `bottom-nav.tsx`.
- `src/app/layout.tsx`: shell unlocked from `max-w-md` — single column on mobile,
  sidebar + wide centered content (`max-w-5xl`) on desktop. Views reflow to grids.
- Gate: `verify.sh → responsive (F0-2)` (structural grep) + `write-model-unchanged`.

## Feature 1 — Contextualized drills (coach prep → roleplay)
- A drill now opens with a **sales-leader coaching session**: a grounded briefing
  (what happened, the one move, a script line) + **one** optional follow-up, then
  hands off to the roleplay. Fast on purpose.
- The AI prospect **opens like a real call** and surfaces the skill **without naming
  it** — guarded by the pure anti-telegraph rule.
- New: `domain/briefing.ts`, `CoachBriefingGateway` port, `AnthropicCoachBriefing`
  + `FakeCoachBriefing`, `lib/coaching/telegraph.mjs`, `api/coach/brief`,
  `components/coach-prep.tsx`; `anthropic-drill-scenario.ts` prompt enhanced +
  self-filtered; `coach-service.brief/answer/gaps`.
- Gate: F1-1/F1-2/F1-3 in `test/features.test.mjs` (opener proven non-telegraphing
  against real seed data; a telegraphing opener is caught). Qualitative: F1-Q.

## Feature 2 — Live call ingestion (seeded files + paste/upload)
- Pick a **seeded example** (reliable on-ramp) or **paste/upload** a transcript →
  scored through the loop → persisted as a user-owned call, drillable like the rest.
- New: `domain/store.ts`, `CallStore` port, `NeonCallStore` (durable, bootstraps its
  table) + `MemoryCallStore` (fallback), `lib/ingest/parse.mjs`, `lib/store/in-memory.mjs`,
  `data/examples/*.txt` + `data/examples.ts`, `api/calls`, `components/upload-transcript.tsx`,
  `app/calls/new`, `lib/calls.ts` (resolves seeded ∪ uploaded everywhere).
- Offline scoring: `FakeScorer.synthesizeEvaluation` produces a **grader-valid**
  eval for any transcript so uploads work with no key.
- Persistence boundary: Neon when `DATABASE_URL` is set; in-memory otherwise (prod
  alias currently runs in-memory by design — set `DATABASE_URL` to go durable).
- Gate: F2-1 (examples parse to grounded segments), F2-2/F2-3 (store round-trip +
  ownership isolation, fails loudly).

## Feature 3 — Auth-ready Session + home menu
- A **home menu** is the landing hub (pick where to go), with identity from a new
  **Session** abstraction. Real Auth0 is scaffolded (env documented, port ready for
  an `Auth0SessionGateway`); **seeded-team fallback** means a missing login never
  breaks the demo.
- New: `domain/session.ts`, `SessionGateway` port, `SeededSessionGateway`,
  `lib/auth/session.mjs`, `components/home-menu.tsx`, `app/page.tsx` hub;
  `composition.authMode/buildSession`; `.env.example` AUTH0_* scaffolded.
- Gate: F3-1 (session well-formed), F3-2 (auth falls back to seeded when unconfigured).

## Feature 4 — TeamView organized by the rubric
- Restructured to **call type → rubric → people**: per-rubric-item team averages
  (rubric order, weights) that expand to per-person scores. The **agentic coaching
  action** (who needs what + **assign a drill**) is the hero, above the metrics.
- New: `domain/team.ts`, `TeamCoachGateway` port, `AnthropicTeamCoach` + `FakeTeamCoach`,
  `lib/team/select.mjs` (deterministic team gap) + `lib/team/action.mjs`, `api/team/coach`,
  `seed.teamItemScores/seededDrillCallId`; `team-view.tsx` rebuilt.
- Gate: F4-1 (gap = highest-leverage item), F4-2 (assigned drill targets the gap,
  worst rep first). Qualitative: F4-Q.

## Adversarial review (6 confirmed findings, all fixed)
A parallel review workflow (one reviewer per feature + arch/spec, each finding
adversarially re-verified) confirmed 6 issues; all resolved:
- **F4 (critical):** "assign a drill" drilled the rep's *personal* weakest item,
  not the team-assigned gap. Fixed by threading `skillId` end-to-end (team link →
  drill page `?skillId` → `DrillClient`/`CoachPrep`/`VoiceDrill`/`TextDrill` →
  `/api/coach/brief`, `/api/drill/turn`, `/api/rescore`) and adding an optional
  `targetItemId` to `CoachService.fumbledMoment`. **Verified live:** team gap
  "Question depth & spread" now drills that skill, not "Pain quantified."
- **F0 (×2):** `team-view` + `progress-view` now reflow to `lg:grid-cols-2`.
- **F3:** SPEC §21 aligned to the real hub (4 destination cards + inline calls/drill).
- **F2 (minor):** upload callId hardened with a random suffix (no same-ms collision).

## Verification
- `scripts/verify.sh` extended to run all `test/*.test.mjs` + the responsive and
  write-model structural gates. Local gates green (typecheck, lint, 24 tests,
  responsive, write-model); `npm run build` green. Neon-backed ingest verified
  live in dev (`storage: neon`, score + persist + list round-trip). Live-URL gate
  closes against the Vercel prod alias after deploy.
