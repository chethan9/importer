---
title: Compact mapping step header
status: done
priority: high
type: chore
tags: [ui, mapping]
created_by: agent
created_at: 2026-04-23T05:35:30Z
position: 17
---

## Notes
User feedback on `src/components/importer/MappingStep.tsx`: the top section (title "Map your data" + subtitle + Import mode card + Document ID card) is too tall and wastes space above the field bindings area. Collapse it into a single slim horizontal row so mapping work stays above the fold.

Keep all existing functionality — mode selection (Create new / Merge upsert), Document ID strategy (Auto-generate / Use column value including the column picker that appears when "Use column value" is selected). Only the visual density changes.

Target layout (single row, left-to-right):
- Small title "Map your data" (text-base or text-lg, not the current large heading) with the subtitle either removed or moved into a tooltip/muted helper to the right.
- Inline "Mode" control: compact segmented control or small toggle group (Create new | Merge) with a short label — no card wrapper, no descriptive paragraph text under each option (move descriptions into tooltips on hover).
- Inline "Doc ID" control: compact segmented control (Auto | From column) — when "From column" is active, show the column select inline next to it, not below.
- Everything sits in one row on md+ screens; wraps to two rows on narrow widths. No Card wrappers for these controls — use a single muted/bordered bar or just inline controls with separators.
- Remove the large padding/margins; total header height should be roughly one control-row tall (~48-56px) instead of the current ~280px.

Field bindings section and Document preview below stay exactly as they are.

## Checklist
- [ ] Replace the large "Map your data" heading + subtitle block with a compact inline title (small size, muted subtitle or tooltip only)
- [ ] Convert the Import mode Card into an inline segmented toggle (Create new | Merge/upsert) with descriptions moved into hover tooltips
- [ ] Convert the Document ID Card into an inline segmented toggle (Auto-generate | Use column value), with the column picker appearing inline to the right when "Use column value" is selected
- [ ] Place title, mode toggle, and doc-ID toggle on a single horizontal row on md+ screens, wrapping gracefully on mobile, with no Card wrappers and minimal vertical padding
- [ ] Verify mapping logic still works: switching mode, switching doc-ID strategy, and picking a doc-ID column all behave identically to before

## Acceptance
- The top of the mapping step occupies roughly one control row instead of the current large two-card block.
- All prior controls (mode, doc-ID strategy, doc-ID column picker) remain accessible and functional.
- Field bindings and document preview below are untouched.