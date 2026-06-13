# RUBRIC.md — CoachLoop acceptance criteria

The build is **done** when every assertion below is **PASS**. Each is a single checkable
claim, graded either by the machine check (`scripts/verify.sh`) or by a one-line manual
observation. This file is the artifact the model grades itself against (Build Day
orchestration criterion); derived from [`SPEC.md`](SPEC.md) §13.

**Deploy target: Vercel.** The canonical live URL for verification is the **Vercel-assigned production URL** (e.g. `https://coachloop.vercel.app`). A custom domain is out of scope for the agent — point `VERIFY_URL` at the Vercel URL; swapping in a custom domain later is the owner's step and doesn't change any assertion.

```bash
# Machine check — non-zero exit on any failure
npm install                                   # once, enables typecheck + lint
VERIFY_URL=https://coachloop.vercel.app bash scripts/verify.sh
```

Status legend: **PASS** / **FAIL** / **PENDING** (not built yet).

---

## A. Deploy & build gates

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| A1 | The deployed URL returns HTTP 2xx within 15s. | `verify.sh` → `live url` (`curl -fsS`) | PENDING |
| A2 | The app is usable on a mobile viewport (375×812): the hero loop is reachable, no horizontal scroll, tap targets ≥ 40px. | Manual: open `VERIFY_URL` in a phone-sized viewport | PENDING |
| A3 | `npm run typecheck` passes (no type errors). | `verify.sh` → `typecheck` | PENDING |
| A4 | `npm run lint` passes. | `verify.sh` → `lint` | PENDING |
| A5 | The scoring fixture test passes. | `verify.sh` → `test` (`node --test test/scorer.test.mjs`) | **PASS** |

---

## B. Scoring — a seeded transcript returns a valid, evidence-bound score

Graded by `test/scorer.test.mjs` against `test/fixtures/` (seeded Discovery transcript +
golden evaluation), plus a live check once the Opus 4.8 scorer is wired in.

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| B1 | A seeded transcript yields an evaluation with a `/100` score and a band in {`strong`,`needs_work`,`redo`}. | test: *"score band is a valid value…"* | **PASS** |
| B2 | `score_100` equals `Σ(item_score × weight) ÷ 5` (no arithmetic drift). | test: same as B1 (`computeScore100`) | **PASS** |
| B3 | The band matches the score (`80+`→strong, `60–79`→needs_work, `<60`→redo). | test: `bandFor` assertion | **PASS** |
| B4 | **Every** item score cites a `cite_ts_seconds` that exists in the transcript. | test: *"every score cites a timestamp…"* | **PASS** |
| B5 | **Every** cited quote is real text spoken at that timestamp (no hallucinated citation). | test: *"golden evaluation passes all grader invariants"* (substring grounding) + *"rejects a hallucinated quote…"* | **PASS** |
| B6 | Rubric weights sum to exactly 100. | test: `validateEvaluation` weight-sum check | **PASS** |
| B7 | (Live) The deployed scorer produces B1–B6 for a transcript posted to `/api/score`. | Manual/curl once `/api/score` exists | PENDING |

---

## C. Weakest skill — flagged and clickable

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| C1 | The flagged weakest skill is the **highest-leverage** item: `max((5 − score) × weight)` (deterministic tie-break). | test: *"weakest skill is the highest-leverage item…"* | **PASS** |
| C2 | The flagged weakness carries a `cite_ts_seconds`, so the UI can deep-link to that moment (clickable). | test: same as C1 | **PASS** |
| C3 | (Live) Tapping the flagged skill jumps the transcript to that timestamp. | Manual on `VERIFY_URL` | PENDING |

---

