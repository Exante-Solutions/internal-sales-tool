# CoachLoop — Product Spec

> AI sales-call coaching loop. **Score → drill the gap → re-score.** Built solo in one day for **Claude Build Day** (Anthropic + Cerebral Valley), San Francisco, 2026-06-13. Open source (MIT). Mobile-first web app, deployed to a live URL.

This spec is the source of truth for the build. It is written to be **verifiable by the model without a human** (see [§13 Verification](#13-verification--acceptance)) so the orchestration is repeatable.

---

## 1. The problem & why it matters

Sales teams improve through coaching, but coaching is the bottleneck: it needs a senior leader, 1:1 time, and a delayed feedback loop (call happens Monday, feedback lands Thursday, if ever). That ceiling means you scale performance by hiring *more* people and *more* managers.

CoachLoop removes the human from the inner loop. Reps coach and onboard **themselves**, on demand:

1. **Score** — every call is auto-evaluated against the team's rubric, and *every score cites a timestamped moment* in the transcript, so the feedback is evidence-bound, not vibes.
2. **Drill the gap** — the rep's single highest-leverage weakness is identified, and they drop into a **live voice drill** where an AI prospect re-creates that exact fumbled moment so they practice *just that skill*.
3. **Re-score** — the drill is scored on the same skill rubric, and the **gain is visible on screen** (before → after, and the points it adds to the call score).

**The value:** run a larger, higher-performing sales team with fewer people. Productivity (fewer FTEs and managers needed), higher win rates (reps actually improve the skill that loses deals), and a compressed onboarding cycle (new reps ramp by drilling, not by waiting for 1:1s).

**The wedge / what's novel:** the closed loop is the hero. It is **explicitly NOT a dashboard** — the analytics exist only to make progress visible and motivate the loop. The agentic piece is *training on demand*: the rep, not a manager, drives the rep's improvement.

---

## 2. Users

- **Rep (primary)** — runs calls, gets scored, drills weaknesses, watches their skill scores climb over time. Primary surface is **mobile** (drilling on the phone between meetings is the use case).
- **Sales leader / manager** — sees the team's performance across rubrics per call type, spots the team-wide weak skill, and *doesn't* spend the time doing 1:1 call reviews.
- **Self-serve operator (roadmap)** — signs up, brings their own keys + their own recorder + their own rubrics, runs it on their own account. The demo is shaped to make this future obvious without building it.

---

## 3. The hero loop (detailed)

```
Circleback transcript ──▶  ┌──────────────┐
(seeded for demo)          │  1. SCORE     │  Opus 4.8: classify call type, run the
                           │  (4 passes)   │  4-pass eval, cite a timestamp per item
                           └──────┬───────┘
                                  │ weighted /100 + per-item 1-5 + cited moments
                                  ▼
                           ┌──────────────┐
                           │ 2. PICK GAP   │  highest-leverage item =
                           │               │  max( (5 - score) × weight )
                           └──────┬───────┘
                                  │ the one coaching theme + the fumbled moment (quote+timestamp)
                                  ▼
                           ┌──────────────┐
                           │ 3. DRILL      │  ElevenLabs Agent (Claude brain, realtime voice):
                           │  (live voice) │  AI prospect re-stages the exact moment;
                           │               │  ends when the rep recovers or after N turns
                           └──────┬───────┘
                                  │ drill transcript
                                  ▼
                           ┌──────────────┐
                           │ 4. RE-SCORE   │  Opus 4.8: score the drill on the SAME item's
                           │               │  1-5 anchors → before→after delta on screen
                           └──────────────┘
```

**The on-screen "gain":** original item score (e.g. 2/5) → drill score (e.g. 4/5), plus the points it would add to the call's /100 (`Δ = (after − before) × weight ÷ 5`). This is the credibility moment of the demo.

---

## 4. Scope (one day, solo)

**MUST (the 5pm demo, mobile-first):**

- Ingest a Circleback-format transcript (seeded files for demo) → atomic **Evaluation** with weighted /100, per-item 1-5 scores, and a **timestamped citation on every item**.
- Call-type-aware scoring for **Discovery + Demo** (full scorecards).
- Highest-leverage gap selection + the "one coaching theme."
- **Live voice drill** (realtime, Claude brain, ElevenLabs voice) that re-stages the fumbled moment, on mobile. 
- **Re-score** the drill → before→after delta visible on screen.
- **Per-rep progress over time** across rubric items (seeded history so it looks real).
- **Team view** — team performance across rubrics, per call type.
- Editable **playbook + rubric** (opinionated default, user can edit).

**SHOULD:**

- Proposal + Close scorecards (researched & built — see §11) available in the playbook even if the demo hero focuses on Discovery + Demo.
- Library tags (one positive + one instructive moment per eval).
- MEDDIC-lite qualification read per eval.

**NICE-TO-HAVE / explicitly deferred (see §15):**

- Real Auth0 login (demo uses a seeded team, no login).
- BYOK (demo runs on app-owner keys).
- Circleback live webhook ingestion (demo uses seeded transcripts + paste/upload of raw transcript text).
- Audio/video upload → transcription.
- Multiple selectable methodology frameworks.

---

## 5. Product surfaces (mobile-first)

All screens are designed phone-first; the team view is the one that also reads well on a laptop for the manager.

1. **Rep home** — pick rep (seeded switcher, no login), see recent calls + the headline "drill your weakest skill" CTA.
2. **Call evaluation** — headline score + band + honest process-vs-deal interpretation; the filled scorecard with **tap-to-jump timestamped rationale per item**; what-went-well / what-needs-work; the one coaching theme.
3. **Drill** — a single tap requests mic + starts the realtime voice session; an ElevenLabs **`LiveWaveform`** visualizes the rep's mic in real time (plus an agent-state orb for when the prospect is speaking/thinking); live transcript; the AI prospect re-stages the moment; "end drill" or auto-end on recovery.
4. **Re-score / result** — before→after on the drilled skill, points added to the call, and the new cited moments from the drill.
5. **Rep progress** — line/area of each rubric item's score over time; the loop's whole point made visible.
6. **Team view** — for each call type, the team's average per rubric item + who's strongest/weakest per skill; surfaces the team-wide gap to drill.
7. **Playbook editor** — edit the opinionated default playbook (persona/ICP/methodology context) and the per-call-type rubric (items, weights, anchors). Weights validate to sum 100.

---

## 6. Architecture

```
            ┌────────────────────── Vercel (Next.js App Router) ──────────────────────┐
 mobile     │  React Server Components + Client components (mobile-first, Tailwind)    │
 browser ───┼─▶  /api/score        Opus 4.8  — 4-pass eval + cited timestamps          │
            │   /api/rescore       Opus 4.8  — score drill transcript on one item      │
            │   /api/drill/token   mints ElevenLabs signed URL (agent_id + xi-api-key)  │
            │   /api/ingest        normalize Circleback transcript → Call/Transcript    │
            │   /api/playbook      CRUD rubric + playbook                               │
            └───────┬───────────────────────────┬───────────────────────────┬──────────┘
                    │                            │                           │
              Neon Postgres            Anthropic API (Opus 4.8)      ElevenLabs Agents
            (teams, reps, calls,      scoring / coaching /          (Claude Haiku/Sonnet
             evals, scores, drills,    re-score                      brain, realtime WebRTC
             rubrics, playbooks)                                     voice via @elevenlabs/react)
```

**Stack**

- **Next.js (App Router) + TypeScript** on **Vercel** — fastest path to a live mobile URL with API routes in one repo. Deploy target is the **Vercel-assigned production URL** (e.g. `coachloop.vercel.app`), which is what `VERIFY_URL` points at; a custom domain is an owner-side swap, out of scope for the build/agent.
- **Neon Postgres** (serverless, Vercel-friendly) via a typed query layer (Drizzle or `postgres`/`kysely` — pick the lightest that ships fastest). Schema in §8.
- **Anthropic Opus 4.8** (`claude-opus-4-8`) — all heavy reasoning: classification, the 4-pass eval, coaching synthesis, re-score. This is the creative-Opus-use story.
- **ElevenLabs Agents** — realtime voice drill. **Claude is the brain via ElevenLabs' native LLM dropdown** (`claude-haiku-4-5` for latency / `claude-sonnet-4-5` for sharper roleplay) — no custom shim. Front-end `@elevenlabs/react` (WebRTC). A single Next.js route mints the signed URL with the server-held `xi-api-key`.
- **Tailwind CSS + shadcn/ui** — the component layer. shadcn/ui (Radix primitives + Tailwind, copy-in components, zero runtime dependency) gives a lightweight, well-established, elegant modern look out of the box, so we compose pre-built primitives (Button, Card, Sheet, Tabs, Drawer, Dialog, Progress, Badge) rather than hand-authoring class soup. Initialized via `npx shadcn@latest init`; components land in `src/components/ui/`. **Design is mobile-first** (thumb-reachable actions, bottom sheets/drawers for the drill, single-column cards) and reflows cleanly to desktop for the manager's team view. Icons via `lucide-react`.
- **ElevenLabs UI** (`ui.elevenlabs.io`) — purpose-built voice components for the drill's visual representation, distributed as a **shadcn registry** (same CLI, same `@/lib/utils`, drops into `src/components/ui/` — no new toolchain). Add per-component, e.g. `npx shadcn@latest add https://ui.elevenlabs.io/r/live-waveform.json`. We use **`LiveWaveform`** (real-time mic-driven waveform — props `active` / `processing` / `barColor` / `height` / `mode: "scrolling"|"static"` / `onStreamReady` / `onStreamEnd`) as the speaking indicator, alongside the conversation/orb components for agent state. This makes the live voice piece *look* live without hand-building canvas audio viz.

**Keys (fork-and-run):** the only secrets needed to run the whole app are `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY` (plus `ELEVENLABS_AGENT_ID` and `DATABASE_URL`). Anyone can fork the repo, drop these into `.env`, and run the full loop on their own accounts — see §17. Keys are server-side only; the ElevenLabs LLM cost (Claude drill turns) passes through ElevenLabs credits. Per-user in-app key entry (BYOK without editing `.env`) is roadmap (§15).

---

## 7. Voice drill spec

**Why ElevenLabs Agents + native Claude (not DIY, not custom-LLM):** research showed ElevenLabs now offers Claude as a first-class LLM pick. The managed Agent pipeline (STT → LLM → TTS over WebRTC) feels conversational out of the box and is *lower* effort than DIY turn-based, while Claude stays the brain. Custom-LLM (OpenAI-shim → Anthropic) is unnecessary for the demo.

**Prospect seeding.** When a drill starts, the ElevenLabs agent's system prompt (set per-session via overrides / dynamic variables) is built server-side from:

- the **fumbled moment** (the quoted rep line + the prospect line + timestamp from the original transcript),
- the **skill being drilled** (the rubric item + its 1/5 and 5/5 anchors),
- the **playbook persona/ICP** (so the prospect behaves like the real buyer type),
- a behavior instruction: *re-stage this exact objection/moment; stay in character as the buyer; if the rep handles it to the 5/5 anchor, warm up and move toward agreement (this signals recovery); if they fumble, press the objection again.*

**End conditions.** (a) Recovery — the prospect concedes/agrees once the rep hits the skill bar; (b) cap of N turns (default 6) so a struggling rep isn't stuck; (c) manual "end drill." On end, the conversation transcript is pulled and sent to `/api/rescore`.

**Re-score.** Opus 4.8 scores the rep's drill performance on the **single drilled item's** 1-5 anchors, returns the new score + 1-2 cited drill moments + a one-line "what changed." UI shows before→after and points added to the call score.

**Visual representation.** The conversation is rendered with **ElevenLabs UI** components (shadcn registry — see §6): `LiveWaveform` bound to the active mic stream (`onStreamReady` from the session) for the rep's speaking indicator, an agent orb/visualizer for the prospect's turn, and a running transcript. The waveform's `active`/`processing` props track session state so the UI reads as genuinely live during the demo.

**iOS/mobile constraints (must handle):** request mic via `getUserMedia` inside the same user gesture that starts the session; pin `@elevenlabs/react ≥ 1.6` (earlier versions swallowed an iOS Safari WebRTC error); keep the agent `first_message` empty or trigger first audio off the tap (iOS can mute an autoplayed first message). Show a clear "we need your mic, here's why" state before the tap.

---

## 8. Data model (Neon Postgres)

Faithful to the skill's discipline: the **Evaluation is atomic** (references only its own call, never compares across calls). All cross-call aggregation (progress, team view) is a **separate read layer** computed from many atomic evals.

```
team            (id, name)
rep             (id, team_id, name, avatar)
playbook        (id, team_id, name, persona_md, methodology_md, is_default)        -- editable context
rubric          (id, playbook_id, call_type, version, talk_ratio_target, ...)      -- one per call type
rubric_item     (id, rubric_id, idx, name, weight, anchor_low, anchor_high, notes) -- 9 rows; weights sum 100
call            (id, rep_id, call_type, prospect, contact, contact_role, call_date, source)
transcript_seg  (id, call_id, idx, speaker, text, ts_seconds)                      -- Circleback shape
evaluation      (id, call_id, rubric_id, score_100, band, headline_md,
                 deal_vs_process_note, created_at)                                 -- atomic write model
item_score      (id, evaluation_id, rubric_item_id, score_1_5, rationale_md,
                 cite_ts_seconds, cite_quote)                                      -- one per rubric item
meddic_status   (id, evaluation_id, pillar, status, evidence_md)                   -- enum status incl. 'skip'
library_tag     (id, evaluation_id, kind('positive'|'instructive'), ts_seconds, note)
drill_session   (id, evaluation_id, rubric_item_id, started_at, ended_at, end_reason)
drill_score     (id, drill_session_id, score_1_5, rationale_md, cite_quote,
                 before_1_5, delta_points_100)                                     -- the visible gain
```

**Derived (no table, computed):** rep progress = time series of `item_score.score_1_5` (and drill_score) per rubric item; team view = aggregates of `item_score` grouped by `call_type` + `rubric_item`.

---

## 9. Scoring engine — the four passes

Faithful reproduction of the `exante-sales-call-eval` skill, automated with Opus 4.8.

1. **Observe** — produce a flat list of `[HH:MM] observation` timestamped observations (high-signal buyer statements, rep moments good and bad). ~15–30 on a 30-min call. No scoring yet.
2. **Score** — for the classified call type, score each rubric item **1–5**, and **every item must cite a specific timestamp + one-sentence rationale** drawn from pass 1. `score_100 = Σ(item_score × weight) ÷ 5`. Bands: **80+** strong, **60–79** needs work, **<60** redo prior stage.
3. **Synthesize** — fill the eval template: headline (with the honest **process-quality-not-deal-quality** interpretation), filled scorecard, what-went-well (4–6 timestamped), what-needs-work (4–6 timestamped, each naming the better move), the **one coaching theme** (one highest-leverage change with a quoted script), MEDDIC-lite status, next-call pre-brief, library tags.
4. **Quality check** — every item has a timestamp; weights used correctly; headline distinguishes hot-deal-weak-process from cold-deal-weak-process; exactly one coaching theme.

**Call-type classification.** Infer from transcript signals if not supplied; if genuinely ambiguous, default to the dominant motion (hybrids score as the dominant type). For the demo, seeded calls carry their type.

**Gap selection (drill target).** `leverage(item) = (5 − item_score) × weight`. The max-leverage item is the drill target and the "one coaching theme" — i.e. fixing the low score that matters most to the /100. The fumbled moment passed to the drill = that item's cited timestamp + quote.

**Citation grounding (anti-hallucination).** Opus must return, per item, a `cite_ts_seconds` that exists in the transcript and a `cite_quote` that is a substring (or near-substring) of a real segment. The scorer validates citations against `transcript_seg`; on a miss, it re-prompts for a real anchor rather than accepting an invented one. This is enforced in the eval harness (§13).

---

## 10. Rubrics — Discovery & Demo (canonical, verbatim)

Stored machine-readable as `rubric` + `rubric_item` rows and exported as `repo/scoring-rubric.json`. Scoring: each item 1–5 × weight, summed, ÷ 5 = /100. Weights sum to 100.

### 10.1 Discovery scorecard

Talk-to-listen target 43:57 (rep:prospect). Question target 11+, well spread.


| #   | Criterion                            | Weight | 5/5                                                               | 1/5                                          |
| --- | ------------------------------------ | ------ | ----------------------------------------------------------------- | -------------------------------------------- |
| 1   | Agenda set + buy-in                  | 5      | Explicit agenda signposted, buyer confirms                        | Launched into pitch, no agenda               |
| 2   | Question depth & spread (target 11+) | 15     | 11+ targeted questions across past/present/future                 | Under 6, front/back-loaded                   |
| 3   | **Pain quantified in $ or days**     | 20     | Got a number — DSO, FTE hours, $ at risk/written off              | "Yeah, it's a problem" (qualitative only)    |
| 4   | Economic Buyer named                 | 10     | EB confirmed by name + role + approval process probed             | EB assumed/skipped/unmentioned               |
| 5   | Champion test                        | 10     | Contact volunteered stakeholders, named names, shared frustration | Single contact, no internal pull             |
| 6   | Multi-thread setup                   | 10     | Surfaced 2+ names; committee mapped                               | One contact, no committee map                |
| 7   | Talk ratio 40–46% rep                | 10     | In band, no monologue >2 min                                      | Above 60% / under 30%; or monologue >2 min   |
| 8   | Implication question landed          | 10     | SPIN Implication → buyer named a consequence number               | No future-state question, or no buyer number |
| 9   | Next step locked                     | 10     | Specific date + attendees (incl. EB) + agenda                     | "Let's reconnect next week"                  |


**Highest-signal:** item 3 (Pain quantified). **Notes:** item 8 finer scale (1 not attempted → 5 specific buyer number w/ downstream implication); item 7 — a single uninterrupted rep block >4 min scores 1 regardless of overall ratio. **Bands:** 80+ ready to advance; 60–79 backfill gaps (usually EB/criteria/quantified pain) next call; <60 — distinguish *hot deal/weak discovery* (backfill) from *cold contact/weak discovery* (re-discover or disqualify); never collapse <60 to "deal not real."

### 10.2 Demo scorecard

Talk-to-listen inverts: target 55–65% rep. Rep drives structure, invites reaction at checkpoints.


| #   | Criterion                                 | Weight | 5/5                                                 | 1/5                                        |
| --- | ----------------------------------------- | ------ | --------------------------------------------------- | ------------------------------------------ |
| 1   | **Anchored to prior discovery**           | 20     | Referenced buyer's exact words/data, quoted back    | Generic demo, no anchors                   |
| 2   | Tell-Show-Tell structure                  | 15     | Context → Capability → Impact arc each capability   | Feature dump, no structure                 |
| 3   | Customized data (logo, realistic numbers) | 10     | Prospect's logo + realistic numbers                 | Generic Acme Corp data                     |
| 4   | Interactive checkpoints (every 5–7 min)   | 10     | "Is this how it happens today?" cadence             | Monologue, no check-ins                    |
| 5   | ROI moment tied to buyer-named outcome    | 15     | Capability tied to a quantified buyer-named outcome | "And then we have this dashboard"          |
| 6   | Objection invitation (proactive)          | 10     | Proactively surfaced 1+ objection                   | Reactive only                              |
| 7   | Pricing timing (40–49 min, 3–4 mentions)  | 5      | Discussed 40–49 min in, 3–4 mentions                | Avoided entirely or front-loaded           |
| 8   | Talk ratio 55–65% rep                     | 5      | In band, no monologue >2 min                        | Above 80% / under 40%; or monologue >4 min |
| 9   | Firm future commit                        | 10     | Next step with EB or champion+sponsor on calendar   | "I'll send the deck over"                  |


**Highest-signal:** item 1 (Anchored to discovery) — caps at 2/5 if no specific buyer statement is referenced. **Notes:** item 5 caps at 3/5 if outcome is assumed not buyer-stated; item 7 calibrated to Gong 519k dataset. **Bands:** 80+ proposal-ready; 60–79 second demo/working session; <60 — re-discover, not re-demo.

### 10.3 Proposal & Close

Built from research (established sales methodology + Gong/MEDDIC/negotiation benchmarks), MECE, demo-practical — see §11. Available in the playbook; the demo hero focuses on Discovery + Demo.

---

## 11. Rubrics — Proposal & Close (researched)

Built from operator-grade benchmarks (Gong Labs call corpora, MEDDPICC canon, negotiation research — sources in `docs/rubric-sources.md`), calibrated for the same mid-market finance buyer. **MECE against Discovery/Demo and against each other:** Proposal owns *constructing and landing* the value/commercial case and getting the group to commit to a path; Close owns *executing* that path through negotiation, paper, and signature. MEDDIC's **Paper Process** and **Competition** become first-class here (no longer `skip`).

### 11.1 Proposal scorecard

Purpose: present pricing/terms/quantified ROI to the buying group, align on a written mutual path, earn a concrete next commitment.


| #   | Criterion                                           | Weight | 5/5                                                                                                                    | 1/5                                                                     |
| --- | --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | **Quantified business case (the "R" in ROI)**       | 20     | Finance-grade model: current-state cost, expected gain, AND net return, tied to buyer's own metrics; hard dollars lead | No quantified return; vague "value"/"time savings", no math             |
| 2   | Pricing presented clearly, early, with confidence   | 14     | Price stated plainly once value framed; structure explained; list anchor held                                          | Buried/apologized for, email-only, or discount volunteered preemptively |
| 3   | Mutual Action Plan co-built + buyer-validated       | 14     | Dated jointly-owned MAP (6–15 steps) through signature + kickoff, owners per step, buyer edits/commits live            | No plan, or one-sided "close plan" buyer never touches                  |
| 4   | Decision process & criteria confirmed vs the plan   | 11     | Confirmed steps, approvers, criteria; proposal maps to them                                                            | Process assumed; can't name who decides or in what order                |
| 5   | Economic Buyer engaged or credible path to them     | 11     | EB in room, or champion armed with the ROI model + named EB meeting set                                                | No EB, no path; reliance on one low-authority contact                   |
| 6   | Proof / risk-reversal matched to finance objections | 9      | Proactive proof (references, security posture, SLAs, pilot/phased terms) tied to the concern                           | Risk ignored; objections met with assertion not evidence                |
| 7   | Multi-threading / buying-group breadth              | 8      | 3+ stakeholders across functions; value tailored per persona                                                           | Single-threaded, no plan to widen                                       |
| 8   | Competition & status-quo positioned                 | 7      | Knows alternatives incl. "do nothing"; differentiates on buyer criteria; quantifies cost of inaction                   | "No competition"; generic feature-bragging                              |
| 9   | Concrete, dated next step secured                   | 6      | Specific dated next step + named attendees set live (ideally next MAP gate)                                            | Vague "reconnect soon"; left to email                                   |


**Highest-signal:** item 1 — caps at **2/5** if no quantified *return* appears (cost-only or value-story-without-math is the dominant failure). **Notes:** item 3 (the written artifact) vs item 9 (one immediate calendar commitment) are not double-counted; item 2 — preemptive unsolicited discounting caps at 3/5. **Bands:** 80+ advance to Close; 60–79 a commercial lever is soft (EB path / one-sided MAP / unaddressed risk), don't forecast committed; <60 re-do Demo (value not quantified/believed or single-threaded).

### 11.2 Close scorecard

Purpose: convert a verbal/economic yes into a signed contract — execute the paper path, negotiate disciplined give-gets, protect timeline.


| #   | Criterion                                              | Weight | 5/5                                                                                                                                                | 1/5                                                                        |
| --- | ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | **Paper process mapped & running in parallel**         | 20     | Legal/redlines, security, procurement, signature routing each have owner + date and are in motion *alongside* the yes; surprise approvers surfaced | "Verbal yes = done"; no map; steps surface as week-5 surprises             |
| 2   | Disciplined give-get negotiation                       | 16     | Every concession conditional + traded for a reciprocal get; list anchor protected                                                                  | Unsolicited discounts; gives with no asks; tapering that reveals the floor |
| 3   | Economic Buyer sign-off & authority confirmed          | 14     | EB has authority + intent to sign, knows the amount; above-threshold/board approval dated                                                          | Closing with a non-signer; authority/threshold unverified                  |
| 4   | Mutual close plan advancing on schedule                | 12     | MAP live, gates completing on/ahead of date; slippage <3 weeks                                                                                     | Plan stale; close date pushed 3+ weeks / next quarter                      |
| 5   | Multi-threading sustained (no single point of failure) | 11     | 3+ engaged contacts incl. an exec active late; deal survives champion loss                                                                         | Single-threaded at the finish; champion alone                              |
| 6   | Engagement & next-step velocity healthy                | 9      | Concrete dated next steps every interaction; responsive cadence                                                                                    | Going dark; >50% of late exchanges are rescheduling; ghosting              |
| 7   | Competitive & status-quo threat neutralized late       | 8      | No late competitor surprise, or known with a criteria-based answer; "do nothing" closed off                                                        | Late competitor unresolved; buyer drifting to status quo                   |
| 8   | Mutual value reconfirmed + cost-of-inaction live       | 6      | Ties close back to quantified ROI + consequence of delay; urgency buyer-owned                                                                      | Pure price haggling; manufactured/fake deadline                            |
| 9   | Signature mechanics & kickoff locked                   | 4      | Exact signer, routing, vehicle, date + kickoff scheduled live                                                                                      | "Send it over"; no kickoff scheduled                                       |


**Highest-signal:** item 1 — the discriminator is *timing not awareness*: can list steps but only starts them after the yes = 3 max; missing the security/legal track caps at 2. (~70% of slipped deals slip on un-planned paper; legal-late correlates 2.6× win.) **Notes:** item 2 — any unsolicited discount or floor-revealing taper caps at 3; item 6 — >half late exchanges about scheduling caps at 2 (strongest dwindling-interest signal). **Bands:** 80+ forecast committed, on-time signature; 60–79 likely-win but timeline-at-risk (paper late / soft EB / concession leakage); <60 re-do Proposal (commit was never real).

> Full source list with hard-benchmark vs directional flags lives in `docs/rubric-sources.md` (to be committed alongside the rubric).

---

## 12. Progress & team analytics (the separate read layer)

Per the skill's discipline, atomic evals never compare across calls; this layer does, computed from many evals.

- **Rep progress** — per rubric item, a time series of `item_score` across that rep's calls (plus drill_score points), so improvement on the drilled skills is visible. This is the motivation engine ("watch your weak skill climb").
- **Team view** — for each call type, team average per rubric item + per-rep min/max, surfacing the team-wide weakest skill (the thing a manager would coach, now self-served).
- Both are **read-only views over the write model** — not the product's hero, deliberately. CoachLoop is the loop, not the dashboard.

---

## 13. Verification & acceptance

Designed so **the model can verify "done" without a human** (hackathon orchestration criterion).

- **Responding URL** — deployed Vercel URL returns 200; the hero loop is reachable on a mobile viewport.
- **Type + build gate** — `npm run typecheck` and `npm run build` pass (CI-style check).
- **Scoring eval harness** — `scripts/eval.ts` runs the scorer over **golden seeded transcripts** with expected outcomes encoded in `evals/golden.json`:
  - call type classified correctly,
  - `score_100` within an expected band,
  - **every item_score carries a `cite_ts_seconds` that exists in the transcript** and a `cite_quote` that matches a real segment (citation-grounding assertion — the anti-hallucination gate),
  - the selected gap = the expected max-leverage item.
- **Rubric file the model grades against** — `RUBRIC.md` (this spec's §10–11 + acceptance list) is the gradeable artifact; another run can re-derive "done."
- **Loop smoke test** — a scripted run: seeded transcript → score → gap → (mock drill transcript) → re-score produces a positive `delta_points_100`.

Acceptance = all of the above green + a manual mobile walk of the live loop.

---

## 14. Build order (one day, time-boxed)

1. **DB + seed** — Neon schema, seed one team + ~4 reps, Discovery+Demo rubrics, and several scored-looking historical calls (so progress/team views are populated). *Foundation.*
2. **Scoring engine + harness** — `/api/score` (4 passes, Opus 4.8), citation grounding, golden eval harness green. *De-risks the core.*
3. **Eval UI (mobile)** — call list → evaluation screen with tap-to-timestamp.
4. **Drill** — ElevenLabs agent + signed-URL route + `@elevenlabs/react`, prospect seeding, iOS mic handling.
5. **Re-score + delta UI** — close the loop visibly.
6. **Progress + team views** — read layer over seeded + live data.
7. **Playbook/rubric editor** — editable default.
8. **Polish + deploy + canary** — mobile polish, deploy, smoke the live loop.

Each step is independently demoable; if time runs short, the loop (1→5) is protected and 6–7 degrade to seeded screens.

---

## 15. Non-goals / deferred

- Real Auth0 login (demo: seeded team, no login).
- BYOK keys (demo: app-owner keys; BYOK + per-user encrypted key storage is roadmap).
- Live Circleback webhook ingestion + HMAC verification (demo: seeded transcript files + paste/upload of raw transcript text; webhook route is stubbed/roadmap).
- Audio/video upload → transcription.
- Multiple selectable methodology frameworks (one opinionated, editable default only).
- CSM/QBR call type (out of scope, not a sales call).
- Cross-call comparison *inside* an atomic eval (deliberate — that lives only in the analytics layer).

---

## 16. Risks & mitigations


| Risk                                     | Mitigation                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| iOS Safari mic/autoplay blocks the drill | Request mic in the start gesture; `@elevenlabs/react ≥ 1.6`; empty `first_message`; explicit pre-tap mic prompt. |
| Voice latency undercuts "live"           | Drill brain on Claude Haiku 4.5 via ElevenLabs; managed WebRTC pipeline; Opus reserved for non-realtime scoring. |
| Hallucinated timestamps/citations        | Citation-grounding validation against `transcript_seg` + re-prompt; asserted in the eval harness.                |
| Scoring variance run-to-run              | Low temperature for scoring; golden bands (ranges, not exact) in the harness; deterministic gap-selection math.  |
| Scope creep vs one day                   | Build order protects the loop (1→5); 6–7 degrade gracefully to seeded views.                                     |
| ElevenLabs/Anthropic cost during judging | App-owner keys, capped; Haiku for drill turns; ElevenLabs 95% silence discount.                                  |


---

## 17. Environment variables

**Fork-and-run contract:** clone, `cp .env.example .env`, fill these four, `npm install && npm run dev` — the entire loop runs on your own Anthropic + ElevenLabs accounts. No other config required. All keys are server-side only and never shipped to the client.

| Var                   | Required | Purpose                                                                                  |
| --------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | yes      | Opus 4.8 scoring/coaching/re-score (server-only). Runs on the forker's own account.      |
| `ELEVENLABS_API_KEY`  | yes      | Mints signed URLs for the realtime voice drill (server-only). Runs on the forker's own account. |
| `ELEVENLABS_AGENT_ID` | yes      | The configured "AI prospect" agent (Claude brain, native LLM dropdown).                  |
| `DATABASE_URL`        | yes      | Neon Postgres connection string (free tier is enough).                                   |

Declared app constants (model id, hackathon metadata) live in `src/config.ts`. The fail-fast accessor pattern (`getAnthropicApiKey()`) applies to every required var — a missing key throws a clear "copy .env.example to .env" error rather than failing deep in a request.