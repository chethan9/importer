---
title: Connect / Browse / Upload responsive redesign
status: in_progress
priority: high
type: feature
tags: [responsive, redesign, steps]
created_by: agent
created_at: 2026-04-22T16:05:00Z
position: 14
---

## Notes
Depends on Task 13 (design tokens + stepper). Reworks the first three step pages for mobile-first responsiveness and Make-style polish without changing any import logic.

**Connect step** (`src/components/importer/ConnectStep.tsx`):
- Tabbed entry: "Service account" | "Web SDK config" (Tabs component) — equal weight, no more nested collapsibles
- JSON paste textarea full-width on mobile, side-by-side with a live validation panel on lg+
- Success state: animated check bubble matching step color (sky blue) with project id chip
- Error state: red-bordered alert with shake animation (task 13 utility)
- Mobile: fields stack to single column; Continue moves to sticky bottom bar

**Browse step** (`src/components/importer/BrowseStep.tsx`):
- Collection list as responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Each collection as an elevated card with: name (font-mono), doc-count badge, sample field preview (top 3 fields as chips), "Use this" button
- Mobile: single column, tappable full card, selected state with coral ring + check
- Schema detail panel: desktop inline drawer to the right; mobile bottom-sheet (`Sheet` component side="bottom")
- Loading state: skeleton cards with shimmer

**Upload step** (`src/components/importer/UploadStep.tsx`):
- Drop zone full-width with large icon (FileSpreadsheet), teal dashed border (step-upload color) on drag-over
- Preview table: sticky header, horizontal scroll on narrow screens, row-count + column-count chips above
- Mobile: drop zone compact (shorter), preview collapses to expandable accordion showing first 5 rows
- File-parsed animation: check bubble pulses once, row/column counts count up from 0 (framer-motion number animation)
- Template download button: outline + download icon, secondary placement

Do NOT change:
- The underlying FirebaseContext state machine
- Any validation logic
- ParsedFile shape or UploadStep's onChange signature

## Checklist
- [ ] Connect: Tabs (service account / web config), validation panel, animated success/error states, mobile single-column
- [ ] Connect: project id chip + "Connected" pill with step-connect color when successful
- [ ] Browse: responsive card grid, doc-count + sample-field chips on each card, selected ring
- [ ] Browse: schema detail as inline panel (lg) / bottom sheet (mobile), skeleton loading
- [ ] Upload: elevated drop zone with step-upload color on hover/drag, compact on mobile
- [ ] Upload: row/column count-up animation after parse succeeds
- [ ] Upload: preview table sticky header, horizontal scroll, mobile accordion
- [ ] All three steps: sticky bottom action bar on mobile (hooked to Task 13's component)
- [ ] All three steps: tested at 360px / 768px / 1440px breakpoints for no overflow or clipping
- [ ] Existing logic untouched: connect still uses supabase/firebase config, browse still calls list-collections + infer-schema, upload still uses papaparse/xlsx

## Acceptance
- On mobile, each of the three steps fits 360px width with no horizontal scroll (except intentional preview table scroll), single-column layout, fixed bottom action bar.
- Tabs, cards, drop zones all use step signature colors as accents (sky/violet/teal respectively).
- Parsing a file triggers a smooth count-up animation on the row/column counts.