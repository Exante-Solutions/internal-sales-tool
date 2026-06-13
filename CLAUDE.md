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
- Secrets only via env. `.env` is gitignored; `.env.example` documents required vars. The only required secret is `ANTHROPIC_API_KEY`.
- When using Claude models, default to the latest capable model — currently Opus 4.8 (`claude-opus-4-8`), already set in `src/config.ts`.
