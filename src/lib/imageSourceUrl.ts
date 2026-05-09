/**
 * Normalizes common “sharing” URLs into something we can GET as raw bytes.
 * Output field values after upload remain Firebase Storage URLs:
 * https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={uuid}
 */

/** Google Drive file ID from /file/d/{id}/ or similar */
const DRIVE_FILE_PATH_RE = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_OPEN_RE = /drive\.google\.com\/open\?([^#]*&)?id=([a-zA-Z0-9_-]+)/;

export function resolveFetchableImageUrl(raw: string): string {
  const input = raw.trim();
  if (!input) return input;

  const pathMatch = input.match(DRIVE_FILE_PATH_RE);
  if (pathMatch) {
    const id = pathMatch[1];
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }

  const openMatch = input.match(DRIVE_OPEN_RE);
  if (openMatch) {
    const id = openMatch[2];
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }

  try {
    const u = new URL(input);
    if (u.hostname === "drive.google.com" && u.searchParams.get("id")) {
      const id = u.searchParams.get("id");
      if (id && /^[a-zA-Z0-9_-]+$/.test(id)) {
        return `https://drive.google.com/uc?export=download&id=${id}`;
      }
    }
  } catch {
    /* keep original */
  }

  return input;
}
