# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CoachLoop — an AI sales-call coaching loop. **Built during Claude Build Day** (Anthropic + Cerebral Valley), a 6-hour sprint on 2026-06-13. Open source (MIT) under personal account `sebvargo`. Per hackathon rules, everything here was built at the event and the repo is public.

## Commands

```bash
npm run dev        # dev server at http://localhost:3000
npm run build      # production build (also the CI-style correctness check)
npm run typecheck  # tsc --noEmit — run this before committing
npm run lint       # next lint
```

There is no test suite yet. The current verification gates are `npm run typecheck` and `npm run build`.

## Architecture

Next.js App Router (`src/app`). The data flow is a single loop:

`page.tsx` (client form) → `POST /api/coach` (`src/app/api/coach/route.ts`) → Anthropic Opus 4.8 → coaching text back to the page.

- **`src/config.ts`** — single source of truth for *declared variables*: `HACKATHON` metadata, `MODEL` (`claude-opus-4-8`), token defaults, and `getAnthropicApiKey()` (fail-fast env accessor). Change the model here, not inline.
- **`src/lib/anthropic.ts`** — server-only Anthropic client. Never import this from a client component (`"use client"`); it reads the API key from the server env.
- **`src/app/api/coach/route.ts`** — the coaching endpoint. Validates input with Zod, runs on the Node runtime (`runtime = "nodejs"`), and carries the coaching system prompt.

## Conventions

- `@/*` path alias maps to `src/*` (see `tsconfig.json`).
- Secrets only via env. `.env` is gitignored; `.env.example` documents required vars. Fork-and-run requires four: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `DATABASE_URL`. Use fail-fast accessors (`getAnthropicApiKey()` pattern) — never read `process.env` deep in a handler.
- When using Claude models, default to the latest capable model — currently Opus 4.8 (`claude-opus-4-8`), already set in `src/config.ts`.
- UI: **Tailwind + local Apparatus primitives** (components in `src/components/ui/`). Compose existing primitives; don't hand-roll class soup. Design mobile-first; use `Glyph` with mono Unicode symbols for app UI instead of adding new `lucide-react` imports. See `DESIGN.md`.

## How I build (architecture, hackathon-sized)

This is my system-design style — Clean Architecture / DDD / Hexagonal — **applied in proportion to volatility, not dogmatically.** It is a 6-hour sprint, so the bar is judgment, not ceremony: reach for a pattern only when a real change is likely to hit it. The current 4-file scaffold is *correct* for its size. The notes below are how to grow it cleanly **when** a second step or collaborator appears — not a checklist to satisfy now.

### The laws (translated to this stack)

1. **Dependencies point inward, toward the domain. The domain depends on nothing.** A use case calls the SDK at runtime; in source, the SDK depends on a domain-owned interface — not the reverse.
2. **`domain/` and `application/` import no framework, no SDK.** Verifiable by grep: no `@anthropic-ai/sdk`, no `next/*`, no `zod` in those folders. If one appears, the build is conceptually wrong.
3. **Only domain-owned data crosses a boundary — never a vendor object.** An `anthropic` `Message`, a `NextRequest`: each dies at the adapter that produced it. Translate to a plain domain object *at the boundary*.
4. **Behavior lives with the data it guards** — *when there's an invariant to guard.* A coaching score that must be 0–100 belongs in a value object, not in a forgotten `if` in the route. No invariant → a plain type is fine; don't manufacture ceremony.
5. **A port is a domain-owned interface; an adapter is its infrastructure implementation.** Adding a provider = adding a file, not editing an `if (provider === ...)`.
6. **Concrete adapters are chosen in one place** — the composition root (here: the route handler, or a tiny `src/composition.ts` if wiring grows). Grep an adapter's class name → it appears only in its own file and the wiring.
7. **Everything testable offline, with fakes, in milliseconds.** If testing a use case needs a key or the network, a boundary leaked.

### Layout (grow into this; don't pre-build it)

```
src/
├── domain/            # pure TS, no SDK/framework. Types, value objects, ports (interfaces).
│   ├── coaching.ts    #   Transcript, Coaching, CoachingScore — the boundary-crossing types
│   ├── errors.ts      #   domain errors
│   └── ports.ts       #   interface CoachGateway { coach(t: Transcript): Promise<Coaching> }
├── application/       # use cases. Imports domain only. No SDK, no Next, no Zod.
│   └── coach-service.ts
├── infrastructure/    # adapters. Import domain + the outside world.
│   ├── anthropic-coach-adapter.ts   # wraps @anthropic-ai/sdk behind CoachGateway
│   └── fake-coach-adapter.ts        # deterministic, no network — build this FIRST
├── lib/anthropic.ts   # server-only SDK client (already exists)
└── app/api/coach/route.ts  # controller: parse HTTP (Zod) → call service → format HTTP
```

Place a file by asking: *holds a business rule?* → `domain/`. *orchestrates a use case?* → `application/`. *talks to the SDK/HTTP/disk?* → `infrastructure/`. *chooses concretes?* → the route / composition root.

### Patterns that earn their keep here

- **Gateway = someone else's service.** The Anthropic SDK is the one genuinely volatile external dependency in this app, so it earns a port (`CoachGateway`) and an adapter. The route holds the interface and is blind to the concrete. This is the abstraction I'd actually build; the rest are optional.
- **Value object only where an invariant exists.** `CoachingScore` (0–100) → a smart constructor (`makeScore(n): CoachingScore`) that validates and returns a `readonly` branded type. A transcript string with no rule stays a `string`.
- **Service only when there's more than one step or collaborator.** Today the route → SDK is one hop; a service would be a pass-through smell. The moment coaching gains a second step (store the result, fetch a scorecard, enforce a rule), extract `CoachService` so that orchestration has one home reachable from route, CLI, and tests alike.
- **Fake adapter before the real one.** A `FakeCoachAdapter` returning a canned `Coaching` lets the whole loop run offline with no key — and is the demo's safety net if the venue WiFi dies.

### When NOT to abstract (the part that matters most at a hackathon)

- A pure helper (token estimate, string formatting) → **write the function.** No port.
- A Zod schema validating the request body → **lives in the route**, not behind an interface. Validation at the edge is the edge's job.
- Two stable variants behind a config flag → **keep the `if`.** Strategy + registry is overkill.
- The current single-call flow → **leave it.** Don't add `domain/`+`application/`+`infrastructure/` to wrap one SDK call. Graduate only when a real second reason-to-change arrives.

For each abstraction you add, name the volatility that justifies it. If you can't, delete it.

### Fitness check (run before you call it done)

```bash
# Core stays pure — expected: nothing.
grep -rn "@anthropic-ai/sdk\|from \"next" src/domain src/application 2>/dev/null
# Adapter chosen in one place — expected: its own file + the wiring only.
grep -rln "AnthropicCoachAdapter" src
```

Behavioral: swapping the real adapter for the fake changes only the wiring, never `domain/` or `application/`; the coaching use case runs in a test with the fake, offline, in milliseconds.
