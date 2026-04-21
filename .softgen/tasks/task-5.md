---
title: JSON-tree mapping UI with drag-and-drop CSV columns + nested field support
status: todo
priority: high
type: feature
tags: [mapping, drag-drop, ux, nested, firebase]
created_by: agent
created_at: 2026-04-21
position: 5
---

## Notes
Replace the current flat table-style mapping with a Firebase-console-inspired JSON tree on the right and a draggable CSV column palette on the left. This dramatically improves clarity (the Firestore doc shape is visible at a glance) and unlocks nested map + array support that the flat table can't express.

Inspiration:
- Right panel mirrors the Firebase console doc view: indented, mono font, disclosure arrows for maps/arrays, subtle field-name color, "+ Add field" at every level.
- Left rail mirrors the "variables" chip pattern: each CSV column is a coral-tinted pill that can be dragged onto any leaf drop zone.

Data model change:
- Replace the flat `FieldMapping[]` in `src/components/importer/MappingStep.tsx` with a recursive `FieldNode` tree:
  - `LeafNode` — `{ kind: "leaf", targetField, firestoreType, source }` (source = column | fixed | autoIncrement | skip; same 4 kinds as today)
  - `MapNode` — `{ kind: "map", targetField, children: FieldNode[] }`
  - `ArrayNode` — `{ kind: "array", targetField, elementType: "string"|"number"|"boolean"|"map", childTemplate?: FieldNode }` — for arrays of primitives the source is still column/fixed on the node; for arrays of maps, user adds child fields to the template
- Update `src/services/importService.ts` `ImportMapping` type to be the new tree node union.
- Update `src/components/importer/ImportStep.tsx` `buildDocFromRow` to walk the tree recursively and build nested objects.

Drag-and-drop:
- Use native HTML5 drag-and-drop (no extra package). Draggable CSV chips set `dataTransfer` with the column name; leaf drop zones accept and update the node's source to `{ kind: "column", column }` plus auto-detect type from samples.
- On hover-drag, leaf drop zone shows a coral dashed outline and slight lift.

Left rail — CSV column palette:
- Sticky on the left (md+), collapses to a horizontal scroll strip on mobile.
- Each chip: column name (mono), inferred type badge (from `inferTypeFromSamples`), tiny sample-value preview on hover tooltip.
- Chips remain draggable even after being used; a small green dot indicates the chip is currently bound somewhere.
- Search/filter input at the top of the palette when >10 columns.

Right panel — Firestore JSON tree:
- Root-level "+ Add field" button (primary-tinted), same as Firebase console.
- Each leaf row: disclosure indent · field-name input (mono, editable) · type select · drop zone showing either the bound chip (with × to unbind), or "Drop column / Fixed / Auto-inc / Skip" affordance · trash icon.
- Map and array nodes: expandable with rotation arrow, children nested with a left guide line; "+ Add field" inside them at the same indent as children.
- Inline "source actions" popover on each leaf drop zone for the non-drag sources (fixed value input, auto-increment start/step, skip toggle).
- Live sample preview under each bound leaf: show the first row's coerced value using `coerceValue`.

Validation & helpers:
- "Smart detect all" button remains — walks the tree and auto-detects each leaf's type from samples.
- Footer warnings: unmapped CSV columns list (chips with "add as field" click to append a root-level leaf bound to that chip), and duplicate-field-name errors per map level.
- Type validation preview panel below the tree, unchanged in behavior.

Import & revert compatibility:
- The import runner must produce the same flat output for top-level fields as before (backwards compatible with existing Supabase records).
- Nested maps write as plain JS objects; arrays write as arrays; deep paths produced by map nodes serialize as `{ category_info: { name, description } }`.
- Revert snapshots and doc-id logging are unaffected (still per document).

## Checklist
- [ ] Recursive field-node data model: leaf / map / array nodes, each with its own source configuration; update `ImportMapping` type in services and mapping state shape
- [ ] Left column palette: each CSV column as a draggable coral-tinted chip showing column name, inferred type badge, sample-value hover; search filter when >10 columns; bound indicator dot; reusable (can be dropped on multiple fields)
- [ ] Right JSON-tree panel: Firebase-console-style indented layout with disclosure arrows for maps/arrays, "+ Add field" at root and inside every map/array template, trash icon per node, mono field names
- [ ] Leaf drop zones: accept dragged CSV chips (auto-detect Firestore type from sample values on drop), show bound chip inline with × to unbind, popover for non-drag sources (Fixed value input, Auto-increment start/step, Skip), coral dashed outline on hover-drag
- [ ] Nested map support: maps expand/collapse, children indented with left guide line, "+ Add field" inside creates a child at the correct depth; import runner builds nested JS objects
- [ ] Array support: element-type selector (string / number / boolean / map); for primitive arrays the node has a single source; for arrays of maps a child template lets user add sub-fields; import runner produces proper arrays
- [ ] Smart detect all + footer warnings: unmapped-columns list with click-to-add-as-field, duplicate-field-name errors per map level, type validation preview showing first 20 rows with nested-path errors (e.g. `category_info.description` row 3 failed)
- [ ] Import runner update in ImportStep: recursive walk of the tree builds the doc object per row; existing batched write + Supabase logging + revert continue to work unchanged

## Acceptance
- User can drag a CSV column chip from the left rail onto any Firestore field on the right and see it bind with the correct auto-detected type.
- User can create a nested map field (e.g. `category_info`) with children (`name`, `description`) and the imported doc in Firestore reflects that exact nesting.
- Array fields with primitive element type and array fields with map templates both import correctly.
- Existing flows (Fixed value, Auto-increment, Skip, Smart detect types, create vs. merge, revert) continue to work after the refactor.