## D. Drill → scoped re-score with a visible before/after delta

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| D1 | A drill re-score targets exactly **one** rubric item (the drilled skill) — scoped, not a full re-eval. | test: `validateRescore` item match + weight match | **PASS** |
| D2 | `before_1_5` equals the original call's score for that item (the delta is honest). | test: *"rejects a re-score whose before-score lies…"* | **PASS** |
| D3 | `delta_points_100` equals `(after − before) × weight ÷ 5`. | test: *"rejects a re-score whose delta math is wrong"* + happy-path | **PASS** |
| D4 | A genuine improvement shows a **positive** delta on screen. | test: *"re-score is scoped… correct before/after delta"* | **PASS** |
| D5 | (Live) Completing a voice drill renders the before→after delta for the drilled skill. | Manual on `VERIFY_URL` | PENDING |

---

## E. The gate fails loudly (meta-assertion)

The grader is only useful if a *bad* score is rejected. These prove it.

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| E1 | A score with a **missing timestamp** is rejected. | test: *"rejects a score with a missing timestamp"* | **PASS** |
| E2 | A citation pointing at a **non-existent timestamp** is rejected. | test: *"rejects a citation pointing at a timestamp not in the transcript"* | **PASS** |
| E3 | A **mismatched band** is rejected. | test: *"rejects a band that does not match the score"* | **PASS** |
| E4 | A **wrong weakest-skill** flag is rejected. | test: *"rejects a wrong weakest-skill flag"* | **PASS** |

> Verified live: blanking one real timestamp in the golden fixture turns the suite red
> (9 pass / 3 fail); restoring it returns 12/12. The gate is not cosmetic.

---

# Part II — Batch 2 acceptance (Features 0–4)

Each feature has **one machine assertion that fails loudly when unmet** (encoded in `test/features.test.mjs`, run by `verify.sh`), plus a qualitative **rubric** an agent grades where the criterion is taste, not arithmetic. SPEC.md §18–§23 is the source. **Meta-invariant:** `git diff` on `src/domain/coaching.ts` and `lib/scoring/grade.mjs` is empty — the Evaluation write model did not change.

## F0. Responsive — mobile **and** desktop

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| F0-1 | At ≥1280px the nav is a left **sidebar** and the team view renders multi-column; at 375px the bottom nav + single column are intact (A2 still holds). | Manual on `VERIFY_URL` (phone + desktop viewport) | PENDING |
| F0-2 | The shell is **responsive, not phone-locked**: `app-nav.tsx` contains both a mobile branch and a `lg:` desktop branch, and `layout.tsx` no longer hard-locks the content shell to `max-w-md`. | `verify.sh` → `responsive` (grep structural check) | PENDING |
| F0-M | Meta: `coaching.ts` + `grade.mjs` write model unchanged. | `verify.sh` → `write-model-unchanged` (git diff empty) | PENDING |

## F1. Contextualized drills — coach prep, no telegraphing

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| F1-1 | A coach briefing carries a `situation`, `the_move`, and an `opener`. | test: *"briefing has the coaching-prep shape"* | PENDING |
| F1-2 | The prospect **`opener` never names the drilled skill** — `mentionsSkill(opener, skill) === false` (no telegraphing). | test: *"opener does not telegraph the skill"* | PENDING |
| F1-3 | The gate fails loudly: an opener that **does** name the skill is rejected by `mentionsSkill`. | test: *"rejects a telegraphing opener"* | PENDING |
| F1-4 | (Live) Tapping a weakness shows the coach prep (briefing + 1 follow-up), then the roleplay opens in character. | Manual on `VERIFY_URL` | PENDING |

**F1-Q (agent-graded rubric — the prep reads as real coaching).** Grade the generated briefing + opener PASS only if **all** hold: (a) the briefing speaks like a sales leader debriefing a specific call (references what happened), not a metric readout; (b) it names exactly **one** move to make; (c) the prospect opener is a natural greeting + a little context that **creates a situation** where the skill matters; (d) the opener does **not** name the skill or the rubric. Any miss → FAIL with the reason.

