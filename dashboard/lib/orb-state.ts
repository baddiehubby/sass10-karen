/**
 * Orb visual state — Mood × Interaction × Energy × Evolution × Theme × Personality
 * Derived CSS/tokens only. No clinical claims.
 */

import type { AnimationPersonality, AuraId } from "@/lib/buddy-identity";
import type { BuddyMood } from "@/lib/companion-mood";
import type { UniverseWorld } from "@/lib/universe-flags";
import type { EvolutionStage } from "@/lib/buddy-soul-types";

export type OrbInteraction =
  | "idle"
  | "listening"
  | "thinking"
  | "responding"
  | "playful"
  | "curious"
  | "comforting"
  | "excited"
  | "oracle";

export type OrbEnergy = "resting" | "present" | "vibrant";

export type OrbVisualInput = {
  mood: BuddyMood;
  interaction?: OrbInteraction;
  energy?: OrbEnergy;
  evolution?: EvolutionStage | string;
  aura?: AuraId;
  animation?: AnimationPersonality;
  world?: UniverseWorld;
  seasonal?: string;
  valence?: number;
  arousal?: number;
};

export type OrbVisualState = {
  className: string;
  styleVars: Record<string, string>;
  ariaDescription: string;
  particleLevel: 0 | 1 | 2 | 3;
  pulseScale: number;
};

const MOOD_PALETTE: Record<BuddyMood, { hue: string; glow: string; speed: string; drift: string }> = {
  neutral: { hue: "#7c8cff", glow: "rgba(124,140,255,0.42)", speed: "7.2s", drift: "18s" },
  calm: { hue: "#6ee7d8", glow: "rgba(110,231,216,0.4)", speed: "9s", drift: "22s" },
  happy: { hue: "#fbbf24", glow: "rgba(251,191,36,0.45)", speed: "6.2s", drift: "14s" },
  excited: { hue: "#fb7185", glow: "rgba(251,113,133,0.5)", speed: "4.2s", drift: "10s" },
  sad: { hue: "#64748b", glow: "rgba(100,116,139,0.35)", speed: "11s", drift: "26s" },
  anxious: { hue: "#c4b5fd", glow: "rgba(196,181,253,0.4)", speed: "5.1s", drift: "9s" },
  angry: { hue: "#f97316", glow: "rgba(249,115,22,0.45)", speed: "4.8s", drift: "11s" },
  tired: { hue: "#94a3b8", glow: "rgba(148,163,184,0.28)", speed: "12s", drift: "28s" },
  lonely: { hue: "#818cf8", glow: "rgba(129,140,248,0.32)", speed: "10s", drift: "24s" },
  hopeful: { hue: "#34d399", glow: "rgba(52,211,153,0.42)", speed: "7.4s", drift: "16s" },
  curious: { hue: "#22d3ee", glow: "rgba(34,211,238,0.42)", speed: "6.4s", drift: "15s" },
  loving: { hue: "#f472b6", glow: "rgba(244,114,182,0.46)", speed: "7.8s", drift: "17s" },
  playful: { hue: "#a3e635", glow: "rgba(163,230,53,0.42)", speed: "5.4s", drift: "12s" },
};

const EVOLUTION_CLASS: Record<string, string> = {
  awakening: "orb-awakening",
  familiar: "orb-familiar",
  companion: "orb-companion",
  kindred: "orb-kindred",
  cosmic: "orb-cosmic",
};

function interactionPulse(interaction: OrbInteraction): number {
  switch (interaction) {
    case "excited":
    case "playful":
      return 1.08;
    case "responding":
    case "thinking":
      return 1.05;
    case "oracle":
      return 1.04;
    case "comforting":
    case "listening":
      return 1.02;
    default:
      return 1;
  }
}

function particleLevel(aura: AuraId | undefined, energy: OrbEnergy, interaction: OrbInteraction): 0 | 1 | 2 | 3 {
  if (interaction === "oracle" || aura === "deep-field" || aura === "constellation") return 3;
  if (aura === "aurora" || energy === "vibrant" || interaction === "excited") return 2;
  if (energy === "resting" || interaction === "comforting") return 1;
  return 2;
}

export function deriveOrbVisualState(input: OrbVisualInput, opts?: { reducedMotion?: boolean; hidden?: boolean }): OrbVisualState {
  const mood = input.mood;
  const interaction = input.interaction ?? "idle";
  const energy = input.energy ?? "present";
  const aura = input.aura ?? "ember";
  const animation = input.animation ?? "soft";
  const world = input.world ?? "buddy";
  const palette = MOOD_PALETTE[mood] ?? MOOD_PALETTE.neutral;
  const still = Boolean(opts?.reducedMotion || opts?.hidden || animation === "still-glow");

  let speed = palette.speed;
  let drift = palette.drift;
  if (animation === "playful" || interaction === "playful" || interaction === "excited") {
    speed = "4.6s";
    drift = "9s";
  }
  if (interaction === "thinking") speed = "5.5s";
  if (interaction === "comforting" || energy === "resting") {
    speed = "10s";
    drift = "24s";
  }
  if (typeof input.arousal === "number") {
    const a = Math.max(0, Math.min(1, input.arousal));
    if (a > 0.7) {
      speed = "4.4s";
      drift = "10s";
    } else if (a < 0.35) {
      speed = "11s";
      drift = "26s";
    }
  }

  const evolutionClass = EVOLUTION_CLASS[input.evolution ?? ""] ?? "";
  const className = [
    "buddy-orb",
    still ? "buddy-orb-still" : "",
    `buddy-orb-aura-${aura}`,
    `buddy-orb-world-${world}`,
    `buddy-orb-interaction-${interaction}`,
    animation === "playful" ? "buddy-orb-playful" : "",
    input.seasonal ? `buddy-orb-season-${input.seasonal}` : "",
    evolutionClass,
  ]
    .filter(Boolean)
    .join(" ");

  const vibeWord =
    typeof input.valence === "number"
      ? input.valence > 0.25
        ? "brighter"
        : input.valence < -0.25
          ? "softer"
          : "steady"
      : mood;

  return {
    className,
    styleVars: {
      "--orb-hue": palette.hue,
      "--orb-glow": palette.glow,
      "--orb-speed": still ? "0.01ms" : speed,
      "--orb-drift": still ? "0.01ms" : drift,
    },
    ariaDescription: `Buddy companion, ${vibeWord} vibe, ${interaction} state`,
    particleLevel: still ? 0 : particleLevel(aura, energy, interaction),
    pulseScale: interactionPulse(interaction),
  };
}

export function interactionFromWake(mood: BuddyMood): OrbInteraction {
  if (mood === "excited" || mood === "playful") return "excited";
  if (mood === "sad" || mood === "anxious" || mood === "lonely") return "comforting";
  if (mood === "curious") return "curious";
  if (mood === "tired") return "listening";
  return "responding";
}
