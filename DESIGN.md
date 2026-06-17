# CoachLoop Apparatus Design System

CoachLoop uses the Apparatus design system from the discovery handoff. The goal is an instrument-grade workspace: near-black surfaces, hairline structure, mono data, warm serif summaries, and restrained interaction. This app still uses Tailwind, but Tailwind should express the Apparatus tokens, not invent a second visual language.

## Foundations

- Use tokens from `src/app/globals.css`: `--void`, `--panel`, `--panel-2`, `--grid`, `--bone`, `--bone-dim`, `--signal`, `--positive`, and `--attention`.
- Do not introduce raw hex values outside the token layer.
- Radius is `var(--radius)` only. No `rounded-xl`, `rounded-2xl`, or soft SaaS pills for app surfaces.
- Borders are 1px hairlines in `--grid`. Cards may use a 2px left border for semantic accent.
- Shadows are not part of the system. Depth comes from value steps: `--void` to `--panel` to `--panel-2`.
- Motion is reactive only: hover/focus color shifts, no scale/bounce.

## Type And Voice

- Display/UI chrome: `var(--font-display)`.
- Metadata, numbers, search, counts, status readouts, and glyphs: `var(--font-mono)`.
- Summaries, hypotheses, rollups, and quotes: `var(--font-serif)`.
- Labels are lowercase or uppercase-tracked. Avoid Title Case for chrome unless the existing product copy already requires it.
- Result prose should read like a short expert brief, not marketing copy.

## Atomic Design Layer

Use the local primitives in `src/components/ui` before writing one-off classes.

```tsx
import { Button, Card, Badge, Field, Glyph, Eyebrow } from "@/components/ui";

<Button glyph="+">New initiative</Button>
<Card accent="signal">...</Card>
<Badge variant="needs_work">unassigned</Badge>
<Field placeholder="Search people..." />
<Eyebrow>active initiatives</Eyebrow>
<Glyph tone="attention">⌅</Glyph>
```

### Atoms

- `Button`: preserves `variant="primary|secondary|ghost"` and `size="sm|default|lg"`, mapped to Apparatus solid/ghost behavior.
- `Badge` and `StatusBadge`: semantic status, not decorative color.
- `Glyph`: centralized mono Unicode icon replacement.
- `Field`, `Select`, `Textarea`: use these instead of hand-rolled rounded inputs.
- `Avatar`: initials tile, not circular image chrome.
- `Progress`: tokenized determinate bar.

### Molecules

- `Card`: use `accent="signal|positive|attention|neutral"` for left-border semantics.
- `SectionHeader`, `EmptyState`, `ListRow`, `StatTile`, `Timeline`, `TimelineEntry`: use for repeated page patterns before writing new markup.

## Iconography

Use mono Unicode glyphs through `Glyph`. Do not add new `lucide-react` imports for app UI. Existing legacy lucide usage should be replaced opportunistically as pages are touched.

Recommended glyphs:

- `⌖` target/search/detail
- `⟳` processing/regenerate
- `✓` done/connected
- `◍` result/brief
- `→` forward/submit
- `←` back
- `+` add
- `⌅` inbox/import
- `◎` initiatives/focus
- `❝` conversation/transcript
- `◔` people

## What This Branch Does Not Do

This branch establishes the component system. It intentionally does not adopt the prototype page layouts, shell geometry, top bar, or rail. Those are tracked in `to-do.ind` for the next UI branch.
