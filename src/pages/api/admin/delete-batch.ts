import type { NextApiRequest, NextApiResponse } from "next";
import { withAdmin, type ServiceAccountJson } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { serviceAccount, paths } = req.body as {
      serviceAccount: ServiceAccountJson;
      paths: string[];
    };
    const results = await withAdmin(serviceAccount, async (db) => {
      const out: Array<{ path: string; ok: boolean; error?: string }> = [];
      const batch = db.batch();
      for (const p of paths) batch.delete(db.doc(p));
      try {
        await batch.commit();
        paths.forEach((p) => out.push({ path: p, ok: true }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Delete failed";
        paths.forEach((p) => out.push({ path: p, ok: false, error: msg }));
      }
      return out;
    });
    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}