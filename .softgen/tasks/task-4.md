---
title: Flip mapping direction + fixed value & auto-increment sources
status: done
priority: high
type: feature
tags: [firebase, mapping, import, ux]
created_by: agent
created_at: 2026-04-21
position: 4
---

## Notes
Current mapping step is source-led (iterates CSV columns and asks where to send each). Rework it to be target-led (Firestore-first): each Firestore field from the collection schema is a row, and the user picks what to bind it to. This matches how devs think about imports — "fill field X with Y" — and opens the door to non-column sources like fixed values and auto-incrementing counters.

The mapping state model changes shape: instead of `{ sourceColumn, targetField, firestoreType }`, each row is `{ targetField, firestoreType, arrayElementType?, source }` where `source` is a discriminated union: `{ kind: "column", column: string } | { kind: "fixed", value: string } | { kind: "autoIncrement", start: number, step: number } | { kind: "skip" }`. The import runner (`ImportStep` + `processBatch`) must read from `source` instead of `sourceColumn`, and for `autoIncrement` compute the value per row using the absolute row index (not just in-batch). Fixed values and auto-increment values go through the same `coerceValue` pipeline as column values, so type mismatches still land in the error log.

Seeding rule: when the mapping step opens, pre-populate rows from the collection's inferred fields — if a CSV column name exactly matches a field name, bind `kind: "column"` with that column; otherwise `kind: "skip"`. Users can add fields not in the schema via an "Add field" button.

## Checklist
- [ ] Rework mapping step to be target-led: each row shows Firestore field name (editable mono input), type badge + type override, and a "Source" column with kind selector
- [ ] Source kind dropdown with 4 options: "CSV column" (default when a matching column exists), "Fixed value", "Auto-increment", "Skip"
- [ ] When source = CSV column: show dropdown of uploaded file's columns in mono font; show a small preview of the first row's value for that column
- [ ] When source = Fixed value: show a text input; same value applied to every doc; runs through the field's type coercion (e.g. fixed "true" into a boolean field → stored as boolean true)
- [ ] When source = Auto-increment: show two numeric inputs (Start, default 1; Step, default 1); shows a preview "1, 2, 3…" below the inputs; typically used with number or string fields
- [ ] When source = Skip: row is dimmed, no value written for that field
- [ ] Seeding logic: auto-bind Firestore fields to identically-named CSV columns on first load; otherwise default to Skip; inferred type carries over as the row's firestoreType
- [ ] "Add field" button to append a new Firestore field row not present in the inferred schema (user types field name + picks type + source)
- [ ] Remove field row button (trash icon) for any row
- [ ] Live validation preview: sample first 20 rows across all non-skipped mappings, showing count of type errors + first 5 specific errors in a table; works for column, fixed, and auto-increment sources
- [ ] Import runner updates: read each mapping's `source` and produce the raw value (column lookup, fixed, or `start + rowIndex * step`), then coerce through the field's type; `source.kind === "skip"` means the field is omitted from the write
- [ ] Update the mapping config stored in Supabase `imports.mappings` to the new shape so history view still renders correctly

## Acceptance
- Opening the mapping step after uploading a file shows Firestore fields on the left, each with a source selector on the right.
- A field can be bound to a CSV column, a fixed value, an auto-increment counter, or skipped — and the import writes the correct value for each kind.
- Fixed-value type mismatches (e.g. fixed "hello" into a number field) are caught in the validation preview and rejected at import time with a row in the error log.
- Auto-increment produces sequential values (1, 2, 3… by default) across all rows including across batch boundaries.