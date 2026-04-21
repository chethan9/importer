import type { NextApiRequest, NextApiResponse } from "next";
import { withAdmin, resolveRefPath, type ServiceAccountJson } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { serviceAccount, targetCollection, matchField, matchValue } = req.body as {
      serviceAccount: ServiceAccountJson;
      targetCollection: string;
      matchField: string;
      matchValue: unknown;
    };
    const path = await withAdmin(serviceAccount, (db) =>
      resolveRefPath(db, targetCollection, matchField, matchValue),
    );
    return res.status(200).json({ path });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}