---
title: Design system + Firebase connect & collection browser
status: todo
priority: urgent
type: feature
tags: [design-system, firebase, ui]
created_by: agent
created_at: 2026-04-21
position: 1
---

## Notes
First half of the importer wizard. Establishes the design system per `.softgen/project.md` and delivers steps 1-2 of the flow: connecting to Firebase and browsing collections.

The user supplies their own Firebase project config (apiKey, authDomain, projectId, etc.) at runtime. Use `firebase/app` + `firebase/firestore` Web SDK, initialized client-side only. Persist last-used config in localStorage under a namespaced key. Never log the config to console.

Collection discovery: Firestore Web SDK cannot list collections natively — prompt the user to either (a) paste a comma-separated list of collection names they want to work with, or (b) enter one collection name. For each collection, fetch the first 20 docs and infer field schema (union of keys, inferred types).

Install `firebase` via npm during this task.

## Checklist
- [ ] Install `firebase` package; set up design system: import Sora + Work Sans + JetBrains Mono from Google Fonts, register in tailwind config, map HSL tokens from project brief into globals.css (coral-red primary, teal accent, warm off-white background, 8px radius)
- [ ] App shell on the main landing view: header with product name "Firebase Data Importer" + tagline, stepper showing 4 steps (Connect → Browse → Map → Import) with current step highlighted
- [ ] Step 1 — Connect screen: form with two input modes (paste full config JSON, or fill 6 individual fields: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId), validate required fields, "Connect" primary button, inline error if init fails, success toast on connect, remember last config in localStorage with a "Load last used" button
- [ ] Step 2 — Collection browser: input to add collection names (one at a time or comma-separated), list added collections as selectable cards showing collection name + inferred doc count (first fetch) + sample field chips (mono font), clicking a card selects it and advances to Step 3
- [ ] Per-collection schema preview panel: shows inferred field names with detected types (string, number, boolean, timestamp, array, map) in a clean table, note that schema is inferred from the first 20 docs
- [ ] Empty/error states: no collections added yet (friendly prompt), Firebase init error (clear message with fix hint), permission denied reading a collection (show which collection and suggest checking Firestore rules)
- [ ] Disconnect / switch project button in the header that clears in-memory Firebase app and returns to Step 1

## Acceptance
- User can paste a Firebase config, click Connect, and see a success state.
- User can add a collection name and see its inferred field schema rendered with field-name chips and types.
- Last config is restored on page reload via a "Load last used" action.