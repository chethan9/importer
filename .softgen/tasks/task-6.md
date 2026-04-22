---
title: Reference-by-query source for Firestore reference fields
status: done
priority: high
type: feature
tags: [firebase, mapping, reference, query]
created_by: agent
created_at: 2026-04-21
position: 6
---

## Notes
Target: src/lib/mappingTree.ts, src/lib/coerce.ts, src/components/importer/mapping/FieldTreeNode.tsx, src/components/importer/mapping/FirestorePreview.tsx, src/components/importer/ImportStep.tsx

Add a new source kind `refQuery` on leaf nodes so users can populate a Firestore reference field by querying another collection per row. Example: CSV has "sku" column; user wants the `product` field (type `reference`) to point to `/products/<doc where sku == row.sku>`.

Shape:
```
{ kind: "refQuery",
  collection: string,          // target collection (user types, or picks from discovered collections)
  matchField: string,          // field name inside target collection to compare against
  matchSource: { kind: "column"; column: string } | { kind: "fixed"; value: string },
  onMissing: "error" | "null"  // behavior when query returns 0 results
}
```

Runtime: `buildRowData` becomes async; for each `refQuery` leaf, run `query(collection(db, collection), where(matchField, "==", matchValue), limit(1))` and take `snapshot.docs[0].ref`. Cache results per (collection+matchField+matchValue) within a batch to avoid duplicate reads. ImportStep's `processBatch` must await tree resolution.

Preview: FirestorePreview shows "→ /collection/<resolving…>" placeholder; actual ref is only fetched at import time (do NOT query inside preview — too chatty). Show a purple reference chip with collection/matchField/source summary.

UI on leaf: when source kind = "refQuery", show 3 compact inputs: collection (text input with datalist of known collections from FirebaseContext), match field (text input), value source picker (CSV column dropdown OR fixed value). + onMissing radio.

Validation: field's Firestore type must be "reference" (auto-set when user picks refQuery); otherwise show a warning.

## Checklist
- [x] Extended Source union in mappingTree.ts with refQuery variant
- [x] buildRowData resolves refQuery via refCache
- [x] ImportStep awaits collectRefQueryLookups + resolveRefQueries (batched via Task 10)
- [x] "Reference by query" option on each leaf with collection + matchField + matchSource inputs
- [x] FirestorePreview shows reference chip summary
- [x] Firestore type auto-set to reference for refQuery source
- [x] Error log entry when onMissing=error and no doc found
- [x] Admin path: /api/admin/resolve-refs-batch endpoint (Task 10) with param-name mismatch fix

## Acceptance
- User can map a leaf field to "Reference by query", set collection + match field + source, and import succeeds with a real `DocumentReference` written to Firestore (verify in Firebase console).
- Preview step shows a reference chip summarizing the query without actually querying.
- If no matching doc is found with `onMissing: "error"`, the row is flagged in the error log.