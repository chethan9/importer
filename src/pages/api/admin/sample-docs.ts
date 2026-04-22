import type { NextApiRequest, NextApiResponse } from "next";
import { withAdmin, type ServiceAccount } from "@/lib/firebaseAdmin";

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { serviceAccount, collection, limit = 2 } = req.body as {
    serviceAccount?: ServiceAccount;
    collection?: string;
    limit?: number;
  };
  if (!serviceAccount || !collection) return res.status(400).json({ error: "serviceAccount and collection required" });
  try {
    const docs = await withAdmin(serviceAccount, async (app, db) => {
      const snap = await db.collection(collection).limit(Math.min(5, limit)).get();
      return snap.docs.map((d) => serializeForJson(d.data()));
    });
    return res.status(200).json({ docs });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}

function serializeForJson(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(serializeForJson);
  const o = v as Record<string, unknown>;
  if (typeof (o as { toDate?: () => Date }).toDate === "function") {
    return (o as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof o.latitude === "number" && typeof o.longitude === "number" && Object.keys(o).length <= 3) {
    return { latitude: o.latitude, longitude: o.longitude };
  }
  if (typeof (o as { path?: string }).path === "string" && typeof (o as { id?: string }).id === "string") {
    return { path: (o as { path: string }).path };
  }
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(o)) out[k] = serializeForJson(val);
  return out;
}