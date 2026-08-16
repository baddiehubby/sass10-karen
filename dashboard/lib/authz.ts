/**
 * Authorization helpers — identity always comes from the verified session, never from client body.
 */

/** Reject empty / mismatched ownership (User A must not reach User B resources). */
export function assertResourceOwner(
  sessionUserId: string | null | undefined,
  resourceUserId: string | null | undefined,
): boolean {
  if (!sessionUserId || typeof sessionUserId !== "string") return false;
  if (!resourceUserId || typeof resourceUserId !== "string") return false;
  if (sessionUserId.length < 8 || resourceUserId.length < 8) return false;
  return sessionUserId === resourceUserId;
}

/** Ignore client-supplied userId fields — callers must use session identity only. */
export function rejectClientUserId(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    "userId" in record ||
    "user_id" in record ||
    "ownerId" in record ||
    "accountId" in record
  );
}

/** Cookie name for NextAuth session JWT (must match authOptions + middleware getToken). */
export function nextAuthSessionCookieName(isProduction = process.env.NODE_ENV === "production"): string {
  return isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

export function nextAuthSecureCookies(isProduction = process.env.NODE_ENV === "production"): boolean {
  return isProduction;
}
