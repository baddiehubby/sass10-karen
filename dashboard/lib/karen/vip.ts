/** Karen VIP ($19/mo) monetization helpers. */

export const KAREN_VIP_PRICE_LABEL = "$19/month";

/**
 * HTTP 402 / Upgrade modal body — savage paywall line.
 * (UI headline can still say “Unlock Savage Karen for $19/month.”)
 */
export const KAREN_VIP_UPGRADE_MESSAGE =
  "You want the real me? The savage version? It costs $19. Pay up or get out.";

/** Short glassmorphic modal headline. */
export const KAREN_VIP_MODAL_TITLE = "Unlock Savage Karen for $19/month.";

/** Free users get 3 messages per UTC day, then hard paywall. */
export const KAREN_FREE_MESSAGE_LIMIT = 3;

/** @deprecated Alias — free quota is daily. */
export const KAREN_FREE_DAILY_LIMIT = KAREN_FREE_MESSAGE_LIMIT;

export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Effective free-tier message count for today (resets when the UTC day rolls).
 */
export function karenFreeMessagesUsedToday(user: {
  karenChatCount?: number | null;
  karenChatDay?: string | null;
}): number {
  const day = utcDayKey();
  if ((user.karenChatDay || "") !== day) return 0;
  return Math.max(0, user.karenChatCount ?? 0);
}

export function getKarenVipVariantId(): string {
  return (
    process.env.LEMONSQUEEZY_KAREN_VIP_VARIANT_ID?.trim() ||
    process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID?.trim() ||
    ""
  );
}

/** True when the Lemon variant is the Karen VIP product (or fallback premium variant). */
export function isKarenVipVariant(variantId: string | number | null | undefined): boolean {
  const id = String(variantId ?? "").trim();
  if (!id) return false;
  const vip = process.env.LEMONSQUEEZY_KAREN_VIP_VARIANT_ID?.trim();
  if (vip && id === vip) return true;
  if (!vip) {
    const premium = process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID?.trim();
    return Boolean(premium && id === premium);
  }
  return false;
}
