# CoachLoop

AI sales-call coaching loop. Paste a call transcript, get back specific, actionable coaching.

> 🛠️ **Built during [Claude Build Day](https://cerebralvalley.ai/e/claude-startups-build-day)** (Anthropic + Cerebral Valley) — San Francisco, 2026-06-13. Open source under MIT. Everything in this repo was built at the event.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Anthropic SDK** — Claude **Opus 4.8** (`claude-opus-4-8`)
- **Tailwind CSS**

## Quickstart

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm run dev            # http://localhost:3000
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Configuration

All declared variables live in [`src/config.ts`](src/config.ts) — hackathon metadata, the
target model (`MODEL`), and the `ANTHROPIC_API_KEY` accessor. The only required secret is
`ANTHROPIC_API_KEY` (see `.env.example`).

## License

[MIT](LICENSE) © Seb Vargas
