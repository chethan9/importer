import { Firestore, collection as fsCollection, doc as fsDoc, DocumentReference, getDocs, limit, query, where, serverTimestamp } from "firebase/firestore";
import { coerceValue, inferTypeFromSamples, type FirestoreType, type ArrayElementType } from "./coerce";
import type { CollectionInfo } from "@/contexts/FirebaseContext";

export type RefQuerySource = {
  kind: "refQuery";
  collection: string;
  matchField: string;
  matchSource: { kind: "column"; column: string } | { kind: "fixed"; value: string };
  onMissing: "error" | "null";
};

export type RefManualSource = {
  kind: "refManual";
  column: string;
  baseCollection?: string;
  onMissing: "error" | "null";
};

export type Source =
  | { kind: "column"; column: string }
  | { kind: "fixed"; value: string }
  | { kind: "autoIncrement"; start: number; step: number }
  | { kind: "now" }
  | { kind: "skip" }
  | RefQuerySource
  | RefManualSource;

export type LeafNode = {
  kind: "leaf";
  id: string;
  name: string;
  firestoreType: FirestoreType;
  /** When firestoreType is "image": store URL as-is or fetch + upload to Storage */
  imageMode?: "passthrough" | "upload";
  arrayElementType?: ArrayElementType;
  source: Source;
  typeLocked?: boolean;
};

export type MapNode = {
  kind: "map";
  id: string;
  name: string;
  children: FieldNode[];
};

