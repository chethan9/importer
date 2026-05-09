/** Firebase Storage bucket hostname only (no gs://), e.g. project.firebasestorage.app */

export function defaultBucketFromProjectId(projectId: string): string {
  const id = projectId.trim();
  if (!id) return "";
  return `${id}.firebasestorage.app`;
}

/** Safe object prefix: no leading slash, no path traversal */
export function sanitizeStorageFolder(input: string): string {
  const s = input
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "")
    .replace(/\/+/g, "/");
  if (!s) return "imports";
  return s;
}

const LS_BUCKET = "importer_storage_bucket_id";
const LS_FOLDER = "importer_storage_folder";

export function loadPersistedBucket(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(LS_BUCKET);
  return v?.trim() ? v.trim() : null;
}

export function loadPersistedFolder(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(LS_FOLDER);
  return v?.trim() ? v.trim() : null;
}

export function persistStoragePrefs(bucketId: string, folder: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_BUCKET, bucketId.trim());
  localStorage.setItem(LS_FOLDER, sanitizeStorageFolder(folder));
}
