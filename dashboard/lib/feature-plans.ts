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
export const PLAN_PRICE_USD: Record<"pro" | "agency", number> = {
  pro: 29,
  agency: 99,
};

export function getFeatureByPlan(plan: string): FeatureFlags {
  if (plan === "pro" || plan === "premium" || plan === "agency") return PLAN_FEATURES[plan];
  return PLAN_FEATURES.free;
}
