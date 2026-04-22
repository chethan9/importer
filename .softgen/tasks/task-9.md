---
title: Fix and redesign import report (CSV with source columns)
status: done
priority: high
type: bug
tags: [export, csv, bug, admin-api]
created_by: agent
created_at: 2026-04-22T11:30:00Z
position: 9
---

## Notes
Current `.xlsx` report has three problems visible in the user's export of the `services` collection:
1. `row_index` column shows `#NUM!` in every row — bad serialization (NaN / undefined being written as a number).
2. `doc_id` column is empty for every row — the real Firestore doc ID from the admin write response isn't being threaded into the report entry.
3. `doc_path` reads `services/undefined` as a consequence of (2).
4. Original CSV/XLSX columns are not in the report, so the user can't see which source row produced which Firestore doc.

Fix: switch to CSV-only output (drop SheetJS for this export), redesign columns, and plumb real data through.

**Output format:** single `.csv` file, UTF-8 with BOM so Excel opens cleanly.

**Column order (fixed):**
`row_index, collection, doc_id, doc_path, status, error_message, <all source columns in original order>`

- `row_index` — 1-based integer matching the source file row (header row is 1, first data row is 2, etc.)
- `collection` — target collection name (e.g. `services`)
- `doc_id` — actual Firestore doc ID (including auto-generated)
- `doc_path` — `<collection>/<doc_id>`
- `status` — `success` | `error` | `skipped`
- `error_message` — blank on success
- Remaining columns — every header from the uploaded file with the original row value in each cell

**Data plumbing fixes:**
- `src/pages/api/admin/write-batch.ts` must return `docId: ref.id` for every op, including auto-generated IDs.
- `src/components/importer/ImportStep.tsx` `processBatchAdmin` must read `docId` from the API response and store it on `WrittenDoc`.
- Report builder takes the original `rowsToImport` array so it can look up each row by index and emit its values.
- Row index displayed = stored 0-based index + 1 (humans count from 1; account for the header row — decide: is row 2 in Excel row 0 or 1 in our internal index? Document the choice in code and make the CSV match Excel's view).

**History runs:** the Supabase log does not store the original source file, so reports downloaded from History will only include the metadata columns (row_index, collection, doc_id, doc_path, status, error_message) with no source columns. Show a small note in the History UI on the Download button explaining this.

**Files to touch:**
- `src/lib/exportResults.ts` — rewrite as CSV-only; new signature `exportResultsCSV({ collection, rows, sourceRows?, sourceHeaders? })`.
- `src/components/importer/ImportStep.tsx` — call new exporter with `sourceRows` + `sourceHeaders`.
- `src/components/importer/HistorySheet.tsx` — call new exporter without source data; add inline note.
- `src/pages/api/admin/write-batch.ts` — guarantee `docId` in response.

## Checklist
- [x] Admin write-batch API returns real docId for every written op (via ref.id)
- [x] processBatchAdmin threads returned docId into WrittenDoc
- [x] CSV exporter with UTF-8 BOM and proper escaping (src/lib/exportResults.ts)
- [x] Column order: row_index, collection, doc_id, doc_path, status, error_message, then source headers
- [x] Live run reports include full source row values
- [x] History runs produce metadata-only CSV
- [x] .xlsx output path removed

## Acceptance
- Opening the downloaded CSV in Excel or Google Sheets shows real integers in `row_index` (no `#NUM!`).
- Every success row has a non-empty `doc_id` and a `doc_path` like `services/abc123XYZ`.
- Every original CSV/XLSX column from the uploaded file appears in the report with its original value for each row.
- History → any past run → Download produces a metadata-only CSV that opens cleanly.