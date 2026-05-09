import type { FirebaseApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { FirebaseConfig } from "@/lib/firebase";
import type { ServiceAccount } from "@/services/adminFirestoreService";
import { proxiedImageFetchUrl } from "@/lib/imageFetchProxy";
import { resolveFetchableImageUrl } from "@/lib/imageSourceUrl";
import { defaultBucketFromProjectId, sanitizeStorageFolder } from "@/lib/storagePrefs";

export type PendingImageUploadMarker = { __type: "pendingImageUpload"; url: string };

export function isPendingImageMarker(v: unknown): v is PendingImageUploadMarker {
  return typeof v === "object" && v !== null && (v as { __type?: string }).__type === "pendingImageUpload";
}

function extensionFromUrl(url: string, contentType?: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const m = path.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
  } catch {
    /* noop */
  }
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  return "bin";
}

async function fetchRemoteImage(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const fetchUrl = proxiedImageFetchUrl(resolveFetchableImageUrl(url));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(fetchUrl, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    const head = new TextDecoder().decode(buf.slice(0, 64)).trimStart().toLowerCase();
    if (contentType.includes("text/html") || head.startsWith("<!doctype html") || head.startsWith("<html")) {
      throw new Error(
        "Download returned HTML instead of an image. Google Drive: use “Anyone with the link”, try Service account import, or use a direct image URL.",
      );
    }
    return { bytes: buf, contentType };
  } finally {
    clearTimeout(t);
  }
}

export async function uploadSourceUrlViaWeb(
  app: FirebaseApp,
  bucketHint: string | undefined,
  projectId: string,
  sourceUrl: string,
  folder = "imports",
): Promise<string> {
  const bucketName = bucketHint?.trim() || defaultBucketFromProjectId(projectId);
  const storage = getWebStorage(app, bucketName);
  const { bytes, contentType } = await fetchRemoteImage(sourceUrl);
  const ext = extensionFromUrl(sourceUrl, contentType);
  const prefix = sanitizeStorageFolder(folder);
  const path = `${prefix}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, bytes, { contentType });
  return getDownloadURL(r);
}

export async function uploadSourceUrlViaAdmin(
  serviceAccount: ServiceAccount,
  sourceUrl: string,
  opts?: { storageBucket?: string; folder?: string },
): Promise<string> {
  const res = await fetch("/api/admin/upload-image-from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceAccount,
      url: sourceUrl,
      storageBucket: opts?.storageBucket,
      folder: opts?.folder,
    }),
  });
  const j = (await res.json()) as { downloadUrl?: string; error?: string };
  if (!res.ok) throw new Error(j.error || "Upload failed");
  if (!j.downloadUrl) throw new Error("No download URL returned");
  return j.downloadUrl;
}

function getWebStorage(app: FirebaseApp, bucketHint: string | undefined) {
  return bucketHint?.trim()
    ? getStorage(app, `gs://${bucketHint.replace(/^gs:\/\//, "")}`)
    : getStorage(app);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(",");
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

/** Upload a file from the user’s device to the default Storage bucket (web SDK). */
export async function uploadLocalFileViaWeb(
  app: FirebaseApp,
  bucketHint: string | undefined,
  projectId: string,
  file: File,
  folder = "imports",
): Promise<string> {
  const bucketName = bucketHint?.trim() || defaultBucketFromProjectId(projectId);
  const storage = getWebStorage(app, bucketName);
  const name = file.name || "upload";
  const ext = name.includes(".") ? (name.split(".").pop() ?? "bin") : "bin";
  const prefix = sanitizeStorageFolder(folder);
  const path = `${prefix}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const r = ref(storage, path);
  const contentType = file.type || "application/octet-stream";
  await uploadBytes(r, file, { contentType });
  return getDownloadURL(r);
}

/** Upload raw bytes from the user’s device via the service account (server). */
export async function uploadLocalFileViaAdmin(
  serviceAccount: ServiceAccount,
  file: File,
  opts?: { storageBucket?: string; folder?: string },
): Promise<string> {
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("File is too large (max 25 MB)");
  }
  const base64 = await readFileAsBase64(file);
  const res = await fetch("/api/admin/upload-image-binary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceAccount,
      base64,
      contentType: file.type || "application/octet-stream",
      filename: file.name || "upload",
      storageBucket: opts?.storageBucket,
      folder: opts?.folder,
    }),
  });
  const j = (await res.json()) as { downloadUrl?: string; error?: string };
  if (!res.ok) throw new Error(j.error || "Upload failed");
  if (!j.downloadUrl) throw new Error("No download URL returned");
  return j.downloadUrl;
}

export function dataContainsPendingUploads(data: Record<string, unknown>): boolean {
  let found = false;
  function walk(o: unknown): void {
    if (found || o === null || typeof o !== "object") return;
    if (isPendingImageMarker(o)) {
      found = true;
      return;
    }
    if (Array.isArray(o)) {
      for (const item of o) walk(item);
      return;
    }
    for (const v of Object.values(o as Record<string, unknown>)) walk(v);
  }
  walk(data);
  return found;
}

export async function resolvePendingImagesDeep(
  data: Record<string, unknown>,
  resolveUrl: (url: string) => Promise<string>,
): Promise<void> {
  async function walk(o: unknown): Promise<void> {
    if (o === null || typeof o !== "object") return;
    if (Array.isArray(o)) {
      for (let i = 0; i < o.length; i++) {
        const item = o[i];
        if (isPendingImageMarker(item)) {
          o[i] = await resolveUrl(item.url);
        } else {
          await walk(item);
        }
      }
      return;
    }
    const rec = o as Record<string, unknown>;
    for (const k of Object.keys(rec)) {
      const v = rec[k];
      if (isPendingImageMarker(v)) {
        rec[k] = await resolveUrl(v.url);
      } else if (v !== null && typeof v === "object") {
        await walk(v);
      }
    }
  }
  await walk(data);
}

export async function resolvePendingImagesInRecord(
  data: Record<string, unknown>,
  opts: {
    authMode: "web" | "admin";
    app: FirebaseApp | null;
    fbConfig: FirebaseConfig | null;
    serviceAccount: ServiceAccount | null;
    /** Bucket hostname (no gs://). Uses Firebase Console Storage bucket name. */
    storageBucket?: string | null;
    /** Folder prefix inside the bucket (default imports) */
    storageFolder?: string;
  },
): Promise<void> {
  const memo = new Map<string, Promise<string>>();
  const folder = opts.storageFolder ?? "imports";
  const bucketForWeb =
    opts.storageBucket?.trim() || opts.fbConfig?.storageBucket?.trim() || null;

  async function resolveOne(url: string): Promise<string> {
    const existing = memo.get(url);
    if (existing) return existing;
    const p = (async () => {
      if (opts.authMode === "admin") {
        if (!opts.serviceAccount) throw new Error("Service account required for Storage upload");
        return uploadSourceUrlViaAdmin(opts.serviceAccount, url, {
          storageBucket: opts.storageBucket ?? undefined,
          folder,
        });
      }
      if (!opts.app || !opts.fbConfig?.projectId) throw new Error("Firebase app required for Storage upload");
      return uploadSourceUrlViaWeb(opts.app, bucketForWeb ?? undefined, opts.fbConfig.projectId, url, folder);
    })();
    memo.set(url, p);
    return p;
  }

  await resolvePendingImagesDeep(data, resolveOne);
}
