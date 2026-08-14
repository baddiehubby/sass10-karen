export type FeatureFlags = {
  customTheme: boolean;
  analytics: boolean;
  whiteLabel: boolean;
  voiceSync: boolean;
};

export const PLAN_FEATURES: Record<"free" | "starter" | "pro" | "premium" | "agency", FeatureFlags> = {
  free: {
    customTheme: false,
    analytics: false,
    whiteLabel: false,
    voiceSync: false,
  },
  starter: {
    customTheme: true,
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

/** Reference prices (USD) — must match Lemon products once configured. */
export const PLAN_PRICE_USD: Record<"starter" | "pro" | "premium", number> = {
  starter: 20,
  pro: 35,
  premium: 99,
};

export function getFeatureByPlan(plan: string): FeatureFlags {
  const normalized = plan.trim().toLowerCase();
  if (normalized === "starter") return PLAN_FEATURES.starter;
  if (normalized === "pro" || normalized === "growth") return PLAN_FEATURES.pro;
  if (normalized === "premium" || normalized === "agency" || normalized === "enterprise") {
    return PLAN_FEATURES.premium;
  }
  return PLAN_FEATURES.free;
}
