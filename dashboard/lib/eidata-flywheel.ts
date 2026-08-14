/** Target anonymized events before dataset is considered enterprise-ready. */
export const EIDATA_FLYWHEEL_EVENT_TARGET = 10_000;

/** Internal monetization notes for Debiopwr — not customer marketing copy. */
export const EIDATA_MONETIZATION_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "$20/mo",
    note: "Premium companion baseline — Living Buddy core experience.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$35/mo",
    note: "Deeper personalization + expanded insights where entitled.",
  },
  {
    id: "premium",
    name: "Premium",
    price: "$99/mo",
    note: "Highest personalization / white-label class features.",
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