export type FieldNode = LeafNode | MapNode;

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `n_${idCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function makeLeaf(
  name: string,
  firestoreType: FirestoreType = "string",
  source: Source = { kind: "skip" },
  arrayElementType?: ArrayElementType,
): LeafNode {
  const imageMode = firestoreType === "image" ? "passthrough" : undefined;
  return { kind: "leaf", id: newId(), name, firestoreType, imageMode, source, arrayElementType };
}

export function makeMap(name: string, children: FieldNode[] = []): MapNode {
  return { kind: "map", id: newId(), name, children };
}

export function buildInitialTree(
  collection: CollectionInfo,
  columns: string[],
  sampleRows: Record<string, unknown>[],
): FieldNode[] {
  const colSet = new Set(columns);
  const result: FieldNode[] = [];
  const used = new Set<string>();

  collection.fields?.forEach((f) => {
    const match = colSet.has(f.name) ? f.name : null;
    if (match) used.add(match);
    const type = (f.type as FirestoreType) ?? "string";
    if (type === "map") {
      result.push(makeMap(f.name, []));
    } else {
      result.push(
        makeLeaf(f.name, type, match ? { kind: "column", column: match } : { kind: "skip" }),
      );
    }
  });

  columns.forEach((col) => {
    if (!used.has(col) && !result.find((n) => n.name === col)) {
      const samples = sampleRows.slice(0, 50).map((r) => r[col]);
      const t = inferTypeFromSamples(samples);
      result.push(makeLeaf(col, t, { kind: "column", column: col }));
    }
  });

  return result;
}

export function resolveSource(source: Source, row: Record<string, unknown>, rowIndex: number): unknown {
  switch (source.kind) {
    case "column": return row[source.column];
    case "fixed": return source.value;
    case "autoIncrement": return source.start + rowIndex * source.step;
    case "now": return "__NOW__";
    case "refQuery": return "__REF__";
    case "skip": return null;
  }
}

export function refQueryCacheKey(collection: string, matchField: string, value: string): string {
  return `${collection}\u0000${matchField}\u0000${value}`;
}

export function getRefMatchValue(src: RefQuerySource, row: Record<string, unknown>): string {
  if (src.matchSource.kind === "column") {
    const raw = row[src.matchSource.column];
    return raw === null || raw === undefined ? "" : String(raw).trim();
  }
  return src.matchSource.value.trim();
}

export function collectRefQueryLookups(nodes: FieldNode[], rows: Record<string, unknown>[]): Array<{ collection: string; matchField: string; value: string; key: string }> {
  const seen = new Set<string>();
  const out: Array<{ collection: string; matchField: string; value: string; key: string }> = [];
  const walk = (ns: FieldNode[]) => {
    ns.forEach((n) => {
      if (n.kind === "map") { walk(n.children); return; }
      if (n.source.kind !== "refQuery") return;
      const src = n.source;
      if (!src.collection.trim() || !src.matchField.trim()) return;
      rows.forEach((row) => {
        const value = getRefMatchValue(src, row);
        if (!value) return;
        const key = refQueryCacheKey(src.collection, src.matchField, value);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ collection: src.collection, matchField: src.matchField, value, key });
      });
    });
  };
  walk(nodes);
  return out;
}

export async function resolveRefQueries(
  lookups: Array<{ collection: string; matchField: string; value: string; key: string }>,
  db: Firestore,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, DocumentReference | null>> {
  const cache = new Map<string, DocumentReference | null>();
  if (lookups.length === 0) return cache;

  // Pre-populate with null so unresolved values return null (not undefined)
  lookups.forEach((l) => cache.set(l.key, null));

  // Group by (collection, matchField)
  const groups = new Map<string, { collection: string; matchField: string; values: Set<string> }>();
  for (const l of lookups) {
    if (!l.collection.trim() || !l.matchField.trim()) continue;
    const gkey = `${l.collection}\u0000${l.matchField}`;
    if (!groups.has(gkey)) {
      groups.set(gkey, { collection: l.collection, matchField: l.matchField, values: new Set() });
    }
    groups.get(gkey)!.values.add(l.value);
  }

  const CHUNK = 30;
  const tasks: Array<() => Promise<void>> = [];
  for (const g of groups.values()) {
    const uniqueValues = Array.from(g.values);
    for (let i = 0; i < uniqueValues.length; i += CHUNK) {
      const chunk = uniqueValues.slice(i, i + CHUNK);
      tasks.push(async () => {
        try {
          const q = query(fsCollection(db, g.collection), where(g.matchField, "in", chunk));
          const snap = await getDocs(q);
          snap.forEach((docSnap) => {
            const fieldVal = docSnap.get(g.matchField);
            if (fieldVal === undefined || fieldVal === null) return;
            const key = refQueryCacheKey(g.collection, g.matchField, String(fieldVal));
            if (!cache.get(key)) cache.set(key, docSnap.ref);
          });
        } catch (err) {
          console.warn("resolveRefQueries chunk failed:", err);
        }
      });
    }
  }

  const total = tasks.length;
  let done = 0;
  onProgress?.(0, total);
  const CONCURRENCY = 6;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const slice = tasks.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map((t) =>
        t().then(() => {
          done += 1;
          onProgress?.(done, total);
        }),
      ),
    );
  }
  return cache;
}

export type RowBuildError = { field: string; message: string };

export function buildRowData(
  nodes: FieldNode[],
  row: Record<string, unknown>,
  rowIndex: number,
  db: Firestore,
  refCache?: Map<string, DocumentReference | null>,
  pathPrefix = "",
): { data: Record<string, unknown>; errors: RowBuildError[] } {
  const data: Record<string, unknown> = {};
  const errors: RowBuildError[] = [];

  for (const node of nodes) {
    const name = node.name.trim();
    if (!name) continue;
    const path = pathPrefix ? `${pathPrefix}.${name}` : name;

    if (node.kind === "map") {
      const child = buildRowData(node.children, row, rowIndex, db, refCache, path);
      errors.push(...child.errors);
      if (Object.keys(child.data).length > 0) data[name] = child.data;
      continue;
    }

    if (node.source.kind === "skip") continue;
    if (node.source.kind === "now") { data[name] = serverTimestamp(); continue; }

    if (node.source.kind === "refManual") {
      const src = node.source;
      const raw = row[src.column];
      const parsed = parseManualRefPath(raw, src.baseCollection);
      if (parsed === null) {
        if (src.onMissing === "error") errors.push({ field: path, message: `Empty value in column "${src.column}"` });
        continue;
      }
      if ("error" in parsed) {
        if (src.onMissing === "error") errors.push({ field: path, message: parsed.error });
        continue;
      }
      data[name] = fsDoc(db, parsed.segments[0], ...parsed.segments.slice(1));
      continue;
    }

    if (node.source.kind === "refQuery") {
      const src = node.source;
      if (!src.collection.trim() || !src.matchField.trim()) {
        errors.push({ field: path, message: "Reference query missing collection or match field" });
        continue;
      }
      const matchValue = getRefMatchValue(src, row);
      if (!matchValue) {
        if (src.onMissing === "error") errors.push({ field: path, message: "Empty match value for reference query" });
        continue;
      }
      if (!refCache) { continue; }
      const ref = refCache.get(refQueryCacheKey(src.collection, src.matchField, matchValue));
      if (ref === undefined || ref === null) {
        if (src.onMissing === "error") {
          errors.push({ field: path, message: `No doc in "${src.collection}" where ${src.matchField} == "${matchValue}"` });
        }
        continue;
      }
      data[name] = ref;
      continue;
    }

    const raw = resolveSource(node.source, row, rowIndex);

    if (node.firestoreType === "image" && node.imageMode === "upload") {
      const res = coerceValue(raw, "image", { db, arrayElementType: node.arrayElementType });
      if (res.ok === false) { errors.push({ field: path, message: res.error }); continue; }
      if (res.value === null) continue;
      data[name] = { __type: "pendingImageUpload", url: res.value as string };
      continue;
    }

    const res = coerceValue(raw, node.firestoreType, { db, arrayElementType: node.arrayElementType });
    if (res.ok === false) { errors.push({ field: path, message: res.error }); continue; }
    if (res.value !== null || node.firestoreType === "null") data[name] = res.value;
  }
  return { data, errors };
}

/** Web URLs must not be interpreted as Firestore paths (slashes look like collection/doc segments). */
export function looksLikeHttpOrHttpsUrl(str: string): boolean {
  return /^https?:\/\//i.test(str.trim());
}

export function parseManualRefPath(rawValue: unknown, baseCollection?: string): { path: string; segments: string[] } | { error: string } | null {
  if (rawValue === null || rawValue === undefined) return null;
  const str = String(rawValue).trim();
  if (!str) return null;
  if (looksLikeHttpOrHttpsUrl(str)) {
    return {
      error:
        "This value is a web URL, not a Firestore document path (collection/docId). Use type “String”, “String (URL as text)”, or “Image URL” — Reference is only for Firestore paths.",
    };
  }
  const cleaned = str.startsWith("/") ? str.slice(1) : str;
  if (cleaned.includes("/")) {
    const segments = cleaned.split("/").filter(Boolean);
    if (segments.length < 2 || segments.length % 2 !== 0) {
      return { error: `Invalid Firestore doc path "${str}" — must be collection/doc[/collection/doc…]` };
    }
    return { path: segments.join("/"), segments };
  }
  const base = baseCollection?.trim();
  if (!base) return { error: `Value "${str}" is not a full path and no base collection is set` };
  return { path: `${base}/${cleaned}`, segments: [base, cleaned] };
}

export function collectBoundColumns(nodes: FieldNode[]): Set<string> {
  const set = new Set<string>();
  const walk = (ns: FieldNode[]) => {
    ns.forEach((n) => {
      if (n.kind === "map") walk(n.children);
      else if (n.source.kind === "column" && n.source.column) set.add(n.source.column);
      else if (n.source.kind === "refManual" && n.source.column) set.add(n.source.column);
      else if (n.source.kind === "refQuery" && n.source.matchSource.kind === "column" && n.source.matchSource.column) {
        set.add(n.source.matchSource.column);
      }
    });
  };
  walk(nodes);
  return set;
}

export function updateNodeById(nodes: FieldNode[], id: string, updater: (n: FieldNode) => FieldNode): FieldNode[] {
  return nodes.map((n) => {
    if (n.id === id) return updater(n);
    if (n.kind === "map") return { ...n, children: updateNodeById(n.children, id, updater) };
    return n;
  });
}

export function removeNodeById(nodes: FieldNode[], id: string): FieldNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.kind === "map" ? { ...n, children: removeNodeById(n.children, id) } : n));
}

export function addChildToMap(nodes: FieldNode[], parentId: string, child: FieldNode): FieldNode[] {
  return nodes.map((n) => {
    if (n.kind === "map" && n.id === parentId) return { ...n, children: [...n.children, child] };
    if (n.kind === "map") return { ...n, children: addChildToMap(n.children, parentId, child) };
    return n;
  });
}

export function appendRoot(nodes: FieldNode[], child: FieldNode): FieldNode[] { return [...nodes, child]; }

export type NodeContext = { node: FieldNode; parentId: string | null; index: number };

export function findNodeWithContext(nodes: FieldNode[], id: string, parentId: string | null = null): NodeContext | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === id) return { node: n, parentId, index: i };
    if (n.kind === "map") {
      const found = findNodeWithContext(n.children, id, n.id);
      if (found) return found;
    }
  }
  return null;
}

export function insertAt(nodes: FieldNode[], parentId: string | null, index: number, node: FieldNode): FieldNode[] {
  if (parentId === null) {
    const copy = [...nodes];
    copy.splice(Math.min(index, copy.length), 0, node);
    return copy;
  }
  return nodes.map((n) => {
    if (n.kind === "map" && n.id === parentId) {
      const children = [...n.children];
      children.splice(Math.min(index, children.length), 0, node);
      return { ...n, children };
    }
    if (n.kind === "map") return { ...n, children: insertAt(n.children, parentId, index, node) };
    return n;
  });
}

export function countNodes(nodes: FieldNode[]): { total: number; bound: number } {
  let total = 0; let bound = 0;
  const walk = (ns: FieldNode[]) => {
    ns.forEach((n) => {
      total += 1;
      if (n.kind === "map") walk(n.children);
      else if (n.source.kind !== "skip") bound += 1;
    });
  };
  walk(nodes);
  return { total, bound };
}

export function findDuplicatesAtLevel(nodes: FieldNode[]): string[] {
  const dups: string[] = [];
  const walk = (ns: FieldNode[]) => {
    const seen = new Set<string>(); const localDups = new Set<string>();
    ns.forEach((n) => {
      const name = n.name.trim();
      if (!name) return;
      if (seen.has(name)) localDups.add(name);
      seen.add(name);
      if (n.kind === "map") walk(n.children);
    });
    localDups.forEach((d) => dups.push(d));
  };
  walk(nodes);
  return dups;
}

export { fsDoc };