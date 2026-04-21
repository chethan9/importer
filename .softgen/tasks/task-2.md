---
title: File upload, field mapping & import runner with transaction logging
status: todo
priority: high
type: feature
tags: [firebase, csv, xlsx, import, supabase, validation]
created_by: agent
created_at: 2026-04-21
position: 2
---

## Notes
Steps 3-4 of the wizard. Depends on Task 1. Install `papaparse` + `xlsx`.

**Transaction logging (for revert):** Before import starts, create a row in Supabase `imports` table (status=running, collection, mode, project_id, total_rows). After each successful batch, insert rows into `imported_docs` (import_id, doc_id, pre_existing_data JSON for merge mode). On completion, update `imports` status + counts. For merge mode: fetch existing doc before write and store snapshot in `pre_existing_data` so Task 3 can restore.

Use Firestore `writeBatch` (max 500 ops/batch). On batch error, capture failing rows into error log without aborting (toggle: "stop on first error").

**Firestore field types to support (critical — don't let wrong-typed values reach Firestore):**
- `string` — any text
- `number` — integer or double; reject non-numeric strings like "abc"
- `boolean` — only accept true/false/1/0/yes/no (case-insensitive); reject anything else
- `timestamp` — ISO-8601, epoch ms, or common date formats → Firestore Timestamp
- `geopoint` — "lat,lng" string → GeoPoint (validate lat -90..90, lng -180..180)
- `reference` — doc path string like `users/abc123` → DocumentReference (validate even segment count)
- `array` — comma-separated, pipe-separated, or JSON array; each element coerced to a sub-type the user picks (array of string / number / boolean)
- `map` / object — JSON-parsed; reject invalid JSON
- `null` — empty cell or literal "null"
- `bytes` — base64 string → Uint8Array

Detection: when inferring schema from sample docs (Task 1), classify each field's type using Firestore runtime checks (`typeof`, `instanceof Timestamp`, `Array.isArray`, `GeoPoint` check, `DocumentReference` check). Expose inferred type on the mapping UI so the coercion Select defaults correctly.

Supabase tables to create:
- `imports` (id, created_at, firebase_project_id, collection_name, mode, total_rows, succeeded, failed, status, duration_ms)
- `imported_docs` (id, import_id FK, doc_id, pre_existing_data jsonb null, created_at)
- T3 RLS (public read, anon insert); index `imported_docs` on import_id.

## Checklist
- [ ] Install `papaparse` and `xlsx`; create Supabase tables `imports` + `imported_docs` with T3 RLS; create `importLogService.ts` in src/services with methods: startImport, logDocs, completeImport, listImports, getImportDocs
- [ ] Step 3a — File upload surface: shadcn Card with drag-and-drop zone + file picker (.csv/.xlsx/.xls), shows file name + size + detected row count, "Replace file" action
- [ ] Preview table using shadcn Table: first 10 rows with source headers, sticky header, horizontal scroll, row count summary
- [ ] Step 3b — Mapping UI: two-column layout; left lists source columns with a sample-value chip; right has shadcn Select for target Firestore field (from inferred schema) or "— skip —"
- [ ] Per-mapping type badge showing the field's inferred Firestore type (string/number/boolean/timestamp/geopoint/reference/array/map) rendered as a colored pill in mono font
- [ ] Per-mapping type override Select listing all supported Firestore types (string, number, boolean, timestamp, geopoint, reference, array-of-string, array-of-number, array-of-boolean, map/json, bytes, null-passthrough) so the user can correct an inferred type
- [ ] Central type-coercion module (`src/lib/firestoreCoerce.ts`) with a pure function per type that takes a raw string cell and returns `{ ok: true, value }` or `{ ok: false, error: "..." }`; covers all 10 Firestore types above with the exact acceptance rules from Notes
- [ ] Live validation in the mapping preview: sample value for each mapped column is run through the coercion function; show a green check + coerced preview if valid, red X + error message if not; count of expected invalid rows shown in a warning banner before import starts
- [ ] Doc-ID strategy: shadcn RadioGroup "Auto-generate IDs" vs "Use column as doc ID" (Select for column), plus Import Mode Tabs: "Create new" vs "Merge / upsert"
- [ ] Array element-type sub-Select: when a mapping is set to array, a second Select chooses element type (string / number / boolean / timestamp), and the array separator (comma, pipe, semicolon, or JSON mode) is configurable
- [ ] Mapping validation: "Start Import" button (accent teal) disabled until ≥1 mapping exists and no mapping has an unresolved type error on its sample; tooltip explaining why; warning badge if schema fields are unmapped
- [ ] Step 4 — Import runner: per row, run every mapped cell through the coercion module; rows with any invalid cell go to error log (not written); valid rows batched to Firestore; Progress bar (teal), animated counters for processed/succeeded/failed/skipped-invalid/remaining, current batch indicator, Cancel button; writes to Supabase log as it goes
- [ ] For merge mode: before each write, fetch existing doc and store in pre_existing_data for revert
- [ ] Completion Dialog: success/failure/skipped counts, total time, expandable error table (row index, column, value, expected type, error message), "Download error log CSV" button, "View in history" link
- [ ] Post-import actions: "Import another file", "Start over", "Go to History"

## Acceptance
- Mapping UI shows the inferred Firestore type for every target field and lets the user override it.
- Putting "hello" into a boolean-typed field surfaces a red validation error before import and that row is skipped (not written) with a clear reason in the error log.
- Arrays, timestamps, geopoints, and references all coerce from CSV cells into the correct Firestore types and land in Firestore with the right runtime type.
- Each successful doc is logged to Supabase `imported_docs`; `imports` row reaches status=completed with accurate counts.