import { Timestamp, GeoPoint, Bytes, doc, Firestore, DocumentReference } from "firebase/firestore";

export type FirestoreType =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "geopoint"
  | "reference"
  | "array"
  | "map"
  | "null"
  | "bytes"
  /** Stored as a string URL in Firestore; optional import-time upload to Storage */
  | "image";

export type ArrayElementType = "string" | "number" | "boolean";

export const FIRESTORE_TYPES: { value: FirestoreType; label: string; hint: string }[] = [
  { value: "string", label: "String", hint: "Any text" },
  { value: "image", label: "Image URL", hint: "HTTP(S), including Drive share links — upload yields Storage token URL" },
  { value: "number", label: "Number", hint: "Integer or decimal" },
  { value: "boolean", label: "Boolean", hint: "true / false / 1 / 0 / yes / no" },
  { value: "timestamp", label: "Timestamp", hint: "ISO 8601 date or millis since epoch" },
  { value: "geopoint", label: "GeoPoint", hint: "Format: lat,lng" },
  { value: "reference", label: "Reference", hint: "Doc path: collection/docId" },
  { value: "array", label: "Array", hint: "JSON array or comma-separated values" },
  { value: "map", label: "Map (object)", hint: "JSON object" },
  { value: "null", label: "Null", hint: "Always stored as null" },
  { value: "bytes", label: "Bytes", hint: "Base64-encoded string" },
];

export type CoerceResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

