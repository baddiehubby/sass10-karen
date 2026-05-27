/** Regulatory framing for the Emotional Intelligence Data Layer (founder + user copy). */

export const EIDATA_POLICY_VERSION = "2026-05-27";

export const EIDATA_NEVER_COLLECT = [
  "Raw conversation or prompt text",
  "User names, emails, or IP addresses in the anonymized layer",
  "Biometric identifiers",
  "Precise geolocation",
] as const;

export const EIDATA_ALWAYS_COLLECT_WITH_CONSENT = [
  "Mood label (e.g. happy, concerned)",
  "Timestamp (UTC)",
  "Irreversible hashed session token",
  "Broad region bucket (EU / US / Asia / Other)",
  "Source platform bucket (ChatGPT, Claude, Gemini, website)",
] as const;

export const REGULATORY_FRAMEWORKS = [
  {
    id: "gdpr",
    name: "GDPR",
    summary: "Lawful basis via explicit consent per purpose; withdrawal honored immediately for future processing.",
  },
  {
    id: "eu-ai-act",
    name: "EU AI Act",
    summary: "Transparency for emotion recognition; human oversight; no high-risk profiling without DPIA.",
  },
  {
    id: "sb243",
    name: "California SB 243",
    summary: "Companion services must disclose emotion inference; minors require parental consent (not implemented in-widget).",
  },
  {
    id: "china-2026",
    name: "China 2026 AI Anthropomorphic Rules",
    summary: "Explicit consent for anthropomorphic interaction data; data_selling purpose gated off by default.",
  },
] as const;
