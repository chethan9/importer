---
title: Concurrent batched ref lookups
status: done
priority: high
type: feature
tags: [performance, refs, api]
created_by: agent
created_at: 2026-04-22T14:30:00Z
position: 10
---

## Notes
Reference lookups (refQuery source) currently resolve one value at a time via sequential HTTP calls to `/api/admin/resolve-ref` (admin mode) or sequential `getDocs(where == value)` calls (web mode). For 5k rows with two ref fields that's 10k round trips — dominant cost of an import.

Rework to batch + parallelize:
- **Admin**: new endpoint `/api/admin/resolve-refs-batch` accepts `[{collection, matchField, values: string[]}]`. Server groups `values` into 30-item chunks (Firestore `where("field", "in", chunk)` limit), runs all chunks with `Promise.all`, returns `{key → path}` map where `key = ${collection}\0${matchField}\0${value}`. Existing `/api/admin/resolve-ref` stays for single-value backward compat.
- **Web**: `resolveRefQueries` in `src/lib/mappingTree.ts` should group lookups by `(collection, matchField)`, chunk each group into 30-value `in` queries, parallelize with `Promise.all`.
- `ImportStep` calls once with ALL dedup'd lookups up front (already dedups by cache key — preserve that).
- Show progress: "Resolving N of M references" status updates as chunks complete.
- Cache the final map and reuse across batches (already the pattern).

Existing files: `src/lib/mappingTree.ts` (collectRefQueryLookups + resolveRefQueries), `src/pages/api/admin/resolve-ref.ts`, `src/components/importer/ImportStep.tsx`.

## Checklist
- [x] New admin endpoint that accepts grouped lookups, chunks into 30-value `in` queries, runs chunks in parallel, returns flat path map
- [x] Web-SDK batch resolver that groups by (collection, field), chunks, runs in parallel
- [x] ImportStep calls batch endpoint once with all dedup'd lookups before the write loop
- [x] Live status updates during resolution: "Resolving X of Y references" with per-chunk progress
- [x] Handle missing matches cleanly — return empty path for un-found values; keep per-field `onMissing` behaviour unchanged
- [x] Fail one chunk gracefully without blocking others — log chunk error, mark those values as unresolved

## Acceptance
- A 5k-row import with 2 refQuery fields resolves references in < 5 seconds on a typical connection (previously 30s+).
- Progress UI shows reference-resolution phase separate from write phase.
- Existing single-value `/api/admin/resolve-ref` still works for any callers that depend on it.