export function coerceValue(
  raw: unknown,
  type: FirestoreType,
  opts: { db?: Firestore; arrayElementType?: ArrayElementType } = {},
): CoerceResult {
  if (type === "null") return { ok: true, value: null };

  if (isBlank(raw)) {
    return { ok: true, value: null };
  }

  const s = typeof raw === "string" ? raw.trim() : raw;

  try {
    switch (type) {
      case "string":
        return { ok: true, value: String(s) };

      case "image": {
        const urlStr = String(s).trim();
        if (!/^https?:\/\//i.test(urlStr)) {
          return { ok: false, error: `Image field expects an http(s) URL, got "${raw}"` };
        }
        try {
          new URL(urlStr);
        } catch {
          return { ok: false, error: `Invalid URL: "${raw}"` };
        }
        return { ok: true, value: urlStr };
      }

      case "number": {
        if (typeof s === "number") return { ok: true, value: s };
        const n = Number(s);
        if (Number.isNaN(n)) return { ok: false, error: `"${raw}" is not a valid number` };
        return { ok: true, value: n };
      }

      case "boolean": {
        if (typeof s === "boolean") return { ok: true, value: s };
        const t = String(s).toLowerCase();
        if (["true", "1", "yes", "y"].includes(t)) return { ok: true, value: true };
        if (["false", "0", "no", "n"].includes(t)) return { ok: true, value: false };
        return { ok: false, error: `"${raw}" is not a valid boolean (expected true/false/1/0/yes/no)` };
      }

      case "timestamp": {
        if (s instanceof Date) return { ok: true, value: Timestamp.fromDate(s) };
        if (typeof s === "number") return { ok: true, value: Timestamp.fromMillis(s) };
        const str = String(s);
        const asNum = Number(str);
        if (!Number.isNaN(asNum) && str.length >= 10) {
          const ms = str.length === 10 ? asNum * 1000 : asNum;
          return { ok: true, value: Timestamp.fromMillis(ms) };
        }
        const d = new Date(str);
        if (Number.isNaN(d.getTime())) return { ok: false, error: `"${raw}" is not a valid date` };
        return { ok: true, value: Timestamp.fromDate(d) };
      }

      case "geopoint": {
        const str = String(s);
        const parts = str.split(",").map((p) => p.trim());
        if (parts.length !== 2) return { ok: false, error: `GeoPoint must be "lat,lng", got "${raw}"` };
        const lat = Number(parts[0]);
        const lng = Number(parts[1]);
        if (Number.isNaN(lat) || Number.isNaN(lng))
          return { ok: false, error: `GeoPoint lat/lng must be numbers, got "${raw}"` };
        if (lat < -90 || lat > 90) return { ok: false, error: `Latitude ${lat} out of range` };
        if (lng < -180 || lng > 180) return { ok: false, error: `Longitude ${lng} out of range` };
        return { ok: true, value: new GeoPoint(lat, lng) };
      }

      case "reference": {
        if (!opts.db) return { ok: false, error: "Firestore not initialized" };
        const path = String(s).trim().replace(/^\/+|\/+$/g, "");
        const segments = path.split("/");
        if (segments.length < 2 || segments.length % 2 !== 0)
          return { ok: false, error: `Reference must be "collection/docId", got "${raw}"` };
        const ref: DocumentReference = doc(opts.db, path);
        return { ok: true, value: ref };
      }

      case "array": {
        const str = String(s).trim();
        let arr: unknown[];
        if (str.startsWith("[")) {
          try {
            const parsed = JSON.parse(str);
            if (!Array.isArray(parsed)) return { ok: false, error: "Value is not a JSON array" };
            arr = parsed;
          } catch {
            return { ok: false, error: `Invalid JSON array: "${raw}"` };
          }
        } else {
          arr = str.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
        }
        const elType = opts.arrayElementType ?? "string";
        const out: unknown[] = [];
        for (let i = 0; i < arr.length; i++) {
          const r = coerceValue(arr[i], elType as FirestoreType);
          if (r.ok === false) {
            return { ok: false, error: "Array item " + i + ": " + r.error };
          }
          out.push(r.value);
        }
        return { ok: true, value: out };
      }

      case "map": {
        if (typeof s === "object" && s !== null) return { ok: true, value: s };
        try {
          const parsed = JSON.parse(String(s));
          if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null)
            return { ok: false, error: "Map must be a JSON object" };
          return { ok: true, value: parsed };
        } catch {
          return { ok: false, error: `Invalid JSON object: "${raw}"` };
        }
      }

      case "bytes": {
        try {
          const bytes = Bytes.fromBase64String(String(s));
          return { ok: true, value: bytes };
        } catch {
          return { ok: false, error: `"${raw}" is not valid base64` };
        }
      }

      default:
        return { ok: false, error: `Unknown type ${type}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "coercion failed" };
  }
}

export function inferType(value: unknown): FirestoreType {
  if (value === null || value === undefined) return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^(true|false)$/i.test(s)) return "boolean";
    if (/^-?\d+(\.\d+)?$/.test(s) && s.length < 15) return "number";
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return "timestamp";
    if (/^https?:\/\/.+/i.test(s) && /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(s)) return "image";
    return "string";
  }
  if (typeof value === "object") return "map";
  return "string";
}

export function inferTypeFromSamples(values: unknown[]): FirestoreType {
  const nonBlank = values.filter((v) => !(v === null || v === undefined || (typeof v === "string" && v.trim() === "")));
  if (nonBlank.length === 0) return "string";

  const votes: Record<FirestoreType, number> = {
    string: 0, number: 0, boolean: 0, timestamp: 0, geopoint: 0,
    reference: 0, array: 0, map: 0, null: 0, bytes: 0, image: 0,
  };

  for (const v of nonBlank) {
    if (typeof v === "boolean") { votes.boolean++; continue; }
    if (typeof v === "number") { votes.number++; continue; }
    if (Array.isArray(v)) { votes.array++; continue; }
    if (typeof v === "object" && v !== null) { votes.map++; continue; }
    const s = String(v).trim();
    if (/^(true|false|yes|no)$/i.test(s)) { votes.boolean++; continue; }
    if (/^-?\d+(\.\d+)?$/.test(s) && s.length < 16) { votes.number++; continue; }
    if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(s)) { votes.timestamp++; continue; }
    if (/^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(s)) { votes.geopoint++; continue; }
    if (s.startsWith("[") && s.endsWith("]")) { votes.array++; continue; }
    if (s.startsWith("{") && s.endsWith("}")) { votes.map++; continue; }
    if (/^https?:\/\/.+/i.test(s) && /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(s)) { votes.image++; continue; }
    votes.string++;
  }

  const threshold = nonBlank.length * 0.8;
  const priority: FirestoreType[] = ["boolean", "number", "timestamp", "geopoint", "array", "map", "image", "string"];
  for (const t of priority) {
    if (votes[t] >= threshold) return t;
  }
  let best: FirestoreType = "string";
  let bestCount = -1;
  for (const t of priority) {
    if (votes[t] > bestCount) { bestCount = votes[t]; best = t; }
  }
  return best;
}

export function toAdminJSON(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) {
    return { __type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof GeoPoint) {
    return { __type: "geopoint", latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof DocumentReference) {
    return { __type: "ref", path: value.path };
  }
  if (value instanceof Bytes) {
    return { __type: "bytes", base64: value.toBase64() };
  }
  if (Array.isArray(value)) return value.map(toAdminJSON);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.__type === "string") return o;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = toAdminJSON(v);
    return out;
  }
  return value;
}