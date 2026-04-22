---
title: Connect / Browse / Upload responsive redesign
status: done
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
- [x] ConnectStep: Service account vs Web SDK tabs at top level with step-connect color accent
- [x] ConnectStep: colored bubble header, local error/connecting state, animate-error-shake on errors
- [x] ConnectStep: mobile-friendly padding (px-4 sm:px-6), stacks cleanly
- [x] BrowseStep: step-browse (violet) bubble header; selected collection card uses step-browse ring + shadow
- [x] BrowseStep: responsive grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 for collection cards
- [x] UploadStep: step-upload (teal) colored drop zone bubble and border on drag-over
- [x] UploadStep: count-up animation hook for row/column count chips
- [x] UploadStep: responsive sm:flex-row layouts for card headers and action bars
- [x] All three steps use animate-fade-in-up entrance animation
- [ ] All three steps: sticky bottom action bar on mobile (hooked to Task 13's component)
- [ ] All three steps: tested at 360px / 768px / 1440px breakpoints for no overflow or clipping
- [ ] Existing logic untouched: connect still uses supabase/firebase config, browse still calls list-collections + infer-schema, upload still uses papaparse/xlsx

## Acceptance
- On mobile, each of the three steps fits 360px width with no horizontal scroll (except intentional preview table scroll), single-column layout, fixed bottom action bar.
- Tabs, cards, drop zones all use step signature colors as accents (sky/violet/teal respectively).
- Parsing a file triggers a smooth count-up animation on the row/column counts.