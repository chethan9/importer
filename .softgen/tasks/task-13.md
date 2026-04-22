---
title: Make-style animated stepper + responsive app shell
status: in_progress
priority: urgent
type: feature
tags: [design, animation, responsive, shell]
created_by: agent
created_at: 2026-04-22T16:00:00Z
position: 13
---

## Notes
Foundation for the Make.com-inspired redesign. Everything downstream depends on this shell.

Install `framer-motion` (already likely present via shadcn — verify in package.json).

Design intent: replicate the feel of Make.com's scenario editor — colorful icon bubbles linked by dotted animated connectors, soft elevation, generous whitespace, playful but professional. Keep coral/teal brand; layer in per-step signature colors.

Per-step signature colors (HSL):
- Connect: `214 84% 56%` (sky blue)
- Browse: `266 72% 58%` (violet)
- Upload: `173 78% 32%` (existing teal)
- Map: `10 78% 54%` (existing coral)
- Import: `142 71% 45%` (emerald)

Add these to `src/styles/globals.css` as CSS vars `--step-connect`, `--step-browse`, etc., and register in `tailwind.config.ts`.

Add animation utilities in globals.css:
- `@keyframes dash-flow` — animated `stroke-dashoffset` for SVG connectors
- `@keyframes particle-travel` — dot moving along a path, for active connector
- `@keyframes pulse-ring` — concentric ring pulse around active step bubble
- `@keyframes error-shake` — horizontal shake for error rows

New stepper: horizontal row of 5 colored icon bubbles (56px diameter) connected by SVG dotted paths. Active bubble has `pulse-ring` animation. Completed bubbles filled + checkmark. Between active and next, a particle travels the path.

Mobile (< 768px):
- Stepper shrinks to compact pill row (32px bubbles, horizontally scrollable, active centered)
- AppHeader collapses: logo + title only; History/Disconnect move into a `Sheet` hamburger menu
- Sticky bottom action bar appears in all step pages (Back/Continue) with safe-area padding
- Max container padding reduces from `px-6` to `px-4`

Affected files:
- `src/styles/globals.css` (animations, step color vars)
- `tailwind.config.ts` (color registration, keyframes)
- `src/components/importer/Stepper.tsx` (full rewrite as SVG-based bubble flow)
- `src/components/importer/AppHeader.tsx` (hamburger on mobile)
- `src/pages/index.tsx` (sticky mobile action bar, mobile container)
- Possibly new `src/components/importer/MobileActionBar.tsx`

## Checklist
- [ ] Per-step color tokens (5 colors) added to globals.css + tailwind.config + documented in project.md
- [ ] Animation utilities: dash-flow, particle-travel, pulse-ring, error-shake keyframes shipped + tailwind plugins or arbitrary classes
- [ ] Stepper rewritten: SVG path between bubble nodes, colored icon per step, checkmark when done, pulse-ring on active, travelling particle between active→next
- [ ] Stepper mobile variant: horizontally scrollable pill row, active auto-centered, 32px bubbles
- [ ] AppHeader mobile: collapse History/Disconnect into a Sheet hamburger menu with same actions
- [ ] Mobile sticky bottom action bar component: primary (Continue/Start) + ghost (Back), respects env(safe-area-inset-bottom)
- [ ] Mobile action bar wired into Connect/Browse/Upload/Map/Import step pages (shown only on < 768px; desktop keeps inline buttons)
- [ ] Container widths tuned: max-w-6xl on desktop, px-4 on mobile, px-6 sm, px-8 lg
- [ ] Typography scale: h1/h2 clamp() for mobile → desktop; verify no horizontal overflow at 360px width
- [ ] Verify existing functionality: step navigation still works, connected state syncs, no layout shift when stepper animates

## Acceptance
- On a 1440px screen, the stepper shows 5 colorful bubbles connected by animated dotted SVG paths with a travelling dot on the active→next segment.
- On a 375px phone, the stepper is a horizontal scroll pill row with active centered; a fixed bottom bar shows Back + Continue with safe-area padding; the hamburger reveals History + Disconnect.
- No step loses any currently-working interactivity after the rework.