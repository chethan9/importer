import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { withAdmin, type ServiceAccountJson } from "@/lib/firebaseAdmin";

type DocOp = {
  docId?: string;
  data: Record<string, unknown>;
  merge: boolean;
  rowIndex: number;
};

function revive(db: FirebaseFirestore.Firestore, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => revive(db, v));
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const o = value as Record<string, unknown>;
    if (o.__type === "serverTimestamp") return FieldValue.serverTimestamp();
    if (o.__type === "ref" && typeof o.path === "string") return db.doc(o.path);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = revive(db, v);
    return out;
  }
  return value;
}

type ResultRow = {
  docId: string;
  action: "created" | "updated";
  preSnapshot: Record<string, unknown> | null;
  rowIndex: number;
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { serviceAccount, collection, ops, checkExisting } = req.body as {
      serviceAccount: ServiceAccountJson;
      collection: string;
      ops: DocOp[];
      checkExisting?: boolean;
    };

    const results = await withAdmin(serviceAccount, async (db) => {
      const out: ResultRow[] = [];
      const batch = db.batch();
      const queued: Array<{ ref: FirebaseFirestore.DocumentReference; op: DocOp; preSnapshot: Record<string, unknown> | null; action: "created" | "updated" }> = [];

      for (const op of ops) {
        const ref = op.docId
          ? db.collection(collection).doc(op.docId)
          : db.collection(collection).doc();

        let preSnapshot: Record<string, unknown> | null = null;
        let action: "created" | "updated" = "created";

        if (checkExisting && op.docId) {
          try {
            const snap = await ref.get();
            if (snap.exists) {
              preSnapshot = (snap.data() as Record<string, unknown>) ?? null;
              action = "updated";
            }
          } catch (err) {
            out.push({
              docId: ref.id,
              action: "created",
              preSnapshot: null,
              rowIndex: op.rowIndex,
              error: err instanceof Error ? err.message : "Pre-read failed",
            });
            continue;
          }
        }

        const data = revive(db, op.data) as Record<string, unknown>;
        if (op.merge) batch.set(ref, data, { merge: true });
        else batch.set(ref, data);
        queued.push({ ref, op, preSnapshot, action });
      }

      try {
        if (queued.length > 0) await batch.commit();
        queued.forEach((q) =>
          out.push({
            docId: q.ref.id,
            action: q.action,
            preSnapshot: q.preSnapshot,
            rowIndex: q.op.rowIndex,
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Batch commit failed";
        queued.forEach((q) =>
          out.push({
            docId: q.ref.id,
            action: q.action,
            preSnapshot: q.preSnapshot,
            rowIndex: q.op.rowIndex,
            error: msg,
          }),
        );
      }

      return out.sort((a, b) => a.rowIndex - b.rowIndex);
    });

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}