export type SoulInteraction =
  | "mood_shared"
  | "oracle_consulted"
  | "ritual_completed"
  | "memory_discovered"
  | "returned_home";

export type SoulMood = "curious" | "attentive" | "mystical" | "delighted" | "contemplative";

export type EvolutionStage = "awakening" | "familiar" | "companion" | "kindred" | "cosmic";

export type PublicAura = {
  className: string;
  particles: string;
  glow: string;
  customAura?: string;
  customRarity?: string;
};

export type PublicMemory = {
  id: string;
  verse: string;
  orbEcho: string;
  bornFromMood: string;
  discoveredAt: string | null;
  hidden: boolean;
};

export type PublicBond = {
  available: boolean;
  evolutionStage: EvolutionStage;
  stageLabel: string;
  buddyMood: SoulMood;
  energyLabel: "resting" | "present" | "vibrant";
  aura: PublicAura;
  hiddenMemories: number;
  moment: string | null;
  verse: string | null;
  memories?: PublicMemory[];
};
