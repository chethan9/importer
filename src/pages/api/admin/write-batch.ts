import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { withAdmin, type ServiceAccountJson } from "@/lib/firebaseAdmin";

type DocOp = {
  docId?: string;
  data: Record<string, unknown>;
  mode: "create" | "merge";
};

// Recursively convert sentinel strings to FieldValue objects
function reviveSentinels(value: unknown): unknown {
  if (value === "__SERVER_TIMESTAMP__") return FieldValue.serverTimestamp();
  if (Array.isArray(value)) return value.map(reviveSentinels);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = reviveSentinels(v);
    }
    return out;
  }
  return value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { serviceAccount, collection, ops } = req.body as {
      serviceAccount: ServiceAccountJson;
      collection: string;
      ops: DocOp[];
    };

    const results = await withAdmin(serviceAccount, async (db) => {
      const out: Array<{ path: string; ok: boolean; error?: string }> = [];
      const batch = db.batch();
      const refs: FirebaseFirestore.DocumentReference[] = [];

      for (const op of ops) {
        const ref = op.docId
          ? db.collection(collection).doc(op.docId)
          : db.collection(collection).doc();
        const data = reviveSentinels(op.data) as Record<string, unknown>;
        if (op.mode === "merge") batch.set(ref, data, { merge: true });
        else batch.set(ref, data);
        refs.push(ref);
      }

      try {
        await batch.commit();
        refs.forEach((r) => out.push({ path: r.path, ok: true }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Batch failed";
        refs.forEach((r) => out.push({ path: r.path, ok: false, error: msg }));
      }
      return out;
    });

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}