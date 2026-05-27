/** Target anonymized events before dataset is considered enterprise-ready. */
export const EIDATA_FLYWHEEL_EVENT_TARGET = 10_000;

export const EIDATA_MONETIZATION_TIERS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    note: "Companion + optional anonymized analytics opt-in (value exchange explained in-widget).",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29/mo",
    note: "Premium companion + personal emotional insights on your dashboard.",
  },
  {
    id: "enterprise",
    name: "Enterprise data licensing",
    price: "Custom",
    note: "k-anonymized mood aggregates only — requires data_selling consent cohort + Debiopwr export.",
  },
  {
    id: "api",
    name: "EI API",
    price: "Custom",
    note: "Third-party platforms integrate Buddie emotional intelligence layer.",
  },
] as const;

export function flywheelProgressPercent(eventCount: number, target = EIDATA_FLYWHEEL_EVENT_TARGET): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((eventCount / target) * 100));
}
