export type CompanionType = "buddy" | "sachapandit";

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

export function normalizeCompanionType(input: unknown): CompanionType {
  return input === "sachapandit" ? "sachapandit" : "buddy";
}

export function resolveTenantPersona(input: unknown): TenantPersona {
  return TENANT_PERSONAS[normalizeCompanionType(input)];
}
