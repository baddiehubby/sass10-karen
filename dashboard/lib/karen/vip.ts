/** Karen VIP — $19/month subscription monetization helpers. */

/**
 * Hard local VIP bypass (no Lemon Squeezy).
 * TEMPORARY: every non-production build is VIP — including NODE_ENV=development.
 * Also honors NEXT_PUBLIC_DEV_VIP_MODE / DEV_VIP_MODE.
 * Never enable in production.
 *
 * QA opt-out: set `NEXT_PUBLIC_KAREN_REAL_PAYWALL=true` (+ restart the dev server)
 * to turn the bypass OFF so the real paywall / Lemon Squeezy flow can be tested
 * in development. NEXT_PUBLIC_ so server AND client agree on the same answer.
 */
export function isDevVipMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NEXT_PUBLIC_KAREN_REAL_PAYWALL === "true") return false;
  // TEMPORARY LOCAL BYPASS — always VIP while developing.
  if (process.env.NODE_ENV === "development") return true;
  return (
    process.env.NEXT_PUBLIC_DEV_VIP_MODE === "true" ||
    process.env.DEV_VIP_MODE === "true"
  );
}

/** Prisma premium OR local DEV VIP bypass. */
export function resolveKarenPremium(userIsPremium?: boolean | null): boolean {
  // TEMPORARY LOCAL BYPASS — force premium in development regardless of Prisma.
  if (isDevVipMode()) return true;
  return Boolean(userIsPremium);
}

export const KAREN_VIP_PRICE_CENTS = 1900;
export const KAREN_VIP_PRICE_LABEL = "$19/month";
export const KAREN_UNLOCK_CTA = "Subscribe to Karen VIP — $19/month";

export const KAREN_VIP_ACCOUNTABILITY_HEADLINE = "Unlock your Daily Accountability Protocol.";

export const KAREN_VIP_ACCOUNTABILITY_CTA =
  "Subscribe to Karen VIP for $19/month to get daily verbal abuse, custom alarms, and the full 3D Rage Engine.";

/** Locked-feature modal when free users poke premium controls. */
export const KAREN_VIP_LOCKED_MODAL =
  "You think you deserve my help for free? Pay the $19.";

/**
 * HTTP 402 / Upgrade modal body — savage subscription paywall.
 */
export const KAREN_VIP_UPGRADE_MESSAGE =
  "You want more of me? Obviously. Unlock Savage Karen for $19/month.";

/** Q10 cliffhanger — spoken after 9 free roasts, then Lemon paywall. */
export const KAREN_CLIFFHANGER_LINE =
  "Alright, I've seen enough. I have your full psychological breakdown right here. But you didn't think I'd give it to you for free, did you? Pay the $19, and I'll tell you exactly why your life is a mess.";

/** Paywall modal copy right after the cliffhanger speech. */
export const KAREN_CLIFFHANGER_PAYWALL_MESSAGE =
  "I've already judged you for nine questions. Pay $19/month and I'll hand over the full psychological breakdown.";

/** Short glassmorphic modal headline. */
export const KAREN_VIP_MODAL_TITLE = "You want more of me? Obviously.";

/**
 * Faith Shatter → Prove Your Worth ultimatum ($20/mo Savage Protocol).
 * Lemon charges the configured Karen VIP variant — keep the product at $20.
 */
export const KAREN_FAITH_SHATTER_PRICE_CENTS = 2000;
export const KAREN_FAITH_SHATTER_PRICE_LABEL = "$20/month";
export const KAREN_FAITH_SHATTER_HEADLINE = "YOU FAILED THE VIP TEST.";
export const KAREN_FAITH_SHATTER_SUBTEXT =
  "I knew you were weak. But I'm willing to give you one more chance. Unlock the Savage Protocol for $20/month to prove you actually have a spine.";
export const KAREN_FAITH_SHATTER_CTA = "Accept the Challenge ($20)";
export const KAREN_FAITH_SHATTER_FOOTNOTE =
  "NO REFUNDS. NO MERCY. You are paying for the privilege of being coached by a Dajjal.";

/** Free users get 3 messages per UTC day (legacy chat), roast game is 1×/day. */
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

/**
 * Lemon Squeezy variant for Karen VIP ($19/mo subscription).
 * Dashboard: Products → Subscription → $19/month → paste variant ID.
 */
export function getKarenVipVariantId(): string {
  return (
    process.env.LEMONSQUEEZY_KAREN_VIP_VARIANT_ID?.trim() ||
    process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID?.trim() ||
    ""
  );
}

/** True when the Lemon variant is the Karen VIP subscription (or fallback). */
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
