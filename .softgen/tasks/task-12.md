---
title: Non-blocking bulk-write engine
status: todo
priority: high
type: feature
tags: [performance, batching, ux]
created_by: agent
created_at: 2026-04-22T14:30:00Z
position: 12
---

## Notes
5k+ row imports hang the UI and take too long. Three bottlenecks:

1. **Per-row pre-existence reads** — in merge mode with column IDs, admin `write-batch.ts` currently runs `ref.get()` per row inside the batch loop (500 sequential reads per batch). Replace with ONE `db.getAll(...refs)` call per batch (admin SDK accepts up to 500 refs).
2. **Main-thread blocking** — build-row + coerce work for 5k rows locks the UI. Insert `await new Promise(r => setTimeout(r, 0))` between batches so React can paint progress. Consider building all ops for a batch, then yielding, then sending.
3. **Sequential batch writes** — admin batches run 1-at-a-time. Run 2-3 batches concurrently using a small in-flight pool (e.g. `pLimit(3)`-style with native Promise.all chunking). Preserve batch-commit order in progress UI.

**Pre-flight duplicate detection:**
- Before starting writes, if ID strategy = `column`: send all N doc IDs to a new `/api/admin/check-existing` endpoint in chunks → returns Set of existing IDs.
- Show count in UI: "42 of 5000 rows will overwrite existing docs" with choice: Skip / Overwrite (merge) / Abort.
- This replaces the per-row pre-read entirely for the happy path.

**Batch sizing:**
- Raise admin batch size from 400 to 500 (Firestore admin limit).
- Keep web SDK at 400 (safer headroom for writeBatch).
- Expose batch size in a dev-only debug panel? No — keep hidden for now.

Existing files: `src/pages/api/admin/write-batch.ts`, `src/components/importer/ImportStep.tsx`.

## Checklist
- [ ] Replace per-row `ref.get()` in write-batch.ts with a single `db.getAll(...refs)` call per batch when `checkExisting` is true
- [ ] Add new `/api/admin/check-existing` endpoint: accepts doc ID array, returns `{existing: string[]}` using chunked `getAll`
- [ ] Pre-flight step in ImportStep (column ID strategy only): call check-existing, show duplicate count before Start, let user choose skip/overwrite/abort
- [ ] Yield to main thread between batches with `await new Promise(r => setTimeout(r, 0))` so progress bar updates smoothly
- [ ] Run 2-3 admin batches concurrently via a small promise pool; preserve order in live result list
- [ ] Raise admin BATCH_SIZE to 500 (keep web at 400)
- [ ] Test with 5k rows: confirm UI stays responsive and import finishes in < 60 seconds for typical connections

## Acceptance
- 5k-row import completes in under 60 seconds (previously several minutes or hangs) with progress bar animating smoothly throughout.
- Column-ID imports show a duplicate-count dialog before writes begin when existing docs match.
- No "page unresponsive" prompt during a 5k import.