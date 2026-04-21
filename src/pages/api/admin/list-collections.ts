import type { NextApiRequest, NextApiResponse } from "next";
import { withAdmin, type ServiceAccountJson } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { serviceAccount } = req.body as { serviceAccount: ServiceAccountJson };
    if (!serviceAccount) return res.status(400).json({ error: "Missing serviceAccount" });
    const collections = await withAdmin(serviceAccount, async (db) => {
      const cols = await db.listCollections();
      return cols.map((c) => c.id);
    });
    return res.status(200).json({ collections });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}