import { useState } from "react";
import { ChevronRight, ChevronDown, Eye } from "lucide-react";
import { Firestore, serverTimestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import type { FieldNode } from "@/lib/mappingTree";
import { resolveSource } from "@/lib/mappingTree";
import { coerceValue } from "@/lib/coerce";

type Props = {
  tree: FieldNode[];
  sampleRow: Record<string, unknown>;
  rowIndex: number;
  db: Firestore | null;
  docId?: string;
};

type PreviewValue =
  | { kind: "primitive"; display: string; typeLabel: string; tone: "string" | "number" | "boolean" | "null" | "timestamp" | "geopoint" | "reference" | "bytes" | "image" }
  | { kind: "array"; items: PreviewValue[] }
  | { kind: "map"; entries: Array<{ name: string; value: PreviewValue }> }
  | { kind: "error"; message: string };

export function FirestorePreview({ tree, sampleRow, rowIndex, db, docId }: Props) {
  const entries = buildPreviewEntries(tree, sampleRow, rowIndex, db);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#0f1117] font-mono text-[12px] text-zinc-200 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/60 bg-[#14161d] px-3 py-2">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-[11px] uppercase tracking-wide text-zinc-400">Document preview</span>
        </div>
        <code className="truncate max-w-[280px] text-[11px] text-zinc-500">
          {docId ? docId : "<auto-id>"}
        </code>
      </div>
      <div className="max-h-[420px] overflow-auto p-3">
        {entries.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-zinc-500">
            No fields bound yet — drop a CSV column on a field to see a preview.
          </div>
        ) : (
          <div className="space-y-0.5">
            {entries.map((e) => (
              <PreviewRow key={e.name} name={e.name} value={e.value} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewRow({ name, value, depth }: { name: string; value: PreviewValue; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const pad = { paddingLeft: 8 + depth * 16 };

  if (value.kind === "error") {
    return (
      <div className="flex items-start gap-1.5 py-0.5" style={pad}>
        <span className="w-3" />
        <span className="text-zinc-300">{name}</span>
        <span className="text-zinc-600">:</span>
        <span className="text-rose-400">⚠ {value.message}</span>
      </div>
    );
  }

  if (value.kind === "map") {
    return (
      <div>
        <div className="flex items-center gap-1 py-0.5" style={pad}>
          <button onClick={() => setOpen((v) => !v)} className="text-zinc-500 hover:text-zinc-300">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          <span className="text-zinc-300">{name}</span>
          {!open && <span className="ml-1 text-zinc-600">{"{…}"}</span>}
        </div>
        {open && (
          <div>
            {value.entries.length === 0 ? (
              <div className="py-0.5 italic text-zinc-600" style={{ paddingLeft: 8 + (depth + 1) * 16 + 12 }}>
                (empty)
              </div>
            ) : (
              value.entries.map((e) => (
                <PreviewRow key={e.name} name={e.name} value={e.value} depth={depth + 1} />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  if (value.kind === "array") {
    return (
      <div>
        <div className="flex items-center gap-1 py-0.5" style={pad}>
          <button onClick={() => setOpen((v) => !v)} className="text-zinc-500 hover:text-zinc-300">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          <span className="text-zinc-300">{name}</span>
          {!open && <span className="ml-1 text-zinc-600">[{value.items.length}]</span>}
        </div>
        {open && (
          <div>
            {value.items.length === 0 ? (
              <div className="py-0.5 italic text-zinc-600" style={{ paddingLeft: 8 + (depth + 1) * 16 + 12 }}>
                (empty)
              </div>
            ) : (
              value.items.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: 8 + (depth + 1) * 16 }}>
                  <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded bg-zinc-800 px-1 text-[10px] text-zinc-400">
                    {i}
                  </span>
                  <PrimitiveSpan value={item} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 py-0.5" style={pad}>
      <span className="w-3" />
      <span className="text-zinc-300">{name}</span>
      <span className="text-zinc-600">:</span>
      <PrimitiveSpan value={value} />
    </div>
  );
}

function PrimitiveSpan({ value }: { value: PreviewValue }) {
  if (value.kind === "error") return <span className="text-rose-400">⚠ {value.message}</span>;
  if (value.kind === "map") return <span className="text-zinc-600">{"{…}"}</span>;
  if (value.kind === "array") return <span className="text-zinc-600">[{value.items.length}]</span>;
  return <span className={cn(toneClass(value.tone))}>{value.display}</span>;
}

function toneClass(tone: string): string {
  switch (tone) {
    case "string": return "text-emerald-300";
    case "number": return "text-amber-300";
    case "boolean": return "text-sky-300";
    case "timestamp": return "text-violet-300";
    case "geopoint": return "text-pink-300";
    case "reference": return "text-cyan-300";
    case "bytes": return "text-orange-300";
    case "image": return "text-zinc-200";
    default: return "text-zinc-500";
  }
}

function buildPreviewEntries(
  nodes: FieldNode[],
  row: Record<string, unknown>,
  rowIndex: number,
  db: Firestore | null,
): Array<{ name: string; value: PreviewValue }> {
  const out: Array<{ name: string; value: PreviewValue }> = [];
  for (const node of nodes) {
    const name = node.name.trim();
    if (!name) continue;
    out.push({ name, value: buildPreviewValue(node, row, rowIndex, db) });
  }
  return out;
}

function buildPreviewValue(node: FieldNode, row: Record<string, unknown>, rowIndex: number, db: Firestore | null): PreviewValue {
  if (node.kind === "map") {
    return { kind: "map", entries: buildPreviewEntries(node.children, row, rowIndex, db) };
  }

  if (node.source.kind === "skip") {
    return { kind: "primitive", display: "(skipped)", typeLabel: "skip", tone: "null" };
  }

  if (node.source.kind === "now") {
    return {
      kind: "primitive",
      display: new Date().toLocaleString() + "  (server time)",
      typeLabel: "timestamp",
      tone: "timestamp",
    };
  }

  const raw = resolveSource(node.source, row, rowIndex);

  if (node.firestoreType === "image" && node.imageMode === "upload") {
    const res = coerceValue(raw, "image", { db, arrayElementType: node.arrayElementType });
    if (res.ok === false) return { kind: "error", message: res.error };
    const url = res.value === null ? "" : String(res.value);
    if (!url) return { kind: "primitive", display: "(empty)", typeLabel: "image", tone: "image" };
    return {
      kind: "primitive",
      display: `${url} → Storage URL on import`,
      typeLabel: "image",
      tone: "image",
    };
  }

  if (!db) {
    const fallback = raw === null || raw === undefined ? "(null)" : String(raw);
    return { kind: "primitive", display: fallback, typeLabel: node.firestoreType, tone: "null" };
  }

  const res = coerceValue(raw, node.firestoreType, { db, arrayElementType: node.arrayElementType });
  if (res.ok === false) return { kind: "error", message: res.error };

  return renderCoerced(res.value, node.firestoreType, node.arrayElementType);
}

function renderCoerced(value: unknown, type: string, elType?: string): PreviewValue {
  if (value === null || value === undefined) {
    return { kind: "primitive", display: "null", typeLabel: "null", tone: "null" };
  }
  if (type === "array" && Array.isArray(value)) {
    return {
      kind: "array",
      items: value.map((v) => renderCoerced(v, elType ?? "string")),
    };
  }
  if (type === "map" && typeof value === "object" && value !== null) {
    const entries: Array<{ name: string; value: PreviewValue }> = [];
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      entries.push({ name: k, value: renderCoerced(v, typeof v === "object" ? "map" : typeof v === "number" ? "number" : "string") });
    });
    return { kind: "map", entries };
  }
  if (type === "timestamp") {
    const d = value instanceof Date ? value : (value as { toDate?: () => Date }).toDate?.();
    return {
      kind: "primitive",
      display: d ? d.toLocaleString() : String(value),
      typeLabel: "timestamp",
      tone: "timestamp",
    };
  }
  if (type === "boolean") {
    return { kind: "primitive", display: String(value), typeLabel: "boolean", tone: "boolean" };
  }
  if (type === "number") {
    return { kind: "primitive", display: String(value), typeLabel: "number", tone: "number" };
  }
  if (type === "geopoint") {
    const gp = value as { latitude?: number; longitude?: number };
    return {
      kind: "primitive",
      display: `[${gp.latitude ?? "?"}, ${gp.longitude ?? "?"}]`,
      typeLabel: "geopoint",
      tone: "geopoint",
    };
  }
  if (type === "reference") {
    const ref = value as { path?: string };
    return { kind: "primitive", display: ref.path ?? String(value), typeLabel: "reference", tone: "reference" };
  }
  if (type === "bytes") {
    return { kind: "primitive", display: "‹bytes›", typeLabel: "bytes", tone: "bytes" };
  }
  if (type === "image") {
    return { kind: "primitive", display: `"${String(value)}"`, typeLabel: "image", tone: "image" };
  }
  if (type === "string_url") {
    return { kind: "primitive", display: `"${String(value)}"`, typeLabel: "string (url)", tone: "string" };
  }
  return { kind: "primitive", display: `"${String(value)}"`, typeLabel: "string", tone: "string" };
}