/**
 * Safe post-auth redirects — never trust raw query returnUrl / callbackUrl.
 */

const SAFE_RELATIVE = /^\/(?!\/|\\|https?:)/i;

/** True for same-origin relative paths only (blocks //evil, /\evil, absolute URLs). */
export function isSafeRelativePath(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  const path = raw.trim();
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//") || path.startsWith("/\\")) return false;
  if (/^[\\/]{2,}/.test(path)) return false;
  if (/[\r\n\0]/.test(path)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path.slice(1))) return false;
  try {
    const u = new URL(path, "https://buddieai.invalid");
    if (u.hostname !== "buddieai.invalid") return false;
    if (u.username || u.password) return false;
  } catch {
    return false;
  }
  return SAFE_RELATIVE.test(path);
}

/** Sanitize client-supplied return/callback path; fallback if unsafe. */
export function safeAppPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (isSafeRelativePath(raw)) return raw!.trim();
  if (isSafeRelativePath(fallback)) return fallback;
  return "/dashboard";
}
