/**
 * Trusted client IP for rate limiting.
 * Never trust the leftmost X-Forwarded-For (client-spoofable).
 */

export function getTrustedClientIp(req: {
  headers: { get(name: string): string | null };
  ip?: string | null;
}): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);

  const vercel = req.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }

  // Platform-appended chain: rightmost hop is closest to our edge
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const parts = xf
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts[parts.length - 1]!.slice(0, 64);
  }

  if (req.ip) return String(req.ip).slice(0, 64);
  return "unknown";
}

