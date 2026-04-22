import type { FieldSchema, FirestoreFieldType } from "@/lib/firebase";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function flatten(obj: Record<string, unknown>, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v) && v.constructor === Object) {
      flatten(v as Record<string, unknown>, key, out);
    } else {
      out[key] = serializeValue(v);
    }
  }
  return out;
}

function serializeValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return JSON.stringify(v);
  // Handles Firestore Timestamp, GeoPoint, DocumentReference after JSON-like shaping
  const o = v as Record<string, unknown>;
  if (typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof o.latitude === "number" && typeof o.longitude === "number") return `${o.latitude},${o.longitude}`;
  if (typeof (v as { path?: string }).path === "string") return (v as { path: string }).path;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function placeholderFor(type: FirestoreFieldType): string {
  switch (type) {
    case "string": return "sample text";
    case "number": return "0";
    case "boolean": return "false";
    case "timestamp": return new Date().toISOString();
    case "geopoint": return "0,0";
    case "reference": return "collection/docId";
    case "array": return "[]";
    case "map": return "{}";
    case "null": return "";
    case "bytes": return "";
    default: return "";
  }
}

export function buildCsvFromSamples(samples: Record<string, unknown>[], fields: FieldSchema[]): string {
  const flatSamples = samples.map((s) => flatten(s));
  const headerSet = new Set<string>();
  flatSamples.forEach((s) => Object.keys(s).forEach((k) => headerSet.add(k)));
  // Ensure every schema top-level field is represented even if absent from samples
  fields.forEach((f) => { if (![...headerSet].some((h) => h === f.name || h.startsWith(f.name + "."))) headerSet.add(f.name); });
  const headers = [...headerSet];
  const lines = [headers.join(",")];

  if (flatSamples.length === 0) {
    // Single placeholder row based on schema
    const row = headers.map((h) => {
      const f = fields.find((x) => x.name === h);
      return csvEscape(placeholderFor(f?.type ?? "string"));
    });
    lines.push(row.join(","));
  } else {
    flatSamples.forEach((s) => {
      lines.push(headers.map((h) => csvEscape(s[h] ?? "")).join(","));
    });
  }
  return "\uFEFF" + lines.join("\n");
}

export function downloadCsvTemplate(collection: string, samples: Record<string, unknown>[], fields: FieldSchema[]) {
  const csv = buildCsvFromSamples(samples, fields);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = collection.replace(/[^a-z0-9_-]/gi, "_");
  a.href = url;
  a.download = `${safe}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}