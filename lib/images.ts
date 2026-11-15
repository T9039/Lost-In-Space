/**
 * Browser-loadable image sources.
 *
 * Remote NASA assets go through `/api/image` so the server controls the
 * allowlist, caching and user agent. Local bundle paths are returned as-is.
 */

const ALLOWED_HOSTS = new Set(["images-assets.nasa.gov", "nssdc.gsfc.nasa.gov"]);

export function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function imageProxySrc(value: string): string {
  return isAllowedImageUrl(value) ? `/api/image?url=${encodeURIComponent(value)}` : value;
}
