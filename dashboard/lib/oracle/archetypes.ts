import type { BuddyMood } from "@/lib/companion-mood";

export type OracleArchetype = {
  id: string;
  sign: string;
  energy: string;
};

export const ARCHETYPES: Record<BuddyMood, OracleArchetype> = {
  neutral: { id: "still-water", sign: "the Quiet Horizon", energy: "unwritten" },
  calm: { id: "harbor", sign: "the Soft Tide", energy: "steady" },
  happy: { id: "lantern", sign: "the Open Window", energy: "bright" },
  excited: { id: "spark", sign: "the Rising Spark", energy: "electric" },
  sad: { id: "rain", sign: "the Low Cloud", energy: "tender" },
  anxious: { id: "thread", sign: "the Tight Thread", energy: "alert" },
  angry: { id: "ember", sign: "the Held Ember", energy: "charged" },
  tired: { id: "dusk", sign: "the Long Dusk", energy: "quiet" },
  lonely: { id: "echo", sign: "the Distant Echo", energy: "searching" },
  hopeful: { id: "dawn", sign: "the First Light", energy: "opening" },
  curious: { id: "map", sign: "the Unfinished Map", energy: "wandering" },
  loving: { id: "hearth", sign: "the Warm Hearth", energy: "connected" },
  playful: { id: "orbit", sign: "the Playful Orbit", energy: "light" },
};
