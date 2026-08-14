/**
 * Living Buddy entitlements — server-side from License.plan only.
 * Commercial: Starter $20 / Pro $35 / Premium (Agency-class).
 * Internal "free" = provisional account license — not a marketed tier.
 */

export type LivingBuddyTier = "provisional" | "starter" | "pro" | "premium";

export type LivingBuddyEntitlements = {
  tier: LivingBuddyTier;
  label: string;
  moodHistoryDays: number;
  advancedOracle: boolean;
  richEvolution: boolean;
  premiumVisuals: boolean;
  memoryCapacity: number;
  sharePremium: boolean;
  /** Customer should subscribe — provisional account only */
  requiresSubscription: boolean;
};

export function livingBuddyTierFromPlan(plan: string): LivingBuddyTier {
  const p = plan.trim().toLowerCase();
  if (p === "agency" || p === "enterprise" || p === "premium") return "premium";
  if (p === "pro" || p === "growth") return "pro";
  if (p === "starter") return "starter";
  return "provisional";
}

export function entitlementsForPlan(plan: string): LivingBuddyEntitlements {
  const tier = livingBuddyTierFromPlan(plan);
  if (tier === "premium") {
    return {
      tier,
      label: "Premium",
      moodHistoryDays: 90,
      advancedOracle: true,
      richEvolution: true,
      premiumVisuals: true,
      memoryCapacity: 120,
      sharePremium: true,
      requiresSubscription: false,
    };
  }
  if (tier === "pro") {
    return {
      tier,
      label: "Pro",
      moodHistoryDays: 30,
      advancedOracle: true,
      richEvolution: true,
      premiumVisuals: true,
      memoryCapacity: 60,
      sharePremium: true,
      requiresSubscription: false,
    };
  }
  if (tier === "starter") {
    return {
      tier,
      label: "Starter",
      moodHistoryDays: 14,
      advancedOracle: false,
      richEvolution: true,
      premiumVisuals: false,
      memoryCapacity: 30,
      sharePremium: false,
      requiresSubscription: false,
    };
  }
  return {
    tier: "provisional",
    label: "Buddy account",
    moodHistoryDays: 7,
    advancedOracle: false,
    richEvolution: false,
    premiumVisuals: false,
    memoryCapacity: 14,
    sharePremium: false,
    requiresSubscription: true,
  };
}

export function entitlementsFromLicenses(
  licenses: Array<{ plan: string; expiresAt: Date | string; active?: boolean }>,
  isActive: (l: { plan: string; expiresAt: Date }) => boolean,
): LivingBuddyEntitlements {
  const rank: Record<LivingBuddyTier, number> = {
    provisional: 0,
    starter: 1,
    pro: 2,
    premium: 3,
  };
  let best = entitlementsForPlan("free");
  for (const row of licenses) {
    const expiresAt = typeof row.expiresAt === "string" ? new Date(row.expiresAt) : row.expiresAt;
    if (!isActive({ plan: row.plan, expiresAt })) continue;
    const next = entitlementsForPlan(row.plan);
    if (rank[next.tier] > rank[best.tier]) best = next;
  }
  return best;
}

export const TARGET_COMMERCIAL_TIERS = [
  { id: "starter", priceUsd: 20, status: "requires_lemon_variant" as const, env: "LEMONSQUEEZY_STARTER_VARIANT_ID" },
  { id: "pro", priceUsd: 35, status: "requires_lemon_variant" as const, env: "LEMONSQUEEZY_PRO_VARIANT_ID" },
  {
    id: "premium",
    priceUsd: 99,
    status: "requires_lemon_variant" as const,
    env: "LEMONSQUEEZY_PREMIUM_VARIANT_ID or LEMONSQUEEZY_AGENCY_VARIANT_ID",
  },
] as const;
