/**
 * Product tiers shown on /pricing. Free is app-only (no Lemon Squeezy product).
 * Paid tiers map 1:1 to Lemon Squeezy variants via LEMONSQUEEZY_*_VARIANT_ID.
 */
export const PAID_CHECKOUT_TIERS = ["pro", "agency"] as const;
export type PaidCheckoutTier = (typeof PAID_CHECKOUT_TIERS)[number];

export function isPaidCheckoutTier(tier: string): tier is PaidCheckoutTier {
  return tier === "pro" || tier === "agency";
}

export const PRICING_TIERS = {
  free: {
    id: "free" as const,
    name: "Seeker",
    priceLabel: "$0",
    priceUsd: 0,
    subtitle: "forever",
    usesLemonSqueezy: false,
  },
  pro: {
    id: "pro" as const,
    name: "Disciple",
    priceLabel: "$19",
    priceUsd: 19,
    subtitle: "per month",
    usesLemonSqueezy: true,
  },
  agency: {
    id: "agency" as const,
    name: "Guru",
    priceLabel: "$99",
    priceUsd: 99,
    subtitle: "per month",
    usesLemonSqueezy: true,
  },
} as const;
