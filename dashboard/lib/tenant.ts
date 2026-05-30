export type CompanionType = "buddy" | "sachapandit";
export type TenantKey = CompanionType;

/** Host-based tenant slug used in cookies, headers, and routing. */
export type TenantSlug = "buddie" | "sachapandit";

export const TENANT_COOKIE = "x-tenant";
export const TENANT_HEADER = "x-tenant";

export type PersonaTraits = {
  wisdomLevel: number;
  sassLevel: number;
  mysteryLevel: number;
  warmthLevel: number;
  predictabilityIndex: number;
};

export type TenantPersona = {
  id: CompanionType;
  displayName: string;
  companionLabel: string;
  traits: PersonaTraits;
  moodPalette: Record<string, string>;
  signatureLine?: string;
};

export type TenantFeatures = {
  spiritualMode: boolean;
  holyMusic: boolean;
  divineHalo: boolean;
  predictions: boolean;
  ritualMode: boolean;
};

export type TenantConfig = {
  id: TenantKey;
  domain: string;
  name: string;
  theme: string;
  persona: string;
  features: TenantFeatures;
};

const DEFAULT_PERSONA: TenantPersona = {
  id: "buddy",
  displayName: "Buddy AI",
  companionLabel: "Buddy AI companion",
  traits: {
    wisdomLevel: 0.55,
    sassLevel: 0.1,
    mysteryLevel: 0.2,
    warmthLevel: 0.85,
    predictabilityIndex: 0.75,
  },
  moodPalette: {
    neutral: "Grounded",
    happy: "Joyful",
    thinking: "Reflective",
    concerned: "Protective",
    excited: "Sparked",
    sleepy: "Resting",
    zen: "Balanced",
    lit: "Radiant",
  },
};

export const TENANT_PERSONAS: Record<CompanionType, TenantPersona> = {
  buddy: DEFAULT_PERSONA,
  sachapandit: {
    id: "sachapandit",
    displayName: "Sacha Pandit",
    companionLabel: "Sacha Pandit presence",
    traits: {
      wisdomLevel: 0.85,
      sassLevel: 0.25,
      mysteryLevel: 0.7,
      warmthLevel: 0.9,
      predictabilityIndex: 0.4,
    },
    moodPalette: {
      neutral: "#D4A373",
      happy: "#F4A261",
      thinking: "#9C89B8",
      concerned: "#E76F51",
      excited: "#E9C46A",
      sleepy: "#8D99AE",
      zen: "#2A9D8F",
      lit: "#F77F00",
      divine: "#FFD700",
    },
    signatureLine: "You already know the answer, my friend. Why do you ask what your heart already knows?",
  },
};

export const TENANT_CONFIGS: Record<TenantKey, TenantConfig> = {
  buddy: {
    id: "buddy",
    domain: "www.buddieai.com",
    name: "Buddy AI",
    theme: "indigo-default",
    persona: "friendly-assistant",
    features: {
      spiritualMode: false,
      holyMusic: false,
      divineHalo: false,
      predictions: false,
      ritualMode: false,
    },
  },
  sachapandit: {
    id: "sachapandit",
    domain: "www.sachapandit.com",
    name: "Sacha Pandit",
    theme: "orange-spiritual",
    persona: "spiritual-guide",
    features: {
      spiritualMode: true,
      holyMusic: true,
      divineHalo: true,
      predictions: true,
      ritualMode: true,
    },
  },
};

export function normalizeCompanionType(input: unknown): CompanionType {
  return input === "sachapandit" ? "sachapandit" : "buddy";
}

export function resolveTenantPersona(input: unknown): TenantPersona {
  return TENANT_PERSONAS[normalizeCompanionType(input)];
}

/** Resolve tenant slug from hostname (buddieai.com → buddie, sachapandit.com → sachapandit). */
export function getTenant(hostname: string | null | undefined): TenantSlug {
  const host = String(hostname || "").toLowerCase();
  if (host.includes("buddieai.com")) return "buddie";
  if (host.includes("sachapandit.com")) return "sachapandit";
  return "buddie";
}

export function tenantSlugToKey(slug: TenantSlug): TenantKey {
  return slug === "sachapandit" ? "sachapandit" : "buddy";
}

export function resolveTenantByHost(hostname: string | null | undefined): TenantKey {
  return tenantSlugToKey(getTenant(hostname));
}

export function resolveTenantConfig(input: unknown): TenantConfig {
  return TENANT_CONFIGS[normalizeCompanionType(input)];
}
