---
title: Service account mode (admin SDK, bypass Firestore rules)
status: in_progress
priority: high
type: feature
tags: [firebase, admin, security]
created_by: agent
created_at: 2026-04-21T12:15:00Z
position: 8
---

## Notes
User doesn't want to edit Firestore rules or enable anon auth for every project. Add a second connect mode: paste a Firebase service account JSON. All Firestore operations (list collections, infer schema, import, revert, resolve refQuery) run server-side via Next.js API routes using `firebase-admin`, which bypasses security rules.

Service account JSON is stored in browser localStorage only, sent with each API request, never persisted server-side. Admin apps are initialized per-request and torn down.

## Checklist
- [x] Install firebase-admin package
- [ ] src/lib/firebaseAdmin.ts: per-request admin app init/teardown helper
- [ ] API routes: list-collections, infer-schema, write-batch, delete-batch, set-batch, resolve-ref (all accept serviceAccount in POST body)
- [ ] src/services/adminFirestoreService.ts: client-side proxy calling the API routes
- [ ] FirebaseContext: add authMode ("web" | "admin"), serviceAccount state, connect variant for admin mode
- [ ] ConnectStep: Tabs — "Web SDK config" | "Service account (recommended)"; paste JSON, validate
- [ ] BrowseStep: branch on authMode for list/infer
- [ ] ImportStep: branch on authMode — build docs locally, send to write-batch API
- [ ] HistorySheet revert: branch on authMode — send ops to delete-batch/set-batch API
- [ ] refQuery resolution: branch on authMode — call resolve-ref API
- [ ] Progress reporting: API returns per-batch results; client updates progress after each batch POST

## Acceptance
- User pastes service account JSON, connects, sees collections without enabling anon auth or editing rules.
- Import and revert both succeed against a project with default "deny all" Firestore rules.
- Service account JSON never appears in server logs or persistent server storage.