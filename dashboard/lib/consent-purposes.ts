export const CONSENT_PURPOSES = [
  "companion_mood_detection",
  "anonymous_analytics",
  "model_training",
  "data_selling",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export type ConsentStatus = "granted" | "denied" | "withdrawn";

export type ConsentPurposeMeta = {
  purpose: ConsentPurpose;
  title: string;
  description: string;
  requiredFor: string;
  regulations: string[];
  defaultStatus: ConsentStatus;
};

export const CONSENT_PURPOSE_META: Record<ConsentPurpose, ConsentPurposeMeta> = {
  companion_mood_detection: {
    purpose: "companion_mood_detection",
    title: "Companion mood on your dashboard",
    description:
      "Store mood labels and timestamps linked to your license so you can view timelines in your Buddie AI dashboard. No conversation text is ever stored.",
    requiredFor: "Personal analytics in your account",
    regulations: ["GDPR Art. 6(1)(a)", "EU AI Act transparency"],
    defaultStatus: "denied",
  },
  anonymous_analytics: {
    purpose: "anonymous_analytics",
    title: "Anonymous product analytics",
    description:
      "Contribute irreversibly hashed session tokens with mood labels and broad region (EU/US/Asia) to improve Buddy for everyone. Cannot be traced back to you.",
    requiredFor: "Aggregated trend analysis (Debiopwr)",
    regulations: ["GDPR Art. 6(1)(a)", "California SB 243 §22757"],
    defaultStatus: "denied",
  },
  model_training: {
    purpose: "model_training",
    title: "Emotional intelligence model training",
    description:
      "Use anonymized mood sequences to train on-device and cloud mood classifiers. Only mood labels and timestamps — never chat content.",
    requiredFor: "Smarter mood detection over time",
    regulations: ["GDPR Art. 6(1)(a)", "EU AI Act high-risk documentation"],
    defaultStatus: "denied",
  },
  data_selling: {
    purpose: "data_selling",
    title: "Licensed anonymized datasets (opt-in)",
    description:
      "Allow fully aggregated, k-anonymized mood datasets to be prepared as B2B data products. You may withdraw at any time; past sold sets remain governed by contract.",
    requiredFor: "Founder data products only — off by default",
    regulations: ["GDPR Art. 6(1)(a)", "China 2026 anthropomorphic AI rules (explicit consent)"],
    defaultStatus: "denied",
  },
};

export function isConsentPurpose(value: string): value is ConsentPurpose {
  return (CONSENT_PURPOSES as readonly string[]).includes(value);
}

export function isConsentStatus(value: string): value is ConsentStatus {
  return value === "granted" || value === "denied" || value === "withdrawn";
}
