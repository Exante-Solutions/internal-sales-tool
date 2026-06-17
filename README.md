# Discovery Workspace

A person-centric workspace for **outbound discovery** — the place to document and search every external conversation, separate from the CRM.

CRMs start tracking once a deal exists. Discovery happens before that: you reach many people across many companies to understand a market, persona, or workflow, and most of those never become deals. This app tracks **discovery initiatives** as a first-class thing, so outreach doesn't pollute the pipeline.

## What it does

- **Initiatives** — focused outbound/research efforts; conversations link to them many-to-many, with a prospect list of targets.
- **People (the root)** — one person, many emails, a history of company memberships; a profile that grows from calls, notes, synced emails, and calendar events.
- **Conversations** — pasted/recorded/manual; participants with a company-at-time snapshot; on-demand discovery analysis and an optional sales-coaching playbook check.
- **Integrations** — Gmail (on-demand per-contact sync), calendar webhooks, per-user Circleback secret. Auth0 for sign-in; per-user OAuth tokens in AWS Secrets Manager (KMS-encrypted).

## Architecture

Clean/Hexagonal: `domain/` (pure) ← `application/` (use cases) ← `infrastructure/` (Drizzle/Neon, adapters) → `app/` (Next.js App Router). Every external service sits behind a domain port with a fake, so the whole loop runs offline. See `CLAUDE.md` for the conventions.

## Develop

```bash
cp .env.example .env        # fill what you need; all vars are optional offline
npm install
npm run dev                 # http://localhost:3000
npm run typecheck && npm run lint && npm test
```

Offline-first: unset env → seeded session, in-memory repos, and fake gateways keep everything running with no keys or DB. For live persistence/integrations, fill `.env` (Neon `DATABASE_URL`, Auth0, Google, AWS) — see `.env.example`. Drizzle migrations live in `drizzle/`.

> Stack: Next.js 15 (App Router) · TypeScript · Drizzle + Neon Postgres · Tailwind + shadcn/ui · Auth0 · Anthropic. Originated at Claude Build Day (2026) and evolved into a permanent internal tool.
