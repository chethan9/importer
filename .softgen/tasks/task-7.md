---
title: Download import results as Excel (.xlsx)
status: todo
priority: medium
type: feature
tags: [export, xlsx, reporting]
created_by: agent
created_at: 2026-04-21
position: 7
---

## Notes
Target: src/lib/exportResults.ts (new), src/components/importer/ImportStep.tsx, src/components/importer/HistorySheet.tsx, src/services/importService.ts

After an import finishes (success or partial), let the user download a report with everything written. Also available on every past run in the History sheet.

Report columns:
- row_index (1-based)
- status (success | error)
- doc_id
- doc_path (e.g. `products/abc123`)
- error_message (blank on success)
- source_* columns — flatten the original CSV row for traceability (prefix each CSV column with `source_`)

Uses SheetJS (already installed as `xlsx`). Create a small helper `buildResultsWorkbook(run: ResultsInput)` that returns a Blob + triggers download. Filename: `firebase-import_{collection}_{timestamp}.xlsx`.

Data source for live run: already have `importedDocs[]` in state + the source `file.rows` + `errors[]`. For history sheet: the existing `import_logs` table stores doc IDs per run — load them and the mappings are saved on the import record, but the original CSV rows are NOT persisted. For history → offer Excel export with just row_index/status/doc_id/doc_path/error_message (no source_* columns). Note this limitation in the history UI.

## Checklist
- [ ] Add `src/lib/exportResults.ts` with `downloadImportReport` that builds workbook + triggers save
- [ ] Button "Download report (.xlsx)" on ImportStep after a completed run — includes source row columns
- [ ] Button "Download report (.xlsx)" on each past run in HistorySheet — basic columns only, with a tooltip noting source rows aren't retained
- [ ] Include summary sheet in the workbook: collection, mode, timestamp, total/success/error counts

## Acceptance
- After a successful import, clicking "Download report" produces an .xlsx matching the filename pattern with all imported rows + their doc IDs/paths.
- Opening the file in Excel/Numbers shows a "Results" sheet + a "Summary" sheet.
- History sheet produces a (reduced) report for any previous run.