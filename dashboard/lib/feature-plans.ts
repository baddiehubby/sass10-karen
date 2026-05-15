export type FeatureFlags = {
  customTheme: boolean;
  analytics: boolean;
  whiteLabel: boolean;
  voiceSync: boolean;
};

export const PLAN_FEATURES: Record<"free" | "pro" | "premium" | "agency", FeatureFlags> = {
  free: {
    customTheme: false,
    analytics: false,
    whiteLabel: false,
    voiceSync: false,
  },
  pro: {
    customTheme: true,
    analytics: true,
    whiteLabel: false,
    voiceSync: false,
  },
  premium: {
    customTheme: true,
    analytics: true,
    whiteLabel: true,
    voiceSync: true,
  },
  agency: {
    customTheme: true,
    analytics: true,
    whiteLabel: true,
    voiceSync: true,
  },
};

/** Tier reference prices (USD) used for pricing display/docs. */
export const PLAN_PRICE_USD: Record<"starter" | "agency" | "enterprise", number> = {
  starter: 49,
  agency: 149,
  enterprise: 499,
};

export function getFeatureByPlan(plan: string): FeatureFlags {
  const normalized = plan.trim().toLowerCase();
  if (normalized === "starter" || normalized === "pro" || normalized === "premium") {
    return PLAN_FEATURES.pro;
  }
  if (normalized === "agency" || normalized === "enterprise") {
    return PLAN_FEATURES.agency;
  }
  return PLAN_FEATURES.free;
}
