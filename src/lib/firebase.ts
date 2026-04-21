import { initializeApp, FirebaseApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  Firestore,
  collection,
  getDocs,
  query,
  limit,
  Timestamp,
  GeoPoint,
  DocumentReference,
} from "firebase/firestore";

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

export type FirestoreFieldType =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "geopoint"
  | "reference"
  | "array"
  | "map"
  | "null"
  | "bytes";

export type FieldSchema = {
  name: string;
  type: FirestoreFieldType;
  sample?: unknown;
  seenIn: number;
};

export function detectType(v: unknown): FirestoreFieldType {
  if (v === null || v === undefined) return "null";
  if (v instanceof Timestamp) return "timestamp";
  if (v instanceof GeoPoint) return "geopoint";
  if (v instanceof DocumentReference) return "reference";
  if (v instanceof Uint8Array) return "bytes";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "string") return "string";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  if (t === "object") return "map";
  return "string";
}

export function validateConfig(c: Partial<FirebaseConfig>): string | null {
  if (!c.apiKey?.trim()) return "apiKey is required";
  if (!c.authDomain?.trim()) return "authDomain is required";
  if (!c.projectId?.trim()) return "projectId is required";
  return null;
}

export function initFirebase(config: FirebaseConfig): { app: FirebaseApp; db: Firestore } {
  const app = initializeApp(config, `importer-${Date.now()}`);
  const db = getFirestore(app);
  return { app, db };
}

export async function teardownFirebase(app: FirebaseApp) {
  try {
    await deleteApp(app);
  } catch {
    // noop
  }
}

export async function inferCollectionSchema(
  db: Firestore,
  collName: string,
  sampleSize = 20,
): Promise<{ docCount: number; fields: FieldSchema[] }> {
  const snap = await getDocs(query(collection(db, collName), limit(sampleSize)));
  const fields = new Map<string, FieldSchema>();
  snap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    Object.entries(data).forEach(([k, v]) => {
      const existing = fields.get(k);
      if (!existing) {
        fields.set(k, { name: k, type: detectType(v), sample: v, seenIn: 1 });
      } else {
        existing.seenIn += 1;
      }
    });
  });
  return {
    docCount: snap.size,
    fields: Array.from(fields.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export const LAST_CONFIG_KEY = "fb-importer:lastConfig";

export function saveLastConfig(c: FirebaseConfig) {
  try {
    localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(c));
  } catch {
    // noop
  }
}

export function loadLastConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as FirebaseConfig) : null;
  } catch {
    return null;
  }
}