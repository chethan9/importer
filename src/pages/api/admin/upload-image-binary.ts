import type { NextApiRequest, NextApiResponse } from "next";
import { initializeApp, cert, deleteApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import type { ServiceAccountJson } from "@/lib/firebaseAdmin";
import { randomUUID } from "crypto";

const MAX_BYTES = 25 * 1024 * 1024;

function extFromFilename(filename: string, contentType: string): string {
  const m = filename.match(/\.([a-z0-9]+)$/i);
  if (m) return m[1].toLowerCase();
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("svg")) return "svg";
  return "bin";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { serviceAccount, base64, contentType, filename } = req.body as {
      serviceAccount: ServiceAccountJson;
      base64: string;
      contentType?: string;
      filename?: string;
    };

    if (!serviceAccount?.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      return res.status(400).json({ error: "Invalid service account" });
    }
    if (!base64 || typeof base64 !== "string") {
      return res.status(400).json({ error: "Missing base64 body" });
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(base64, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid base64" });
    }

    if (buf.length === 0) return res.status(400).json({ error: "Empty file" });
    if (buf.length > MAX_BYTES) return res.status(400).json({ error: `File too large (max ${MAX_BYTES / (1024 * 1024)} MB)` });

    const ct = (contentType && contentType.trim()) || "application/octet-stream";
    const fname = typeof filename === "string" && filename.trim() ? filename.trim() : "upload.bin";

    const appName = `img-bin-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const app = initializeApp(
      {
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
        }),
        projectId: serviceAccount.project_id,
        storageBucket: `${serviceAccount.project_id}.appspot.com`,
      },
      appName,
    );

    try {
      const bucket = getStorage(app).bucket();
      const ext = extFromFilename(fname, ct);
      const objectPath = `imports/${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
      const token = randomUUID();
      const file = bucket.file(objectPath);
      await file.save(buf, {
        metadata: {
          contentType: ct,
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });
      const encoded = encodeURIComponent(objectPath);
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;
      return res.status(200).json({ downloadUrl });
    } finally {
      await deleteApp(app);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return res.status(500).json({ error: msg });
  }
}