## F2. Live call ingestion — seeded files + paste/upload, persisted & owned

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| F2-1 | Every seeded example transcript parses to **≥8 segments**, each with a numeric `ts` and a speaker. | test: *"seeded examples parse to grounded segments"* | PENDING |
| F2-2 | The `CallStore` round-trips: `save → list → get` returns the saved call. | test: *"call store round-trips a saved call"* | PENDING |
| F2-3 | The gate fails loudly on ownership: user A's `list`/`get` **never** returns user B's call. | test: *"call store enforces per-user ownership"* | PENDING |
| F2-4 | (Live) Pasting/uploading a transcript yields a scored call that appears in the call list and is drillable. | Manual on `VERIFY_URL` | PENDING |

## F3. Auth-ready Session + home menu

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| F3-1 | `SeededSessionGateway.current()` returns a well-formed `Session` (non-empty `userId` **and** `teamId`). | test: *"seeded session is well-formed"* | PENDING |
| F3-2 | The demo fallback holds: with `AUTH0_*` unset, `authMode()` is `"seeded"` (a missing tenant can't break the demo). | test: *"auth falls back to seeded when unconfigured"* | PENDING |
| F3-3 | (Live) `/` shows the home menu with every nav destination; the app is fully usable with no login. | Manual on `VERIFY_URL` | PENDING |

## F4. TeamView organized by the rubric

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| F4-1 | `selectTeamGap(seededStats)` equals the expected highest-leverage item `max((5 − avg) × weight)` (deterministic). | test: *"team gap is the highest-leverage rubric item"* | PENDING |
| F4-2 | A `FakeTeamCoach` action's **assigned-drill target equals `selectTeamGap`** (never assigns the wrong skill), and every recommendation names a rep + a skill. | test: *"team coaching action assigns the right skill"* | PENDING |
| F4-3 | (Live) Switching call type re-derives call type → rubric → people; "assign a drill" opens that rep's contextualized drill. | Manual on `VERIFY_URL` | PENDING |

**F4-Q (agent-graded rubric — coaching, not a dashboard).** Grade the team view PASS only if: (a) the **first** thing the eye lands on is the coaching action (who needs what + an assign-a-drill CTA), above the metrics; (b) the per-rubric-item breakdown is present and in rubric order with weights; (c) drilling into a rubric item reveals per-person scores; (d) it does not read as an undifferentiated BI grid. Any miss → FAIL.

## F5. Guided tour / first-run onboarding

| ID | Assertion | How graded | Status |
|----|-----------|-----------|--------|
| F5-1 | The tour covers the loop in demo order: `score` → `cite` → `weakest` → `drill` → `rescore` appear in that relative order, and a `team` step is present; the first step is the home route. | test: *"tour steps cover the loop in demo order"* | PENDING |
| F5-2 | Every tour step is well-formed: non-empty `id`/`title`/`body`/`target`, and every `path` is one of `TOUR_ROUTES` (a typo'd route fails loudly). | test: *"every tour step is well-formed and routes to a real page"* | PENDING |
| F5-3 | (Live) First visit auto-starts the tour; Back/Next walks home → call → drill → team with the right element glowing at each stop; "Take the tour" replays it; the seeded path needs no keys/DB. | Manual on `VERIFY_URL` (375px viewport) | PENDING |

**F5-Q (agent-graded rubric — onboarding reads clearly on a phone).** Grade PASS only if: (a) the coach bubble (step x/N + caption + Back/Next/Skip) is legible and thumb-reachable at 375px; (b) the glow ring lands on the element the caption talks about (or degrades to caption-only without breaking) and does not block tapping it; (c) the captions match the loop story (score → cite → drill → re-score → team) and read like a guided tour, not raw UI labels. Any miss → FAIL.

---

## Current state (2026-06-13)

The **scoring grader and its gate are implemented and green** (sections B, C, D, E — the
product's core logic). The remaining PENDING items (A1–A4, B7, C3, D5) unlock as the app is
built and deployed: install deps (typecheck/lint), wire `/api/score` + the drill, and set
`VERIFY_URL` to the live deployment. `verify.sh` already runs all stages and exits non-zero
until they're green.
