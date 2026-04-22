import type { NextApiRequest, NextApiResponse } from "next";
import { withAdmin, resolveRefPath, type ServiceAccountJson } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const body = req.body as {
      serviceAccount: ServiceAccountJson;
      targetCollection?: string;
      collection?: string;
      matchField?: string;
      field?: string;
      matchValue?: unknown;
      value?: unknown;
    };
    const targetCollection = body.targetCollection ?? body.collection;
    const matchField = body.matchField ?? body.field;
    const matchValue = body.matchValue ?? body.value;
    if (!targetCollection || !matchField) {
      return res.status(400).json({ error: "collection and field required" });
    }
    const path = await withAdmin(body.serviceAccount, (db) =>
      resolveRefPath(db, targetCollection, matchField, matchValue),
    );
    return res.status(200).json({ path });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}