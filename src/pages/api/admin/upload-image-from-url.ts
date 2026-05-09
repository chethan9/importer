import type { NextApiRequest, NextApiResponse } from "next";
import { initializeApp, cert, deleteApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import type { ServiceAccountJson } from "@/lib/firebaseAdmin";
import { proxiedImageFetchUrl } from "@/lib/imageFetchProxy";
import { resolveFetchableImageUrl } from "@/lib/imageSourceUrl";
import { sanitizeStorageFolder } from "@/lib/storagePrefs";
import { randomUUID } from "crypto";

function extFromUrl(url: string, contentType: string): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
  } catch {
    /* noop */
  }
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
    const { serviceAccount, url, storageBucket, folder } = req.body as {
      serviceAccount: ServiceAccountJson;
      url: string;
      storageBucket?: string;
      folder?: string;
    };
    if (!serviceAccount?.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      return res.status(400).json({ error: "Invalid service account" });
    }
    const src = typeof url === "string" ? url.trim() : "";
    if (!src || !/^https?:\/\//i.test(src)) {
      return res.status(400).json({ error: "A valid http(s) image URL is required" });
    }

    const fetchUrl = proxiedImageFetchUrl(resolveFetchableImageUrl(src));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    let fetchRes: Response;
    try {
      fetchRes = await fetch(fetchUrl, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!fetchRes.ok) return res.status(400).json({ error: `Could not fetch URL (${fetchRes.status})` });

    const buf = Buffer.from(await fetchRes.arrayBuffer());
    const contentType = fetchRes.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";

    const head = buf.slice(0, 64).toString("utf8").trimStart().toLowerCase();
    if (contentType.includes("text/html") || head.startsWith("<!doctype html") || head.startsWith("<html")) {
      return res.status(400).json({
        error:
          "The URL returned HTML, not image bytes. For Google Drive: set sharing to “Anyone with the link”, prefer Service account import, or use a direct HTTPS image URL.",
      });
    }

    const bucketId =
      typeof storageBucket === "string" && storageBucket.trim()
        ? storageBucket.trim()
        : `${serviceAccount.project_id}.firebasestorage.app`;
    const prefix = sanitizeStorageFolder(typeof folder === "string" ? folder : "imports");

    const appName = `img-upload-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const app = initializeApp(
      {
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
        }),
        projectId: serviceAccount.project_id,
      },
      appName,
    );

    try {
      const bucket = getStorage(app).bucket(bucketId);
      const ext = extFromUrl(src, contentType);
      const objectPath = `${prefix}/${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
      const token = randomUUID();
      const file = bucket.file(objectPath);
      await file.save(buf, {
        metadata: {
          contentType,
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
