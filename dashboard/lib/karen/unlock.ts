/**
 * Karen Roast Game — $2.99 one-time unlock (local + server entitlement).
 */

export const KAREN_UNLOCK_STORAGE_KEY = "karen.roast.unlocked";
export const KAREN_GUEST_ID_KEY = "karen.roast.guestId";

/** Query flag Lemon redirects with after a successful one-time checkout. */
export const KAREN_UNLOCK_QUERY = "karen";
export const KAREN_UNLOCK_QUERY_VALUE = "unlocked";

export function getOrCreateKarenGuestId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(KAREN_GUEST_ID_KEY)?.trim();
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KAREN_GUEST_ID_KEY, id);
    return id;
  } catch {
    return `guest_${Date.now()}`;
  }
}

export function hasLocalKarenUnlock(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KAREN_UNLOCK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLocalKarenUnlock(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KAREN_UNLOCK_STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function clearLocalKarenUnlock(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KAREN_UNLOCK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** True when Prisma premium OR local one-time unlock is present. */
export function hasKarenReportUnlock(isPremiumFromServer = false): boolean {
  return Boolean(isPremiumFromServer) || hasLocalKarenUnlock();
}

export function urlSignalsKarenUnlock(search: string | URLSearchParams): boolean {
  const params =
    typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;
  return params.get(KAREN_UNLOCK_QUERY) === KAREN_UNLOCK_QUERY_VALUE;
}
