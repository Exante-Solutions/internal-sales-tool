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

**Batch-2 additions (§18–§23).** Auth0 is now scaffolded (env documented; the live SDK is deferred — see §22). `DATABASE_URL` graduates from "declared" to **actually used** by the new `CallStore` (§20), behind a fallback so the app and `verify.sh` stay green when it is unset.

| Var                   | Required | Purpose                                                                                  |
| --------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `AUTH0_DOMAIN`        | no¹      | Auth0 tenant domain. Documented in `.env.example`; consumed only once the Auth0 adapter ships (§22). |
| `AUTH0_CLIENT_ID`     | no¹      | Auth0 application client id.                                                             |
| `AUTH0_CLIENT_SECRET` | no¹      | Auth0 application client secret (server-only).                                           |
| `AUTH0_SECRET`        | no¹      | Cookie/session encryption secret for the Auth0 SDK.                                      |
| `APP_BASE_URL`        | no¹      | Public base URL used for the OAuth callback (e.g. `https://coachloop.vercel.app`).       |

¹ **When unset, the app runs as the seeded team (no login).** This is the deliberate demo fallback (§22): a missing Auth0 config can never break the demo or the verification gate.

---

# Part II — Batch 2 capabilities

> Each section below is a **first-class capability**: what it does, who it's for, its non-goals, the **demo-vs-real boundary**, the **touched files/interfaces**, and an **end-to-end verification line**. All five are **additive** per CLAUDE.md: new ports at the edge or read/synthesis layers. **The core domain — `Evaluation`, `ItemScore`, `Rescore` in `src/domain/coaching.ts` and the `lib/scoring/grade.mjs` write model — does not change.** New domain types live in new files (`domain/briefing.ts`, `domain/session.ts`, `domain/store.ts`, `domain/team.ts`) so the existing write model is provably untouched (`git diff` on `coaching.ts`/`grade.mjs` is empty).

## 18. Feature 0 — Responsive (mobile **and** desktop)

**What:** the app keeps its excellent thumb-friendly phone layout *and* reflows to a navigable desktop web layout — no longer locked to `max-w-md`. On ≥`lg`, the bottom tab bar becomes a persistent left **sidebar**, the content column widens, and dense views (team, progress) use multi-column grids instead of a single scroll.

**Who:** the rep on a phone (unchanged experience) and the manager/operator on a laptop (the team view is the one that most needs the wider canvas).

**Non-goals:** no separate desktop codebase; no per-device routing; no redesign of the visual language — same components, responsive Tailwind breakpoints only.

**Demo-vs-real boundary:** fully real — pure layout. No env, no fallback. Mobile (375px) and desktop (≥1280px) are both first-class.

**Touched files/interfaces:**
- `src/app/layout.tsx` — container goes from `max-w-md` to a responsive shell (mobile column ≤`md`; sidebar + wide content ≥`lg`), bottom padding only on mobile.
- `src/components/app-nav.tsx` *(new)* — one nav component that renders as a bottom bar on mobile and a left sidebar on desktop; replaces `bottom-nav.tsx` (kept as a thin re-export or deleted).
- `src/components/team-view.tsx`, `src/components/progress-view.tsx`, `src/components/home-menu.tsx` — reflow to `lg:grid-cols-*`.

**End-to-end verification:** at 375×812 the hero loop is reachable with no horizontal scroll and tap targets ≥40px (RUBRIC A2); at ≥1280px the left sidebar is visible and the team view renders multi-column (RUBRIC F0-1, manual). Structural gate: `verify.sh` greps that `app-nav.tsx` carries both a mobile (`bottom`/`flex`) and a desktop (`lg:`) branch, and that `layout.tsx` no longer hard-locks the shell to `max-w-md` (F0-2).

## 19. Feature 1 — Contextualized drills (coach prep → roleplay)

