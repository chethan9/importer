import type { NextApiRequest, NextApiResponse } from "next";
import { withAdmin, type ServiceAccountJson } from "@/lib/firebaseAdmin";

type Lookup = { collection: string; matchField: string; value: string };

function refKey(collection: string, field: string, value: string): string {
  return `${collection}\u0000${field}\u0000${value}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { serviceAccount, lookups } = req.body as {
      serviceAccount: ServiceAccountJson;
      lookups: Lookup[];
    };
    if (!Array.isArray(lookups) || lookups.length === 0) {
      return res.status(200).json({ paths: {} });
    }

    const paths = await withAdmin(serviceAccount, async (db) => {
      const result: Record<string, string> = {};

      const groups = new Map<string, { collection: string; matchField: string; values: Set<string> }>();
      for (const l of lookups) {
        if (!l.collection?.trim() || !l.matchField?.trim()) continue;
        const gkey = `${l.collection}\u0000${l.matchField}`;
        if (!groups.has(gkey)) {
          groups.set(gkey, { collection: l.collection, matchField: l.matchField, values: new Set() });
        }
        groups.get(gkey)!.values.add(l.value);
      }

      const CHUNK = 30;
      const tasks: Promise<void>[] = [];

      for (const g of groups.values()) {
        const uniqueValues = Array.from(g.values);
        for (let i = 0; i < uniqueValues.length; i += CHUNK) {
          const chunk = uniqueValues.slice(i, i + CHUNK);
          tasks.push(
            (async () => {
              try {
                const snap = await db
                  .collection(g.collection)
                  .where(g.matchField, "in", chunk)
                  .get();
                snap.forEach((docSnap) => {
                  const fieldVal = docSnap.get(g.matchField);
                  if (fieldVal === undefined || fieldVal === null) return;
                  const key = refKey(g.collection, g.matchField, String(fieldVal));
                  if (!result[key]) result[key] = docSnap.ref.path;
                });
              } catch (err) {
                console.warn("resolve-refs-batch chunk failed:", err);
              }
            })(),
          );
        }
      }

      await Promise.all(tasks);
      return result;
    });

    return res.status(200).json({ paths });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}