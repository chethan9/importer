---
title: Make-style visual mapping canvas
status: todo
priority: high
type: feature
tags: [mapping, visualization, animation, responsive]
created_by: agent
created_at: 2026-04-22T16:10:00Z
position: 15
---

## Notes
The hardest and most visual task. Depends on Task 13. Reworks MappingStep to feel like Make.com's scenario canvas while preserving 100% of existing mapping logic (tree model, source types, ref queries, presets, smart detect).

**View toggle** — new header control: `Visual` | `List` segmented button. `Visual` is default on desktop, `List` default on mobile (auto-switch on resize). User choice persists in localStorage.

**Visual view layout (desktop)**:
- Two columns (left: CSV column bubbles, right: Firestore field nodes) separated by a connector canvas (absolute-positioned SVG overlay)
- CSV column bubble: pill with column name + inferred type chip + drag handle; colored dot on the left shows type (string=gray, number=blue, date=amber, etc.)
- Firestore field node: rounded card with field name input, firestore type dropdown, source binding area
- When bound: SVG dotted curve animates from the CSV bubble right-edge to the Firestore node left-edge with dash-flow animation + a travelling particle
- Hovering a CSV bubble highlights its binding curve + downstream field (brightens)
- Hovering a Firestore node dims all other curves
- Unbound fields show a dashed drop target with "Drop a column here" hint
- Adding a binding triggers a spring animation + one-shot particle burst along the new curve

**Visual view on mobile**:
- Fallback to tap-to-connect: tap CSV pill → it becomes "source to bind" → tap a Firestore field drop zone → binding created with the same particle animation (no dragging needed)
- If user picks Visual on mobile, columns render above fields (stacked), with connector lines drawn vertically between them
- List view recommended (auto-active) below 768px

**List view**: current MappingStep UI, minor polish only (respect Task 13 spacing).

**Document preview panel**:
- Desktop: 25% right rail sticky, unchanged from recent work
- Mobile: collapsible drawer at bottom triggered by a floating "Preview" button

**New files**:
- `src/components/importer/mapping/VisualCanvas.tsx` — visual view container with SVG overlay logic
- `src/components/importer/mapping/CsvColumnBubble.tsx` — reusable pill component
- `src/components/importer/mapping/FirestoreNodeCard.tsx` — field node in visual view
- `src/components/importer/mapping/BindingConnector.tsx` — single SVG path + particle for one binding
- `src/hooks/useElementAnchor.ts` — tracks bubble/node positions for SVG coordinate calculation (resize + scroll aware)

**Keep working**:
- All mapping operations (add/remove/rename/reorder, maps, refQuery, refManual, fixed, autoIncrement, skip, now)
- Drag-drop from ColumnPalette to existing FieldTreeNode (List view)
- Presets (save/load/delete)
- Smart detect
- Preview panel rendering via `PreviewRowSwitcher`

## Checklist
- [ ] View toggle (Visual / List) with localStorage persistence and auto-switch based on viewport width
- [ ] VisualCanvas shell: two-column desktop layout with SVG overlay sized to match content
- [ ] useElementAnchor hook that returns live `{x, y, width, height}` for a ref, updated on resize + scroll
- [ ] CsvColumnBubble: pill with column name, inferred type dot, drag source, bound-count indicator
- [ ] FirestoreNodeCard: field name + type dropdown + source indicator + unbind button + binding-drop zone
- [ ] BindingConnector: SVG path (cubic bezier) from source anchor to target anchor with animated dash-flow + travelling particle dot
- [ ] Binding creation animation: spring scale-in on the new node, particle burst along new curve
- [ ] Hover highlight: hovering a CSV bubble or field node brightens its binding curves, dims others
- [ ] Mobile tap-to-connect flow: tap column → tap field → binding created (no drag)
- [ ] Mobile Visual view: stacked columns-above-fields with vertical connectors
- [ ] Automatic List-view default on screens < 768px
- [ ] Document preview: 25% right rail (lg) / floating button + bottom drawer (mobile)
- [ ] All existing List-view functionality preserved: presets, restore, smart detect, refQuery, manual drag-drop
- [ ] Tested: 5-column file mapped in Visual mode produces same importable tree as List mode (functional parity)

## Acceptance
- In Visual mode, dragging a CSV column onto a Firestore field draws an animated dotted curve with a travelling particle between them, and the binding works on import identically to List mode.
- On a 375px phone, Mapping step defaults to List view, and tapping the Visual toggle shows the stacked mobile canvas with tap-to-connect.
- All mapping features from before the redesign (presets, smart detect, refQuery, nested maps, restore) work in both views.