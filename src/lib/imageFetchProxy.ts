/**
 * Routes outbound image downloads through Vizsoft proxy to reduce origin egress cost.
 * - NEXT_PUBLIC_IMAGE_FETCH_PROXY — base URL (default https://proxy.vizsoft.in)
 * - NEXT_PUBLIC_IMAGE_FETCH_PROXY_TEMPLATE — optional; must contain `{url}` for encoded target, e.g. `https://proxy.vizsoft.in/proxy?u={url}`
 */

const DEFAULT_PROXY = "https://proxy.vizsoft.in";

function proxyBase(): string {
  const raw = typeof process !== "undefined" && process.env.NEXT_PUBLIC_IMAGE_FETCH_PROXY?.trim();
  return raw || DEFAULT_PROXY;
}

function proxyTemplate(): string | undefined {
  const t = typeof process !== "undefined" && process.env.NEXT_PUBLIC_IMAGE_FETCH_PROXY_TEMPLATE?.trim();
  return t?.includes("{url}") ? t : undefined;
}

/** Returns true if this URL should not be wrapped (already proxied, non-remote, etc.). */
function shouldSkipProxy(targetUrl: string): boolean {
  const s = targetUrl.trim();
  if (!s || s.startsWith("blob:") || s.startsWith("data:")) return true;
  try {
    const base = new URL(proxyBase());
    const u = new URL(s);
    if (u.origin === base.origin) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Wraps a remote http(s) URL so `fetch` goes through the proxy.
 * Expects proxy to accept the target as `?url=` (standard fetch-through-proxy pattern).
 */
export function proxiedImageFetchUrl(targetUrl: string): string {
  const resolved = targetUrl.trim();
  if (shouldSkipProxy(resolved)) return resolved;

  const encoded = encodeURIComponent(resolved);
  const tmpl = proxyTemplate();
  if (tmpl) return tmpl.replace("{url}", encoded);

  const base = proxyBase().replace(/\/+$/, "");
  return `${base}/?url=${encoded}`;
}