**What:** a drill no longer dumps the rep straight into a simulation. Tapping a weakness opens a **coaching session**: a sales-leader persona (Opus 4.8) gives a short, grounded **prep** — what happened on the call, why it matters, the one move to make — then **invites the rep into the roleplay**. The rep may ask **one** follow-up question, or hit "I'm ready." The session is **contextualized to the item the rep clicked**, while the coach is **aware of the rep's other gaps on that call type** (so the prep can connect the dots) — but it stays focused on the clicked skill. When the sim starts, the **AI prospect opens like a real call** — a natural greeting and a little context — and the opening **creates a situation that surfaces the skill without naming or telegraphing it**, so the rep has to *navigate* to it. It must read as a real sales-leader coaching session, not a metric drill.

**Who:** the rep practicing a specific skill; the value is the "feels like real coaching + real call" quality that makes the practice transfer.

**Non-goals:** not a multi-turn open-ended chat (capped at briefing + 1 follow-up so the rep practices fast); the prep does **not** restate the rubric anchors verbatim or name the metric to the prospect; no change to scoring/re-scoring.

**Demo-vs-real boundary:** *real* = Opus generates the briefing, the follow-up answer, and a non-telegraphing prospect opening. *Demo/offline* = `FakeCoachBriefing` returns a deterministic, on-character briefing + canned follow-up, and the seeded scenario's opening is used — so the full coach→roleplay flow runs with no key. Both paths pass the **anti-telegraph** check.

