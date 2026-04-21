import { Firestore } from "firebase/firestore";
import { coerceValue, inferTypeFromSamples, type FirestoreType, type ArrayElementType } from "./coerce";
import type { CollectionInfo } from "@/contexts/FirebaseContext";

export type Source =
  | { kind: "column"; column: string }
  | { kind: "fixed"; value: string }
  | { kind: "autoIncrement"; start: number; step: number }
  | { kind: "skip" };

export type LeafNode = {
  kind: "leaf";
  id: string;
  name: string;
  firestoreType: FirestoreType;
  arrayElementType?: ArrayElementType;
  source: Source;
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
  return { kind: "leaf", id: newId(), name, firestoreType, source, arrayElementType };
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
    case "column":
      return row[source.column];
    case "fixed":
      return source.value;
    case "autoIncrement":
      return source.start + rowIndex * source.step;
    case "skip":
      return null;
  }
}

export type RowBuildError = { field: string; message: string };

export function buildRowData(
  nodes: FieldNode[],
  row: Record<string, unknown>,
  rowIndex: number,
  db: Firestore,
  pathPrefix = "",
): { data: Record<string, unknown>; errors: RowBuildError[] } {
  const data: Record<string, unknown> = {};
  const errors: RowBuildError[] = [];

  for (const node of nodes) {
    const name = node.name.trim();
    if (!name) continue;
    const path = pathPrefix ? `${pathPrefix}.${name}` : name;

    if (node.kind === "map") {
      const child = buildRowData(node.children, row, rowIndex, db, path);
      errors.push(...child.errors);
      if (Object.keys(child.data).length > 0) data[name] = child.data;
      continue;
    }

    if (node.source.kind === "skip") continue;
    const raw = resolveSource(node.source, row, rowIndex);
    const res = coerceValue(raw, node.firestoreType, { db, arrayElementType: node.arrayElementType });
    if (res.ok === false) {
      errors.push({ field: path, message: res.error });
      continue;
    }
    if (res.value !== null || node.firestoreType === "null") {
      data[name] = res.value;
    }
  }
  return { data, errors };
}

export function collectBoundColumns(nodes: FieldNode[]): Set<string> {
  const set = new Set<string>();
  const walk = (ns: FieldNode[]) => {
    ns.forEach((n) => {
      if (n.kind === "map") walk(n.children);
      else if (n.source.kind === "column" && n.source.column) set.add(n.source.column);
    });
  };
  walk(nodes);
  return set;
}

export function updateNodeById(
  nodes: FieldNode[],
  id: string,
  updater: (n: FieldNode) => FieldNode,
): FieldNode[] {
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

export function appendRoot(nodes: FieldNode[], child: FieldNode): FieldNode[] {
  return [...nodes, child];
}

export function countNodes(nodes: FieldNode[]): { total: number; bound: number } {
  let total = 0;
  let bound = 0;
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
    const seen = new Set<string>();
    const localDups = new Set<string>();
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