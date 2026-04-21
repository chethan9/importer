---
title: File upload, field mapping & import runner with transaction logging
status: todo
priority: high
type: feature
tags: [firebase, csv, xlsx, import, supabase]
created_by: agent
created_at: 2026-04-21
position: 2
---

## Notes
Steps 3-4 of the wizard. Depends on Task 1. Install `papaparse` + `xlsx`.

**Transaction logging (critical for revert):** Before import starts, create a row in Supabase `imports` table (status=running, collection, mode, project_id, total_rows). During import, after each successful batch, insert rows into `imported_docs` (import_id, doc_id, pre_existing_data JSON for merge mode, status). On completion, update `imports` status + counts. This lets Task 3 revert reliably even after page reload.

For merge/upsert mode: before writing, fetch the existing doc (if any) and store its JSON in `imported_docs.pre_existing_data` — this enables true restore on revert. For create mode, just store the doc_id (revert = delete).

Use Firestore `writeBatch` (max 500 ops/batch). On batch error, capture failing rows into error log without aborting (toggle: "stop on first error").

Type coercion per field: string / number / boolean / timestamp / array-from-comma / JSON. Invalid values go to error log with row index.

Supabase tables to create (in this task's SQL migration):
- `imports` (id, created_at, firebase_project_id, collection_name, mode, total_rows, succeeded, failed, status, duration_ms)
- `imported_docs` (id, import_id FK, doc_id, pre_existing_data jsonb null, created_at)
- Both public-read/anon-insert (T3) since app has no auth; index imported_docs on import_id.

## Checklist
- [ ] Install `papaparse` and `xlsx`; create Supabase tables `imports` + `imported_docs` with T3 RLS; create `importLogService.ts` in src/services with methods: startImport, logDocs(batch), completeImport, listImports, getImportDocs
- [ ] Step 3a — File upload surface: shadcn Card with drag-and-drop zone + file picker (accepts .csv/.xlsx/.xls), shows file name + size + detected row count, "Replace file" action
- [ ] Preview table using shadcn Table: first 10 rows with source headers, sticky header, horizontal scroll, row count summary
- [ ] Step 3b — Mapping UI: two-column layout, left lists source columns with a sample value chip, right has shadcn Select for target Firestore field (from inferred schema) or "— skip —", plus a type-coercion Select per mapped row
- [ ] Doc-ID strategy: shadcn RadioGroup "Auto-generate IDs" vs "Use column as doc ID" (Select for column), plus Import Mode Tabs: "Create new" vs "Merge / upsert"
- [ ] Mapping validation: "Start Import" button (accent teal) disabled until ≥1 mapping exists, tooltip explaining why, warning badge if schema fields are unmapped
- [ ] Step 4 — Import runner: shadcn Progress bar (teal), animated counters for processed/succeeded/failed/remaining, current batch indicator, Cancel button (stops after current batch), writes to Supabase log as it goes
- [ ] For merge mode: before each write, fetch existing doc and store in pre_existing_data for revert capability
- [ ] Completion Dialog: success/failure counts, total time, expandable error table (row index, snippet, error message), "Download error log CSV" button, "View in history" link
- [ ] Actions post-import: "Import another file" (returns to Step 3), "Start over" (resets wizard), "Go to History" (Task 3)

## Acceptance
- User can drop a CSV/XLSX, map columns with type coercion, and click Start Import.
- Progress bar updates live; each successful doc is logged to Supabase `imported_docs`.
- Completion shows succeeded/failed counts and a downloadable error log.
- `imports` row reaches status=completed with accurate counts after run.