**Touched files/interfaces:**
- `src/domain/briefing.ts` *(new)* — `CoachBriefing { skill, situation, the_move, sample_line, opener }`.
- `src/domain/ports.ts` — add `CoachBriefingGateway { brief(moment, gaps, transcript): Promise<CoachBriefing>; answer(question, briefing, transcript): Promise<string> }` (`gaps` = the rep's other weak items on this call type).
- `src/infrastructure/anthropic-coach-briefing.ts` *(new)* + `FakeCoachBriefing` (in `fake-adapters.ts`).
- `src/infrastructure/anthropic-drill-scenario.ts` — prompt enhanced: natural greeting + context, **a situation that surfaces the skill without naming it** (self-filtered against `lib/coaching/telegraph.mjs`).
- `lib/coaching/telegraph.mjs` *(new, pure)* — `mentionsSkill(text, skillName)` the single source of truth for the anti-telegraph rule; imported by the adapter and asserted by the fixture test.
- `src/application/coach-service.ts` — add `brief()`/`answer()` orchestration + `gaps()` helper (the other weak items); no write-model change.
- `src/app/api/coach/brief/route.ts` *(new)* — POST returns the briefing; with `{question}` returns the single follow-up answer.
- `src/components/coach-prep.tsx` *(new)* + `src/components/drill-client.tsx` — a `prep` stage precedes `choose`/`voice`/`text`.

**End-to-end verification:** fixture test asserts a briefing carries `situation` + `the_move` + `opener`, and that **`mentionsSkill(opener, skill) === false`** (the prospect opening never names the drilled skill) — and that a telegraphing opener is *rejected* (fails loudly). Qualitative (agent-graded rubric, §RUBRIC F1-Q): the prep reads as a real sales-leader coaching session and the opening surfaces the skill naturally. Live (manual): tapping a weakness shows the coach prep, then the roleplay opens in character.

## 20. Feature 2 — Live call ingestion (seeded files + paste/upload)

**What:** a rep can add a call by **picking a seeded example transcript** or by **pasting/uploading** raw transcript text. The transcript is normalized (`lib/ingest`), scored through the existing `/api/score` loop, and the result is **persisted as a user-owned call** so it appears in the rep's call list and is drillable like the seeded calls. Seeded examples are the **reliable on-ramp** (always present, no typing); paste/upload is the real path.

**Who:** a rep bringing a real call; an evaluator/operator wanting to try their own transcript in the demo.

**Non-goals:** no audio/video → transcription; no live Circleback webhook (still §15 roadmap); no rubric editing here.

**Demo-vs-real boundary:** *reliable on-ramp* = bundled seeded example transcripts (`src/data/examples/`), parse + score deterministically (Fake scorer offline, Opus when keyed). *Real* = paste/upload of arbitrary transcript text. **Persistence boundary:** with `DATABASE_URL` set, calls persist to **Neon** (`NeonCallStore`); unset, they persist to a process-local `MemoryCallStore` so the loop still works and `verify.sh` stays green — uploads survive within the session, and seeded calls are always present either way.

**Touched files/interfaces:**
- `src/domain/store.ts` *(new)* — `StoredCall { meta, evaluation, transcript }`.
- `src/domain/ports.ts` — add `CallStore { list(userId): Promise<StoredCall[]>; get(userId, callId): Promise<StoredCall|null>; save(userId, call): Promise<void> }`.
- `lib/ingest/parse.mjs` *(new, pure)* — the tolerant transcript parser, mirrored out of `src/lib/ingest.ts` (which now imports it) so ingestion is zero-dep testable.
- `src/infrastructure/neon-call-store.ts` *(new)* — `@neondatabase/serverless`; bootstraps its tables on first use (`CREATE TABLE IF NOT EXISTS`); rows keyed by `user_id`.
- `src/infrastructure/memory-call-store.ts` *(new)* — wraps pure `lib/store/in-memory.mjs` (ownership-scoped Map).
- `src/infrastructure/composition.ts` — `buildCallStore()` (Neon if `DATABASE_URL` else memory) + `storageMode()`.
- `src/data/examples/*.txt` *(new)* — seeded example transcripts (discovery + demo), replaceable.
- `src/app/api/calls/route.ts` *(new)* — `GET` lists the session user's calls (seeded ∪ stored); `POST` ingests {example id | raw text + meta} → score → `save`.
- `src/app/calls/new/page.tsx` + `src/components/upload-transcript.tsx` *(new)* — pick-an-example / paste / upload UI.

**End-to-end verification:** fixture test on the pure layers — each seeded example parses to ≥8 segments all carrying a numeric timestamp; the `in-memory` store round-trips `save → list → get` and **enforces ownership** (user A never sees user B's call). Live (manual, PENDING): pasting a transcript produces a scored call that shows in the call list and is drillable.

## 21. Feature 3 — Auth-ready Session + home menu

**What:** the app gets a **Session** abstraction and a **home menu**. The Session identifies the current user/team; calls and progress are scoped to that user (via the `CallStore`). A **home-menu hub** is the landing surface on arrival/login: the user chooses where to go via **destination cards for every other app section** (Score a call, Progress, Team, Playbook), with their **uploaded calls and the "drill your weakest skill" CTA surfaced inline** on the hub — instead of being dropped into one screen. (Every nav destination in the sidebar/bottom-bar is reachable from the hub.) Real **Auth0** login is **scaffolded** (env documented, Session port ready for an `Auth0SessionGateway`), with a **seeded-team fallback** so the demo never depends on a live login.

**Who:** every user (the menu); the operator story (auth-owned data) is made obvious without a live tenant.

**Non-goals (this batch):** the `@auth0/nextjs-auth0` SDK is **not** wired yet (chosen: auth-ready abstraction only); no real OAuth round-trip; no per-team RBAC.

**Demo-vs-real boundary:** *demo* = `SeededSessionGateway` returns a stable demo user/team (the seeded team), so everything works with no login — this is the protected fallback. *Real (next step)* = drop in `Auth0SessionGateway` behind the same port once `AUTH0_*` env is set; nothing else changes. The home menu is fully real now.

**Touched files/interfaces:**
- `src/domain/session.ts` *(new)* — `Session { userId, displayName, teamId, isAuthenticated }`.
- `src/domain/ports.ts` — add `SessionGateway { current(): Promise<Session> }`.
- `src/infrastructure/seeded-session.ts` *(new)* — `SeededSessionGateway` (the demo user/team). `Auth0SessionGateway` is a documented TODO stub, not built.
- `src/infrastructure/composition.ts` — `buildSession()` (+ `authMode()` mirroring `scoringMode()`); seeded unless `AUTH0_*` present.
- `.env.example` — `AUTH0_DOMAIN/CLIENT_ID/CLIENT_SECRET/SECRET` + `APP_BASE_URL`, with the fallback note.
- `src/components/home-menu.tsx` *(new)* + `src/app/page.tsx` — `/` becomes the home-menu hub (identity from Session + nav cards + the headline "drill your weakest skill" CTA; existing rep-home call list folds in).

**End-to-end verification:** fixture/structural test — `SeededSessionGateway` returns a stable, well-formed `Session` (non-empty `userId`/`teamId`); `authMode()` is `"seeded"` when `AUTH0_*` is unset (the fallback holds). Live (manual): `/` shows the home menu with every nav destination; the app is fully usable with no login.

## 22. Feature 4 — TeamView organized by the rubric

**What:** the team view is restructured around a clear hierarchy — **call type → the rubric for that call type → people**. It first answers *"how is the team doing on this call type against its rubric?"* (per-rubric-item team averages, in rubric order with weights), then lets the manager drill into *"how is each person doing on each metric?"* (per-rep scores per item). The **agentic coaching action is the hero**: an Opus-synthesized read of *who needs what* with a one-tap **"assign a drill"** that routes that rep into the contextualized drill (§19) for the team's highest-leverage gap — so the screen reads as **coaching, not a dashboard**.

**Who:** the sales leader/manager (primarily on desktop, per §18).

**Non-goals:** not a BI dashboard; no historical team trend charts (rep trends live in Progress); no real assignment notifications (the "assign" is an in-app routing affordance).

**Demo-vs-real boundary:** *real* = Opus synthesizes the coaching action from the team stats. *Demo/offline* = `FakeTeamCoach` returns a deterministic action computed from the seeded stats, so the hero renders with no key. The team-gap target is **deterministic in both paths** (`lib/team/select.mjs`), so "assign a drill" always points at the right skill.

**Touched files/interfaces:**
- `src/domain/team.ts` *(new)* — `TeamCoachingAction { callType, headline, recommendations: { repId, repName, skill, itemId, why, drillCallId? }[] }`.
- `src/domain/ports.ts` — add `TeamCoachGateway { action(callType, stats): Promise<TeamCoachingAction> }`.
- `lib/team/select.mjs` *(new, pure)* — `selectTeamGap(stats)` = `max((5 − avg) × weight)` (deterministic tie-break), the single source of truth for the team gap / assigned-drill target; imported by the view and the adapter, asserted by the test.
- `src/infrastructure/anthropic-team-coach.ts` *(new)* + `FakeTeamCoach` (in `fake-adapters.ts`).
- `src/infrastructure/composition.ts` — `buildTeamCoach()`.
- `src/app/api/team/coach/route.ts` *(new)* — returns the `TeamCoachingAction` for a call type.
- `src/components/team-view.tsx` — restructured to the call-type → rubric → people hierarchy with the coaching action as hero; "assign a drill" links to `/call/{drillCallId}/drill`.
- `src/data/seed.ts` — reuse `teamStats`; expose per-rep-per-item latest scores for the people drill-down.

**End-to-end verification:** fixture test — `selectTeamGap(seededStats)` equals the expected max-leverage item, and a `FakeTeamCoach` action's assigned-drill target **equals `selectTeamGap`** (the coaching action never assigns the wrong skill), with every recommendation naming a rep + a skill. Qualitative (agent-graded rubric, §RUBRIC F4-Q): the view leads with coaching (who needs what + assign), not a metrics grid. Live (manual): switching call type re-derives the hierarchy and the coaching action; "assign a drill" opens that rep's contextualized drill.

## 23. Batch-2 verification summary

`scripts/verify.sh` is extended to run **all** `test/*.test.mjs` (not just the scorer), so the new pure-layer assertions (anti-telegraph, ingest/parse, store ownership, team-gap selection, seeded session) gate "done" with no human. Qualitative criteria (F1-Q, F4-Q) are graded by the Stage-3 reviewer subagent against the small rubrics in `RUBRIC.md`. The existing scoring/citation gates (§13, RUBRIC B–E) are unchanged and must stay green.