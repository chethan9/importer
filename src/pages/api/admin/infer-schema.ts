import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";
import { withAdmin, type ServiceAccountJson } from "@/lib/firebaseAdmin";

function detectType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value instanceof Timestamp) return "timestamp";
  if (value instanceof GeoPoint) return "geopoint";
  if (value instanceof DocumentReference) return "reference";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "map";
  return typeof value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { serviceAccount, collection } = req.body as {
      serviceAccount: ServiceAccountJson;
      collection: string;
    };
    if (!serviceAccount || !collection) return res.status(400).json({ error: "Missing params" });

    const result = await withAdmin(serviceAccount, async (db) => {
      const countSnap = await db.collection(collection).count().get();
      const docCount = countSnap.data().count;
      const sampleSnap = await db.collection(collection).limit(20).get();
      const fieldMap = new Map<string, Set<string>>();
      sampleSnap.forEach((doc) => {
        const data = doc.data();
        Object.entries(data).forEach(([k, v]) => {
          const set = fieldMap.get(k) ?? new Set<string>();
          set.add(detectType(v));
          fieldMap.set(k, set);
        });
      });
      const fields = Array.from(fieldMap.entries()).map(([name, types]) => ({
        name,
        types: Array.from(types),
      }));
      return { docCount, fields };
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}