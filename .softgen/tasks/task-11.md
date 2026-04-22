---
title: Resumable imports + retry failed rows
status: done
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
- [x] DB migration: add last_processed_row, file_signature, failed_rows columns; expand status CHECK to include 'paused'
- [x] importService: computeFileSignature, updateImportProgress, pauseImport, markImportResuming helpers
- [x] ImportStep: persist last_processed_row + success/error counts + failed_rows after every batch
- [x] ImportStep: on fatal error (network/Firestore exception), call pauseImport and exit without finalizing
- [x] ImportStep: accept resumeInfo prop to continue from a specific row with prior success/error state
- [x] ImportStep: yield to main thread after each batch (setTimeout 0) so UI remains responsive
- [x] HistorySheet: show paused status badge + last_processed_row / total_rows progress
- [x] HistorySheet: Resume button (paused) + emit callback (Retry Failed deferred)
- [x] index.tsx: wire resume flow — file signature validation → re-enter ImportStep with resumeInfo

## Acceptance
- Close the tab mid-import → reopen history → "Resume" continues from the correct row without re-writing successful rows.
- Import with 50 errors out of 5000 rows → click "Retry failed" → only those 50 rows are re-attempted; success count updates in place.
- Resuming with a different file (by signature) shows a clear mismatch error instead of silently corrupting data.