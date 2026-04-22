---
title: Resumable imports + retry failed rows
status: todo
priority: high
type: feature
tags: [reliability, supabase, resume]
created_by: agent
created_at: 2026-04-22T14:30:00Z
position: 11
---

## Notes
Today a failed or interrupted import leaves the user stuck: they must re-run the whole thing, re-creating duplicates. Needs Supabase-backed resume + targeted retry.

**DB changes** — migrate `imports` table:
- Add `last_processed_row` (int, default 0) — highest row index successfully attempted
- Add `file_signature` (text, nullable) — hash of file name + row count + header list, used to verify same file on resume
- Add `failed_rows` (jsonb, nullable) — array of `{row_index, raw_row, error_message, field?}` for retry
- Expand status CHECK to include `'paused'` alongside existing values
- Reuse existing `anon_all_imports` policy

**UI flow:**
- On batch boundary: `UPDATE imports SET last_processed_row = N` before moving to next batch
- If import loop throws / user aborts: set `status = 'paused'`
- History Sheet shows "Resume" button for paused imports and "Retry failed" for completed imports where `error_count > 0`
- Resume: user re-selects same file, app compares `file_signature`, resumes from `last_processed_row + 1`
- Retry failed: loads `failed_rows` from Supabase, runs ONLY those rows through the existing write path (no re-resolution of already-successful rows), updates `failed_rows` with remaining failures

**Duplicate protection on resume:** when mode = `create` and ID strategy = `column`, resume should skip rows whose `doc_id` already exists in `imported_docs` for that import_id (belt + suspenders — `last_processed_row` alone should cover this but guards against clock drift).

Existing files: `src/services/importService.ts`, `src/components/importer/ImportStep.tsx`, `src/components/importer/HistorySheet.tsx`, `supabase/migrations/`.

## Checklist
- [ ] DB migration: add `last_processed_row`, `file_signature`, `failed_rows` columns; expand status CHECK to allow 'paused'
- [ ] importService: `updateImportProgress(importId, {last_processed_row, status})` called after each successful batch
- [ ] importService: `appendFailedRows(importId, rows)` batches failed-row writes to Supabase
- [ ] File signature: compute hash client-side (file name + row count + header list) and save on import creation
- [ ] History Sheet: "Resume" button on paused imports, opens file picker, validates signature, launches import at last_processed_row + 1
- [ ] History Sheet: "Retry failed" button on completed imports with errors; runs only the saved failed rows
- [ ] Duplicate guard: when resuming in 'create' mode with column IDs, pre-fetch existing doc_ids from imported_docs and skip them

## Acceptance
- Close the tab mid-import → reopen history → "Resume" continues from the correct row without re-writing successful rows.
- Import with 50 errors out of 5000 rows → click "Retry failed" → only those 50 rows are re-attempted; success count updates in place.
- Resuming with a different file (by signature) shows a clear mismatch error instead of silently corrupting data.