/**
 * Customer-facing Buddy AI plans — premium product, no marketed free tier.
 *
 * Commercial structure:
 *   STARTER  $20/month
 *   PRO      $35/month
 *   PREMIUM  higher tier (existing Agency-class Lemon product until renamed)
 *
 * Checkout maps 1:1 to Lemon variant env vars. Do not invent variant IDs.
 * Internal License.plan "free" may exist only for account bootstrap — never market it.
 */

export const PAID_CHECKOUT_TIERS = ["starter", "pro", "premium"] as const;
export type PaidCheckoutTier = (typeof PAID_CHECKOUT_TIERS)[number];

export function isPaidCheckoutTier(tier: string): tier is PaidCheckoutTier {
  return tier === "starter" || tier === "pro" || tier === "premium";
}

export type PricingTier = {
  id: PaidCheckoutTier;
  name: string;
  priceLabel: string;
  priceUsd: number;
  subtitle: string;
  usesLemonSqueezy: true;
  /** Env var that must hold the Lemon variant ID for live checkout */
  variantEnv: string;
  highlights: string[];
};

export const PRICING_TIERS: Record<PaidCheckoutTier, PricingTier> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceLabel: "$20",
    priceUsd: 20,
    subtitle: "per month",
    usesLemonSqueezy: true,
    variantEnv: "LEMONSQUEEZY_STARTER_VARIANT_ID",
    highlights: [
      "Living Orb companion",
      "Daily vibe rituals",
      "Mood Universe",
      "Basic memory constellation",
      "Core Oracle Realm",
      "Essential personalization",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "$35",
    priceUsd: 35,
    subtitle: "per month",
    usesLemonSqueezy: true,
    variantEnv: "LEMONSQUEEZY_PRO_VARIANT_ID",
    highlights: [
      "Everything in Starter",
      "Deeper personalization",
      "Expanded mood history",
      "Advanced Oracle reflections",
      "Richer evolution cosmetics",
      "Enhanced share cards",
    ],
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceLabel: "$99",
    priceUsd: 99,
    subtitle: "per month",
    usesLemonSqueezy: true,
    /** Prefer PREMIUM; Agency env is legacy alias until Lemon products are renamed */
    variantEnv: "LEMONSQUEEZY_PREMIUM_VARIANT_ID",
    highlights: [
      "Everything in Pro",
      "Highest personalization",
      "Premium visual worlds",
      "Maximum memory capacity",
      "Priority cosmetic unlocks",
      "White-label / advanced SaaS features where enabled",
    ],
  },
};

/** Ordered for pricing UI */
export const PRICING_TIER_LIST: PricingTier[] = [
  PRICING_TIERS.starter,
  PRICING_TIERS.pro,
  PRICING_TIERS.premium,
];
