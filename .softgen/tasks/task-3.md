---
title: Import history & revert
status: done
priority: high
type: feature
tags: [firebase, supabase, revert, history]
created_by: agent
created_at: 2026-04-21
position: 3
---

## Notes
Third main surface of the app: a History page listing every past import (from Supabase `imports` table), with ability to **revert** any import. Requires active Firebase connection (Task 1) to actually delete/restore docs.

Revert logic:
- **Create mode imports:** iterate `imported_docs` for that import_id, batch-delete those doc IDs from the original collection in Firestore. Use `writeBatch` (500/batch) with live progress.
- **Merge mode imports:** for each `imported_docs` row, if `pre_existing_data` is not null, restore it (`setDoc` with that data); if null (doc didn't exist before merge), delete it. This gives true point-in-time restore.
- After revert completes, mark `imports.status = 'reverted'` and add a `reverted_at` timestamp. Reverted imports still show in history but are visually de-emphasized and cannot be reverted again.

Access: navigation link in app header → History page (or shadcn Sheet side-panel). Each import row shows collection, mode, counts, timestamp, status badge (completed / reverted / failed / running). Clicking opens a Detail dialog with the full doc-ID list (paginated) and a destructive "Revert Import" button that opens a confirm AlertDialog.

## Checklist
- [ ] Add schema migration: `ALTER TABLE imports ADD COLUMN reverted_at timestamptz`, plus a CHECK updating status to allow 'reverted'; extend importLogService with markReverted method
- [ ] History page at /history (or Sheet from header button): shadcn Table listing imports — columns: Collection (mono), Mode badge, Total, Succeeded, Failed, Status pill, Date (relative time), Actions (View / Revert)
- [ ] Filters above table: by collection, by status (all / completed / reverted / failed), by date range; empty state for no history
- [ ] Import detail dialog: shows full summary + paginated list of affected doc IDs (mono chips), pre-existing snapshot indicator for merge-mode rows, link to open collection
- [ ] Revert flow: AlertDialog confirm ("This will delete N docs from collection `X`. This cannot be undone."), requires active Firebase connection (prompt to connect if not), then runs batched revert with Progress bar + live counters
- [ ] Revert failure handling: partial-revert state recorded (store which doc IDs were successfully reverted), allow retry on remaining docs, surface errors in an expandable log
- [ ] Header nav: add "History" link (with unread-style dot if a recent import exists), wire from Task 2 completion dialog "Go to History" action
- [ ] After successful revert: toast confirmation, update status pill to "Reverted", disable Revert button

## Acceptance
- User can navigate to History and see every past import with collection, mode, counts, status.
- Clicking Revert on a create-mode import deletes the written docs from Firestore with a live progress bar.
- Clicking Revert on a merge-mode import restores pre-existing doc snapshots (or deletes newly-created ones).
- Reverted imports show a "Reverted" status and cannot be reverted again.