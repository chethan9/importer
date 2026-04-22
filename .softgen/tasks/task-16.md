---
title: Import + History animated pipeline & mobile polish
status: todo
priority: high
type: feature
tags: [import, animation, history, responsive]
created_by: agent
created_at: 2026-04-22T16:15:00Z
position: 16
---

## Notes
Depends on Tasks 13–15. Finishes the redesign on the final screens.

**Import step** (`src/components/importer/ImportStep.tsx`) — animated pipeline visualization replacing the static progress card:
- Horizontal pipeline: `[CSV file icon] ══ [Transform gear icon] ══ [Firestore icon]` with dotted animated connectors
- While running: particles flow left → right along both connectors at rate ∝ rows-per-second (faster = more particles)
- Each node pulses when active (transform pulses during coercion, Firestore pulses during batch commit)
- Rows-per-second rendered as a circular gauge (SVG) next to the Firestore node, animated needle
- Success count ticks up with count-up animation; error count badge shakes + turns red when incremented
- Progress bar below pipeline with coral fill, glow pulse at the leading edge
- Batch indicator: "Batch 3 / 12" as a chip on the transform node
- On pause: particles freeze mid-flight, connectors turn amber, pause icon overlays transform node
- On completion: green checkmark bubble drops in with spring; confetti burst (light, 20 particles, 1s)
- On failure: error icon appears on the failing node, red shake on the affected connector
- Error log table gets shake animation when a new error arrives (row-level)

**Mobile (< 768px)**:
- Pipeline rotates to vertical (3 nodes stacked, connectors vertical)
- Stats grid (Total / Succeeded / Failed) stays 3 cols, smaller font
- Error log collapses to an expandable card showing count + first error, tap to expand full list

**History Sheet** (`src/components/importer/HistorySheet.tsx`):
- Desktop: unchanged (right-side Sheet)
- Mobile: convert to bottom Sheet (side="bottom", h-[90vh]) for easier thumb reach
- Card layout: status pill + collection chip on top row, project + time on second, metrics row (written / failed / total), actions row
- Paused imports: amber border + pulse-ring on the paused status pill
- Resume/Retry buttons more prominent with step signature colors (emerald for Resume)

**Toast styling**:
- Already top-right (done in prior task); add slide-in-from-right spring + subtle backdrop blur
- Success toasts: emerald accent border-left
- Error toasts: coral accent border-left + shake once on mount

Do NOT change:
- Import runner logic (processBatch/processBatchAdmin)
- Pause/resume data flow
- Supabase writes or Firestore writes
- Report/CSV export logic

## Checklist
- [ ] Horizontal 3-node pipeline SVG (CSV → Transform → Firestore) with per-step colored bubbles
- [ ] Flowing-particle animation on connectors during run; particle density scales with rowsPerSec
- [ ] Node pulse animations (active state per node)
- [ ] Circular rows/sec gauge (SVG) next to Firestore node with animated needle
- [ ] Count-up animation on Success count; error count shake + red flash on increment
- [ ] Leading-edge glow pulse on progress bar
- [ ] Completion: green checkmark drop + 1s confetti burst (limit to ~20 particles, perf-safe)
- [ ] Pause state: frozen particles, amber connectors, pause overlay on transform node
- [ ] Failure state: error icon on failing node + connector shake
- [ ] Error log rows shake (error-shake utility from Task 13) when new error appears
- [ ] Mobile: pipeline vertical, error log as expandable accordion
- [ ] HistorySheet mobile: bottom sheet 90vh, card tweaks with step colors
- [ ] HistorySheet paused state: amber border + pulse-ring on status pill
- [ ] Toast polish: slide-in spring, colored left border by variant, shake-once on error
- [ ] Functional regression check: run 500-row import, pause mid-flight, resume — all works end-to-end with new UI

## Acceptance
- Running an import shows particles flowing along a 3-node pipeline with a live rows/sec gauge; completion triggers a checkmark + confetti; pausing freezes the animation.
- History sheet on mobile (375px) slides up from the bottom and each card's Resume/Retry buttons are thumb-reachable.
- No import logic regressions: pause, resume, retry-failed-rows, revert all still work.