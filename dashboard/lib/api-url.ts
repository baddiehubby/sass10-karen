/**
 * Absolute API origin for Capacitor / mobile WebView clients.
 *
 * Set `NEXT_PUBLIC_API_URL` (preferred) or `NEXT_PUBLIC_APP_URL` to your
 * deployed Vercel origin, e.g. `https://www.buddieai.com`.
 *
 * Empty → same-origin relative paths (normal browser / hosted WebView).
 */
export function getPublicApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

/** Build an absolute or same-origin API URL (`/api/...`). */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getPublicApiBase();
  return base ? `${base}${normalized}` : normalized;
}
