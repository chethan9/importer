import type { NextApiRequest, NextApiResponse } from "next";
import { withAdmin, type ServiceAccountJson } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { serviceAccount, ops } = req.body as {
      serviceAccount: ServiceAccountJson;
      ops: Array<{ path: string; data: Record<string, unknown> }>;
    };
    const results = await withAdmin(serviceAccount, async (db) => {
      const out: Array<{ path: string; ok: boolean; error?: string }> = [];
      const batch = db.batch();
      for (const op of ops) batch.set(db.doc(op.path), op.data);
      try {
        await batch.commit();
        ops.forEach((op) => out.push({ path: op.path, ok: true }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Set failed";
        ops.forEach((op) => out.push({ path: op.path, ok: false, error: msg }));
      }
      return out;
    });
    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}